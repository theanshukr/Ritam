from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Protocol, runtime_checkable
import torch
from einops import  rearrange
from jaxtyping import Float
from pytorch_lightning import LightningModule
from pytorch_lightning.loggers.wandb import WandbLogger
from torch import Tensor, nn, optim
import numpy as np
import json
from ..dataset.data_module import get_data_shim
from ..evaluation.metrics import compute_lpips, compute_psnr, compute_ssim, calculate_mae, calculate_rmse, calculate_less_thre_ratio
from ..global_cfg import get_cfg
from ..loss import Loss
from ..misc.benchmarker import Benchmarker
from ..misc.image_io import save_image
from ..misc.step_tracker import StepTracker
from .decoder.decoder import Decoder, DepthRenderingMode
from .encoder import Encoder
from .encoder.visualization.encoder_visualizer import EncoderVisualizer

@dataclass
class OptimizerCfg:
    lr: float
    warm_up_steps: int
    cosine_lr: bool


@dataclass
class TestCfg:
    output_path: Path
    compute_scores: bool
    save_image: bool
    save_video: bool
    eval_time_skip_steps: int


@dataclass
class TrainCfg:
    depth_mode: DepthRenderingMode | None
    extended_visualization: bool
    print_log_every_n_steps: int


@runtime_checkable
class TrajectoryFn(Protocol):
    def __call__(
        self,
        t: Float[Tensor, " t"],
    ) -> tuple[
        Float[Tensor, "batch view 4 4"],  # extrinsics
        Float[Tensor, "batch view 3 3"],  # intrinsics
    ]:
        pass

def to_json_serializable(value):
    if isinstance(value, torch.Tensor):
        return to_json_serializable(value.detach().cpu())
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, dict):
        return {k: to_json_serializable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_json_serializable(v) for v in value]
    return value
    
