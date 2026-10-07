import copy

import torch
import torch.nn as nn
import torch.nn.functional as F
from einops import rearrange, repeat
import numpy as np
from ..backbone.unimatch.geometry import coords_grid
from .ldm_unet.unet import UNetModel
from .warping import RPC_Photo2Obj,RPC_Obj2Photo
from torchvision import transforms
from .red_regularization import RED_Regularization

def rpc_warping(src_fea, src_rpc, ref_rpc, depth_values, coef):
    # src_fea: [B, C, H, W]
    # src_rpc: [B, 170]
    # ref_rpc: [B, 170]
    # depth_values: [B, Ndepth] o [B, Ndepth, H, W]
    # out: [B, C, Ndepth, H, W]
    batch, channels = src_fea.shape[0], src_fea.shape[1]
    num_depth = depth_values.shape[1]
    height, width = src_fea.shape[2], src_fea.shape[3]

    with torch.no_grad():
        y, x = torch.meshgrid([torch.arange(0, height, dtype=torch.double, device=src_fea.device),
                               torch.arange(0, width, dtype=torch.double, device=src_fea.device)])
        y, x = y.contiguous(), x.contiguous()
        y = y.view(1, 1, height, width).repeat(batch, num_depth, 1, 1) # (B, ndepth, H, W)
        x = x.view(1, 1, height, width).repeat(batch, num_depth, 1, 1)

        if len(depth_values.shape) == 2:
            h = depth_values.view(batch, num_depth, 1, 1).double().repeat(1, 1, height, width) # (B, ndepth, H, W)
        else:
            h = depth_values # (B, ndepth, H, W)

        x = x.view(batch, -1)
        y = y.view(batch, -1)
        h = h.view(batch, -1)
        h = h.double()

        lat, lon = RPC_Photo2Obj(x, y, h, ref_rpc, coef)
        samp, line = RPC_Obj2Photo(lat, lon, h, src_rpc, coef)

        samp = samp.float()
        line = line.float()

        proj_x_normalized = samp / ((width - 1) / 2) - 1
        proj_y_normalized = line / ((height - 1) / 2) - 1
        proj_x_normalized = proj_x_normalized.view(batch, num_depth, height * width)
        proj_y_normalized = proj_y_normalized.view(batch, num_depth, height * width)

        proj_xy = torch.stack((proj_x_normalized, proj_y_normalized), dim=3)  # [B, Ndepth, H*W, 2]
        grid = proj_xy

    warped_src_fea = F.grid_sample(src_fea, grid.view(batch, num_depth * height, width, 2), mode='bilinear',padding_mode='zeros')
    warped_src_fea = warped_src_fea.view(batch, channels, num_depth, height, width)
    grid_np = grid.view(batch, num_depth * height, width, 2).cpu().numpy()
    return warped_src_fea,grid_np

def rpc_prepare_feat_proj_data_lists(
    features, rpc_proj_matrices, near, far, num_samples
):
    # prepare features
    b, v, _, h, w = features.shape
    feat_lists = []
    ref_proj_list = []
    src_proj_list = []

    init_view_order = list(range(v))
    feat_lists.append(rearrange(features, "b v ... -> (v b) ..."))  # (vxb c h w)
    for idx in range(1, v):
        cur_view_order = init_view_order[idx:] + init_view_order[:idx]
        cur_feat = features[:, cur_view_order]
        feat_lists.append(rearrange(cur_feat, "b v ... -> (v b) ..."))  # (vxb c h w)

        # calculate reference pose
        # NOTE: not efficient, but clearer for now
        cur_ref_proj_list = []
        cur_src_proj_list = []
        for v0, v1 in zip(init_view_order, cur_view_order):
            ref_proj = copy.deepcopy(rpc_proj_matrices[:, v0])
            src_proj = copy.deepcopy(rpc_proj_matrices[:, v1])
            ref_proj[:, 0] = ref_proj[:, 0] * float(w) / 256.0
            ref_proj[:, 1] = ref_proj[:, 1] * float(h) / 256.0
            ref_proj[:, 5] = ref_proj[:, 5] * float(w) / 256.0
            ref_proj[:, 6] = ref_proj[:, 6] * float(h) / 256.0

            src_proj[:, 0] = src_proj[:, 0] * float(w) / 256.0
            src_proj[:, 1] = src_proj[:, 1] * float(h) / 256.0
            src_proj[:, 5] = src_proj[:, 5] * float(w) / 256.0
            src_proj[:, 6] = src_proj[:, 6] * float(h) / 256.0
            cur_ref_proj_list.append(ref_proj)
            cur_src_proj_list.append(src_proj)


        cur_ref_proj_to_v0s = torch.cat(cur_ref_proj_list, dim=0)  # (vxb c h w)
        ref_proj_list.append(cur_ref_proj_to_v0s)
        cur_src_proj_to_v0s = torch.cat(cur_src_proj_list, dim=0)  # (vxb c h w)
        src_proj_list.append(cur_src_proj_to_v0s)


    # prepare depth bound (inverse depth) [v*b, d]
    cur_depth_min = near.reshape(b*v)  # (B,)
    cur_depth_max = far.reshape(b*v)
    new_interval = (cur_depth_max - cur_depth_min) / (num_samples - 1)  # (B, )
    depth_candi_curr = cur_depth_min.unsqueeze(1) + (
            torch.arange(0, num_samples, device=cur_depth_min.device, dtype=cur_depth_min.dtype,
                         requires_grad=False).reshape(1, -1).repeat(3, 1) * new_interval.unsqueeze(1))  # (B, D)
    depth_candi_curr = repeat(depth_candi_curr, "vb d -> vb d () ()")  # [vxb, d, 1, 1]

    return feat_lists, ref_proj_list, src_proj_list, depth_candi_curr

