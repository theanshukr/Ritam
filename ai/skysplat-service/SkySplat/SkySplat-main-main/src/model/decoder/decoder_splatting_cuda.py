from dataclasses import dataclass
from typing import Literal

import torch
from einops import rearrange, repeat
from jaxtyping import Float
from torch import Tensor
import torch.nn.functional as F
from ...dataset import DatasetCfg
from ..types import Gaussians
from .cuda_splatting import DepthRenderingMode, render_cuda, render_depth_cuda
from .decoder import Decoder, DecoderOutput
import torch.nn as nn


@dataclass
class DecoderSplattingCUDACfg:
    name: Literal["splatting_cuda"]


class DecoderSplattingCUDA(Decoder[DecoderSplattingCUDACfg]):
    background_color: Float[Tensor, "3"]

    def __init__(
        self,
        cfg: DecoderSplattingCUDACfg,
        dataset_cfg: DatasetCfg,
    ) -> None:
        super().__init__(cfg, dataset_cfg)
        self.register_buffer(
            "background_color",
            torch.tensor(dataset_cfg.background_color, dtype=torch.float32),
            persistent=False,
        )

    def forward(
        self,
        gaussians,
        kwargs,
        image_shape: tuple[int, int],
        mode = "train"
    ):
        means3d = gaussians.means
        bs_ref, view_ref = means3d.size(0), means3d.size(1)
        bs, view = bs_ref, kwargs['cam2img'].size(1)
        backgrounds = torch.zeros(bs, view, 3, device=means3d.device)
        if "JAX" in kwargs['ref_filename'][0][0]:
            near = 5e5 * torch.ones(1, view, device=means3d.device).expand(bs, view)
            far  = 1e6 * torch.ones(1, view, device=means3d.device).expand(bs, view)
        elif "OMA" in kwargs['ref_filename'][0][0]:
            near = 1e6 * torch.ones(1, view, device=means3d.device).expand(bs, view)
            far  = 2e6 * torch.ones(1, view, device=means3d.device).expand(bs, view)


        color = render_cuda(
            rearrange(kwargs["cam2enu"], "b v i j -> (b v) i j"),
            rearrange(kwargs["cam2img"][..., :3, :3], "b v i j -> (b v) i j"),
            rearrange(near, "b v -> (b v)"),
            rearrange(far, "b v -> (b v)"),
            image_shape,
            rearrange(backgrounds, "b v i -> (b v) i"),
            rearrange(gaussians.means, "b v i j -> (b v) i j"),
            rearrange(gaussians.covariances, "b v i m n -> (b v) i m n"),
            rearrange(gaussians.harmonics, "b v g c d_sh -> (b v) g c d_sh"),
            rearrange(gaussians.opacities, "b v i j -> (b v) (i j)"),
            mode = mode,
            scale_invariant  = True,
            filename=kwargs['ref_filename']
        )
        color = rearrange(color, "(b v) c h w -> b v c h w", b=bs, v=view)
        return {"render_color": color}

    def render_depth(
        self,
        gaussians: Gaussians,
        extrinsics: Float[Tensor, "batch view 4 4"],
        intrinsics: Float[Tensor, "batch view 3 3"],
        near: Float[Tensor, "batch view"],
        far: Float[Tensor, "batch view"],
        image_shape: tuple[int, int],
        mode: DepthRenderingMode = "depth",
    ) -> Float[Tensor, "batch view height width"]:
        b, v, _, _ = extrinsics.shape
        result = render_depth_cuda(
            rearrange(extrinsics, "b v i j -> (b v) i j"),
            rearrange(intrinsics, "b v i j -> (b v) i j"),
            rearrange(near, "b v -> (b v)"),
            rearrange(far, "b v -> (b v)"),
            image_shape,
            repeat(gaussians.means, "b g xyz -> (b v) g xyz", v=v),
            repeat(gaussians.covariances, "b g i j -> (b v) g i j", v=v),
            repeat(gaussians.opacities, "b g -> (b v) g", v=v),
            mode=mode,
        )
        return rearrange(result, "(b v) h w -> b v h w", b=b, v=v)
