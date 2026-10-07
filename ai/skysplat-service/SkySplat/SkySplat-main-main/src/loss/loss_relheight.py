from dataclasses import dataclass
import torch
from jaxtyping import Float
from torch import Tensor

from .loss import Loss
from ..dataset.types import BatchedExample
from ..model.types import Gaussians
from ..model.decoder.decoder import DecoderOutput
import matplotlib.pyplot as plt

def save_and_visualize_depth(rendered_depth: torch.Tensor,
                             save_path: str = "rendered_depth.png"):
    """Save a normalized depth visualization."""
    depth = rendered_depth.detach().cpu().squeeze()

    depth_min, depth_max = depth.min(), depth.max()
    depth_norm = (depth - depth_min) / (depth_max - depth_min + 1e-8)

    plt.figure(figsize=(6,6))
    plt.imshow(depth_norm, cmap='magma')
    plt.colorbar(label='Normalized Depth')
    plt.axis('off')
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches='tight')

@dataclass
class LossRelHeightCfg:
    weight: float


@dataclass
class LossRelHeightCfgWrapper:
    relheight: LossRelHeightCfg


class LossRelHeight(Loss[LossRelHeightCfg, LossRelHeightCfgWrapper]):
    """
    PCC loss between predicted relative height and GT height.
    Needs gaussians.hei and batch["height"]
    """

    def pcc_loss(self, x, y):
        x_centered = x - x.mean()
        y_centered = y - y.mean()
        return 1 - torch.sum(x_centered * y_centered) / (
            torch.sqrt(torch.sum(x_centered ** 2)) * torch.sqrt(torch.sum(y_centered ** 2)) + 1e-8
        )

    def forward(
        self,
        prediction,
        batch,
        gaussians,
        global_step: int,
    ) -> Float[Tensor, ""]:

        b, v, _, h, w = batch["context"]["image"].shape

        # predicted height from Gaussians
        pred_height = gaussians.hei.reshape(b, v, h, w)

        gt_height = batch["context"]["height"]
        pred_height_norm = (pred_height - pred_height.min()) / (pred_height.max() - pred_height.min() + 1e-6)
        gt_height_norm = (gt_height - gt_height.min()) / (gt_height.max() - gt_height.min() + 1e-6)
        loss = self.pcc_loss(pred_height_norm, gt_height_norm)

        return self.cfg.weight * loss
