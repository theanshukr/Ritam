from functools import cache

import torch
from einops import reduce
from jaxtyping import Float
from lpips import LPIPS
from skimage.metrics import structural_similarity
from torch import Tensor
import numpy as np

@torch.no_grad()
def compute_psnr(
    ground_truth: Float[Tensor, "batch channel height width"],
    predicted: Float[Tensor, "batch channel height width"],
) -> Float[Tensor, " batch"]:
    ground_truth = ground_truth.clip(min=0, max=1)
    predicted = predicted.clip(min=0, max=1)
    mse = reduce((ground_truth - predicted) ** 2, "b c h w -> b", "mean")
    return -10 * mse.log10()


@cache
def get_lpips(device: torch.device) -> LPIPS:
    return LPIPS(net="vgg").to(device)


@torch.no_grad()
def compute_lpips(
    ground_truth: Float[Tensor, "batch channel height width"],
    predicted: Float[Tensor, "batch channel height width"],
) -> Float[Tensor, " batch"]:
    value = get_lpips(predicted.device).forward(ground_truth, predicted, normalize=True)
    return value[:, 0, 0, 0]


@torch.no_grad()
def compute_ssim(
    ground_truth: Float[Tensor, "batch channel height width"],
    predicted: Float[Tensor, "batch channel height width"],
) -> Float[Tensor, " batch"]:
    ssim = [
        structural_similarity(
            gt.detach().cpu().numpy(),
            hat.detach().cpu().numpy(),
            win_size=11,
            gaussian_weights=True,
            channel_axis=0,
            data_range=1.0,
        )
        for gt, hat in zip(ground_truth, predicted)
    ]
    return torch.tensor(ssim, dtype=predicted.dtype, device=predicted.device)
@torch.no_grad()
def calculate_mae(gt, result, mask):
    masked_result = result[mask].detach().cpu().numpy()
    masked_gt = gt[mask].detach().cpu().numpy()
    mask = mask.detach().cpu().numpy()
    masked_abs_diff = np.fabs(masked_result - masked_gt)
    valid_num = np.sum(mask.astype(np.float32))
    mae = np.sum(masked_abs_diff) / (valid_num + 1e-10)
    return mae.astype(np.float32)

@torch.no_grad()
def calculate_rmse(gt, result, mask):
    masked_result = result[mask].detach().cpu().numpy()
    masked_gt = gt[mask].detach().cpu().numpy()
    mask = mask.cpu().detach().numpy()
    masked_abs_diff = np.fabs(masked_result - masked_gt)
    masked_square_diff_inliners = np.power(masked_abs_diff, 2)
    valid_num = np.sum(mask.astype(np.float32))
    rmse_square = np.sum(masked_square_diff_inliners) / (valid_num + 1e-10)
    rmse = np.sqrt(rmse_square)
    return rmse.astype(np.float32)

@torch.no_grad()
def calculate_less_thre_ratio(gt, result, mask, thre=0.1):
    masked_result = result[mask].detach().cpu().numpy()
    masked_gt = gt[mask].detach().cpu().numpy()
    mask = mask.detach().cpu().numpy()
    masked_abs_diff = np.fabs(masked_result - masked_gt)
    inliner_mask = (masked_abs_diff < thre)
    valid_num = np.sum(mask.astype(np.float32)) + 1e-10
    inliner_num = np.sum(inliner_mask.astype(np.float32))
    ratio = inliner_num / valid_num
    return ratio.astype(np.float32)