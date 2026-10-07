from dataclasses import dataclass
import torch, os
import torch.nn.functional as F
from jaxtyping import Float
from torch import Tensor
from einops import rearrange
import matplotlib.pyplot as plt
from .loss import Loss
from ..dataset.types import BatchedExample
from ..model.types import Gaussians
from ..model.decoder.decoder import DecoderOutput
from sklearn.decomposition import PCA

def pca_feature_map(
    feat: torch.Tensor,
    save_path: str = "pca_feature.png"
):
    """Compress a feature map to three PCA channels and save it as a PNG."""
    x = feat.detach().cpu().numpy()  # (H*W, C)
    n_pixels, C = feat.shape
    H = W = int(n_pixels ** 0.5)
    pca = PCA(n_components=3)
    x_pca = pca.fit_transform(x)                      # (H*W, 3)
    x_pca = x_pca.reshape(H, W, 3)

    x_min, x_max = x_pca.min(), x_pca.max()
    x_pca = (x_pca - x_min) / (x_max - x_min + 1e-8)

    os.makedirs(os.path.dirname(save_path) or ".", exist_ok=True)
    plt.imsave(save_path, x_pca)

@dataclass
class LossFeatureCfg:
    weight_sam: float
    weight_clip: float


@dataclass
class LossFeatureCfgWrapper:
    feature: LossFeatureCfg


class LossFeature(Loss[LossFeatureCfg, LossFeatureCfgWrapper]):
    """
    Cosine loss between rendered features and GT features.
    Needs prediction["sam_feats"], prediction["clip_feats"], batch["sam_feats"], batch["clip_feats"]
    """

    def forward(
            self,
            prediction,
            batch,
            gaussians,
            global_step: int,
    ) -> Float[Tensor, ""]:
        rendered_sam = prediction["render_SAM_feats"]  # (B, C, H, W)
        gt_sam = batch["context"]["SAM_feats"]
        bs, view = gt_sam.size(0), gt_sam.size(1)
        gt_sam = rearrange(gt_sam, "b v c h w -> (b v) c h w", b=bs, v=view)

        # SAM feature cosine loss
        sam_loss = F.cosine_embedding_loss(
            F.normalize(rendered_sam.permute(0, 2, 3, 1).reshape(-1, 1024), dim=1),
            F.normalize(gt_sam.permute(0, 2, 3, 1).reshape(-1, 1024), dim=1),
            torch.ones(rendered_sam.numel() // 1024, device=rendered_sam.device)
        )
        return self.cfg.weight_sam * sam_loss