class DepthPredictorMultiView(nn.Module):
    """IMPORTANT: this model is in (v b), NOT (b v), due to some historical issues.
    keep this in mind when performing any operation related to the view dim"""

    def __init__(
        self,
        feature_channels=128,
        upscale_factor=4,
        num_depth_candidates=32,
        costvolume_unet_feat_dim=128,
        costvolume_unet_channel_mult=(1, 1, 1),
        costvolume_unet_attn_res=(),
        gaussian_raw_channels=-1,
        gaussians_per_pixel=1,
        num_views=2,
        depth_unet_feat_dim=64,
        depth_unet_attn_res=(),
        depth_unet_channel_mult=(1, 1, 1),
        wo_depth_refine=False,
        wo_cost_volume=False,
        wo_cost_volume_refine=False,
        **kwargs,
    ):
        super(DepthPredictorMultiView, self).__init__()
        self.num_depth_candidates = num_depth_candidates
        self.regressor_feat_dim = costvolume_unet_feat_dim
        self.upscale_factor = upscale_factor

        # Depth estimation: project features to get softmax based coarse depth
        # CNN-based feature upsampler
        proj_in_channels = feature_channels + feature_channels
        upsample_out_channels = feature_channels
        self.upsampler = nn.Sequential(
            nn.Conv2d(proj_in_channels, upsample_out_channels, 3, 1, 1),
            nn.Upsample(
                scale_factor=upscale_factor,
                mode="bilinear",
                align_corners=True,
            ),
            nn.GELU(),
        )
        self.proj_feature = nn.Conv2d(
            upsample_out_channels, depth_unet_feat_dim, 3, 1, 1
        )
        self.upsampler_cost_volume = nn.Sequential(
            nn.Conv2d(64, 64, 3, 1, 1),
            nn.Upsample(
                scale_factor=upscale_factor,
                mode="bilinear",
                align_corners=True,
            ),
            nn.GELU(),
        )
        self.upsampler_pdf = nn.Sequential(
            nn.Conv2d(1, 1, 3, 1, 1),
            nn.Upsample(
                scale_factor=upscale_factor,
                mode="bilinear",
                align_corners=True,
            ),
            nn.GELU(),
        )
        self.upsampler_depth = nn.Sequential(
            nn.Conv2d(1, 1, 3, 1, 1),
            nn.Upsample(
                scale_factor=upscale_factor,
                mode="bilinear",
                align_corners=True,
            ),
            nn.GELU(),
        )

        # Depth refinement: 2D U-Net
        input_channels = 3 + depth_unet_feat_dim + 1 + 1
        channels = depth_unet_feat_dim
        if wo_depth_refine:  # for ablations
            self.refine_unet = nn.Conv2d(input_channels, channels, 3, 1, 1)
        else:
            self.refine_unet = nn.Sequential(
                nn.Conv2d(input_channels, channels, 3, 1, 1),
                nn.GroupNorm(4, channels),
                nn.GELU(),
                UNetModel(
                    image_size=None,
                    in_channels=channels,
                    model_channels=channels,
                    out_channels=channels,
                    num_res_blocks=1,
                    attention_resolutions=depth_unet_attn_res,
                    channel_mult=depth_unet_channel_mult,
                    num_head_channels=32,
                    dims=2,
                    postnorm=True,
                    num_frames=num_views,
                    use_cross_view_self_attn=True,
                ),
            )

        # Gaussians prediction: covariance, color
        gau_in = depth_unet_feat_dim + 3 + feature_channels
        gaussian_raw_channels = gaussian_raw_channels
        self.to_gaussians = nn.Sequential(
            nn.Conv2d(gau_in, gaussian_raw_channels * 2, 3, 1, 1),
            nn.GELU(),
            nn.Conv2d(
                gaussian_raw_channels * 2, gaussian_raw_channels, 3, 1, 1
            ),
        )

        # Gaussians prediction: centers, opacity
        if not wo_depth_refine:
            channels = depth_unet_feat_dim
            disps_models = [
                nn.Conv2d(channels, channels * 2, 3, 1, 1),
                nn.GELU(),
                nn.Conv2d(channels * 2, gaussians_per_pixel * 2, 3, 1, 1),
            ]
            self.to_disparity = nn.Sequential(*disps_models)

        self.cost_regularization = RED_Regularization(in_channels=128,base_channels=8)

    def forward(
        self,
        features,
        rpc_proj_matrices,
        near,
        far,
        gaussians_per_pixel=1,
        extra_info=None,
        cnn_features=None,
    ):
        """IMPORTANT: this model is in (v b), NOT (b v), due to some historical issues.
        keep this in mind when performing any operation related to the view dim"""
        device = features.device
        # format the input
        b, v, c, h, w = features.shape
        feat_comb_lists, ref_proj, src_proj, disp_candi_curr = (
            rpc_prepare_feat_proj_data_lists(
                features,
                rpc_proj_matrices,
                near,
                far,
                num_samples=self.num_depth_candidates,
            )
        )
        if cnn_features is not None:
            cnn_features = rearrange(cnn_features, "b v ... -> (v b) ...")
        feat01 = feat_comb_lists[0]
        ref_volume = feat_comb_lists[0].unsqueeze(2).repeat(1, 1, self.num_depth_candidates, 1, 1)

        num_views = len(feat01)
        volume_sum = ref_volume
        volume_sq_sum = ref_volume ** 2
        for feat10,per_src_proj, per_ref_proj in zip(feat_comb_lists[1:], src_proj, ref_proj):
            depth_values = disp_candi_curr.repeat(1, 1, h, w)  # (B, D, H, W)
            coef = torch.ones((b*v, h * w * self.num_depth_candidates, 20), dtype=torch.double).to(device)
            feat01_warped,grid_np = rpc_warping(feat10, per_src_proj, per_ref_proj, depth_values, coef)
            volume_sum = volume_sum + feat01_warped
            volume_sq_sum = volume_sq_sum + feat01_warped ** 2
            del feat01_warped

        # step 2. aggregate multiple feature volumes by variance
        volume_variance = volume_sq_sum.div_(num_views).sub_(volume_sum.div_(num_views).pow_(2))

        # step 3. cost volume regularization
        refined_volume_variance = self.cost_regularization(volume_variance)
        refined_volume_variance = F.interpolate(refined_volume_variance,scale_factor=self.upscale_factor,mode="bilinear",align_corners=True,)

        # step 4. cost volume regularization
        prob_volume = F.softmax(refined_volume_variance, dim=1)
        depth = depth_regression(prob_volume, depth_values=depth_values).unsqueeze(1)
        photometric_confidence, indices = prob_volume.max(1)
        photometric_confidence = photometric_confidence.unsqueeze(1)
        pdf_max     = photometric_confidence
        final_depth = depth


        proj_feat_in_fullres = self.upsampler(torch.cat((feat01, cnn_features), dim=1))
        proj_feature = self.proj_feature(proj_feat_in_fullres)

        # depth refinement
        refine_out = self.refine_unet(torch.cat(
            (extra_info["images"], proj_feature, final_depth, pdf_max), dim=1
        ))
        # gaussians head
        raw_gaussians_in = [refine_out,extra_info["images"], proj_feat_in_fullres]
        raw_gaussians_in = torch.cat(raw_gaussians_in, dim=1)
        raw_gaussians = self.to_gaussians(raw_gaussians_in)
        raw_gaussians = rearrange(raw_gaussians, "(v b) c h w -> b v (h w) c", v=v, b=b)
        # delta fine depth and density
        delta_disps_density = self.to_disparity(refine_out)
        _, raw_densities = delta_disps_density.split(gaussians_per_pixel, dim=1)

        # combine coarse and fine info and match shape
        densities = repeat(F.sigmoid(raw_densities),"(v b) dpt h w -> b v (h w) srf dpt",b=b,v=v,srf=1,)

        depths = final_depth
        depths = depths.clamp(
            rearrange(near, "b v -> (v b) () () ()"),
            rearrange(far, "b v -> (v b) () () ()"),)
        depths = repeat(depths,"(v b) dpt h w -> b v (h w) srf dpt",b=b,v=v,srf=1)
        return depths, densities, raw_gaussians

def depth_regression(p, depth_values):
    if depth_values.dim() <= 2:
        depth_values = depth_values.view(*depth_values.shape, 1, 1)
    else:
        depth_values = F.interpolate(depth_values, [p.shape[2], p.shape[3]], mode='bilinear', align_corners=False)
    depth = torch.sum(p * depth_values, 1)
    return depth