class ModelWrapper(LightningModule):
    logger: Optional[WandbLogger]
    encoder: nn.Module
    encoder_visualizer: Optional[EncoderVisualizer]
    decoder: Decoder
    losses: nn.ModuleList
    optimizer_cfg: OptimizerCfg
    test_cfg: TestCfg
    train_cfg: TrainCfg
    step_tracker: StepTracker | None

    def __init__(
        self,
        optimizer_cfg: OptimizerCfg,
        test_cfg: TestCfg,
        train_cfg: TrainCfg,
        encoder: Encoder,
        encoder_visualizer: Optional[EncoderVisualizer],
        decoder: Decoder,
        losses: list[Loss],
        step_tracker: StepTracker | None,
    ) -> None:
        super().__init__()
        self.optimizer_cfg = optimizer_cfg
        self.test_cfg = test_cfg
        self.train_cfg = train_cfg
        self.step_tracker = step_tracker

        # Set up the model.
        self.encoder = encoder
        self.encoder_visualizer = encoder_visualizer
        self.decoder = decoder
        self.data_shim = get_data_shim(self.encoder)
        self.losses = nn.ModuleList(losses)

        # This is used for testing.
        self.benchmarker = Benchmarker()
        if self.test_cfg.compute_scores:
            self.test_step_outputs = {}
            self.time_skip_steps_dict = {"encoder": 0, "decoder": 0}
            self.val_step_outputs = {}
        self.val_step_cnt = 0

    def training_step(self, batch, batch_idx):
        _, _, _, h, w = batch["context"]["image"].shape
        filename = batch["context"]['ref_filename'][0][0].split("/0/")[-1]
        print("Filename: ", filename)
        # Run the model.
        gaussians = self.encoder(batch["context"], self.global_step, False)
        output = self.decoder.forward(gaussians, batch["context"], (h, w), mode = "train")
        target_gt = batch["context"]["image"]
        # Compute metrics.
        psnr_probabilistic = compute_psnr(
            rearrange(target_gt, "b v c h w -> (b v) c h w"),
            rearrange(output["render_color"], "b v c h w -> (b v) c h w"),
        )
        self.log("train/psnr_probabilistic", psnr_probabilistic.mean())

        # Compute and log loss.
        total_loss = 0
        loss_items = {}
        for loss_fn in self.losses:
            loss = loss_fn.forward(output, batch, gaussians, self.global_step)
            self.log(f"loss/{loss_fn.name}", loss)
            loss_items[loss_fn.name] = loss.item()
            total_loss = total_loss + loss

        self.log("loss/total", total_loss)
        # Logging to console
        if (
                self.global_rank == 0
                and self.global_step % self.train_cfg.print_log_every_n_steps == 0
        ):
            detail = " | ".join([f"{n}: {v:.6f}" for n, v in loss_items.items()])
            print(f"train step {self.global_step}; total: {total_loss:.6f} | {detail}")

        self.log("info/global_step", self.global_step)

        # Tell the data loader processes about the current step.
        if self.step_tracker is not None:
            self.step_tracker.set_step(self.global_step)
        return total_loss

    def test_step(self, batch, batch_idx):
        b, v, _, h, w = batch["context"]["image"].shape
        assert b == 1
        # Render Gaussians.
        with self.benchmarker.time("encoder"):
            gaussians = self.encoder(batch["context"], self.global_step, False)
        with self.benchmarker.time("decoder", num_calls=v):
            # output = self.decoder.forward(gaussians, batch["context"], (h, w), mode="test")
            output = self.decoder.forward(gaussians, batch["target"], (h, w), mode="test")

        scene = batch["context"]['ref_filename'][0][0].split("/0/")[-1].split(".tif")[0].split("_RGB_")[0]
        name = get_cfg()["wandb"]["name"]
        path = self.test_cfg.output_path / name

        rgb_gt = batch["target"]["image"]
        rgb_gt = rearrange(rgb_gt, "b v c h w -> (b v) c h w")
        render_rgb = rearrange(output["render_color"], "b v c h w -> (b v) c h w")
        height_gt = batch["context"]['gt_height']
        mask_height = ~torch.isnan(height_gt)
        pred_height = gaussians.hei.reshape(b, v, h, w)

        # Save images.
        if self.test_cfg.save_image:
            for index, color in zip(batch["context"]['ref_filename'], render_rgb):
                index_name = index[0].split("/0/")[-1].split(".tif")[0]
                save_image(color, path / scene / f"color/{index_name:0>6}.png")

        # compute scores
        if self.test_cfg.compute_scores:
            if batch_idx < self.test_cfg.eval_time_skip_steps:
                self.time_skip_steps_dict["encoder"] += 1
                self.time_skip_steps_dict["decoder"] += v
            rgb = render_rgb

            if f"psnr" not in self.test_step_outputs:
                self.test_step_outputs[f"psnr"] = []
            if f"ssim" not in self.test_step_outputs:
                self.test_step_outputs[f"ssim"] = []
            if f"lpips" not in self.test_step_outputs:
                self.test_step_outputs[f"lpips"] = []
            if f"mae" not in self.test_step_outputs:
                self.test_step_outputs[f"mae"] = []
            if f"rmse" not in self.test_step_outputs:
                self.test_step_outputs[f"rmse"] = []
            if f"pag10" not in self.test_step_outputs:
                self.test_step_outputs[f"pag10"] = []
            if f"pag25" not in self.test_step_outputs:
                self.test_step_outputs[f"pag25"] = []
            if f"pag75" not in self.test_step_outputs:
                self.test_step_outputs[f"pag75"] = []
            self.test_step_outputs[f"psnr"].append(compute_psnr(rgb_gt, rgb).mean().item())
            self.test_step_outputs[f"ssim"].append(compute_ssim(rgb_gt, rgb).mean().item())
            self.test_step_outputs[f"lpips"].append(compute_lpips(rgb_gt, rgb).mean().item())
            self.test_step_outputs[f"mae"].append(calculate_mae(height_gt, pred_height, mask_height))
            self.test_step_outputs[f"rmse"].append(calculate_rmse(height_gt, pred_height, mask_height))
            self.test_step_outputs[f"pag10"].append(calculate_less_thre_ratio(height_gt, pred_height, mask_height, 1.0))
            self.test_step_outputs[f"pag25"].append(calculate_less_thre_ratio(height_gt, pred_height, mask_height, 2.5))
            self.test_step_outputs[f"pag75"].append(calculate_less_thre_ratio(height_gt, pred_height, mask_height, 7.5))

    def on_test_end(self) -> None:
        name = get_cfg()["wandb"]["name"]
        out_dir = self.test_cfg.output_path / name
        saved_scores = {}
        if self.test_cfg.compute_scores:
            self.benchmarker.dump_memory(out_dir / "peak_memory.json")
            self.benchmarker.dump(out_dir / "benchmark.json")

            for metric_name, metric_scores in self.test_step_outputs.items():
                metric_scores = to_json_serializable(metric_scores)
                avg_scores = sum(metric_scores) / len(metric_scores)
                saved_scores[metric_name] = avg_scores
                print(metric_name, avg_scores)
                with (out_dir / f"scores_{metric_name}_all.json").open("w") as f:
                    json.dump(metric_scores, f)
                metric_scores.clear()

            for tag, times in self.benchmarker.execution_times.items():
                times = times[int(self.time_skip_steps_dict[tag]) :]
                avg_time = float(np.mean(times))
                saved_scores[tag] = [len(times), avg_time]
                print(f"{tag}: {len(times)} calls, avg. {avg_time} seconds per call")
                self.time_skip_steps_dict[tag] = 0

            with (out_dir / f"scores_all_avg.json").open("w") as f:
                json.dump(to_json_serializable(saved_scores), f)
            self.benchmarker.clear_history()
        else:
            self.benchmarker.dump(self.test_cfg.output_path / name / "benchmark.json")
            self.benchmarker.dump_memory(
                self.test_cfg.output_path / name / "peak_memory.json"
            )
            self.benchmarker.summarize()

    def configure_optimizers(self):
        optimizer = optim.Adam(self.parameters(), lr=self.optimizer_cfg.lr)
        if self.optimizer_cfg.cosine_lr:
            warm_up = torch.optim.lr_scheduler.OneCycleLR(
                            optimizer, self.optimizer_cfg.lr,
                            self.trainer.max_steps + 10,
                            pct_start=0.01,
                            cycle_momentum=False,
                            anneal_strategy='cos',
                        )
        else:
            warm_up_steps = self.optimizer_cfg.warm_up_steps
            warm_up = torch.optim.lr_scheduler.LinearLR(
                optimizer,
                1 / warm_up_steps,
                1,
                total_iters=warm_up_steps,
        )
        return {
            "optimizer": optimizer,
            "lr_scheduler": {
                "scheduler": warm_up,
                "interval": "step",
                "frequency": 1,
            },
        }
