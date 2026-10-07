from dataclasses import dataclass
import torch,pymap3d
from einops import einsum, rearrange
from jaxtyping import Float
from torch import Tensor, nn
from scipy.spatial.transform import Rotation
from ....geometry.projection import get_world_rays,reproject_with_depth_K
from ....misc.sh_rotation import rotate_sh
from .gaussians import build_covariance
import numpy as np
import torch
from pyquaternion import Quaternion
from torch.cuda.amp import autocast
from ..costvolume.warping import RPC_Photo2Obj,geodetic2enu_torch,utm_from_latlon
import torch.nn.functional as F

def rotmat_to_quat(rot_matrices):
    inputs = rot_matrices
    rot_matrices = rot_matrices.reshape(
        rot_matrices.shape[0] * rot_matrices.shape[1],
        rot_matrices.shape[-2],
        rot_matrices.shape[-1]
    )
    flag_Not_ortho = False
    rot_matrices = rot_matrices.cpu().numpy()
    quats = []

    # Add tolerance level and max iterations to avoid infinite loop
    tolerance = 1e-4 # default 1e-6
    max_iterations = 30

    for rot in rot_matrices:
        iteration = 0
        # while not np.allclose(rot @ rot.T, np.eye(3), atol=tolerance) and iteration < max_iterations:
        while not np.allclose(rot @ rot.T, np.eye(3)) and iteration < max_iterations:
            U, _, V = np.linalg.svd(rot)
            rot = U @ V
            iteration += 1

        # If we exceeded max iterations, we can issue a warning or handle accordingly
        if iteration == max_iterations:
            flag_Not_ortho = True
            # print("Warning: Maximum iterations reached for matrix correction.")
        per_quats = Rotation.from_matrix(rot).as_quat()
        scipy_quat = per_quats[[3, 0, 1, 2]]
        quats.append(scipy_quat)
        # quats.append(Quaternion(matrix=rot).elements)

    return torch.from_numpy(np.stack(quats)).to(inputs).unsqueeze(0),flag_Not_ortho


# def rotmat_to_quat(rot_matrices):
#     inputs = rot_matrices
#     quats = []
#     for rot in rot_matrices:
#         quats.append(per_quats)
#     return torch.from_numpy(np.stack(quats)).to(inputs)


@dataclass
class Gaussians:
    utmmean: Tensor
    hei: Tensor
    means: Tensor
    covariances: Tensor
    harmonics: Tensor
    opacities: Tensor
    scales: Tensor
    rotations: Tensor

@dataclass
class GaussianAdapterCfg:
    gaussian_scale_min: float
    gaussian_scale_max: float
    sh_degree: int


class GaussianAdapter(nn.Module):
    cfg: GaussianAdapterCfg

    def __init__(self, cfg: GaussianAdapterCfg):
        super().__init__()
        self.cfg = cfg

        # Create a mask for the spherical harmonics coefficients. This ensures that at
        # initialization, the coefficients are biased towards having a large DC
        # component and small view-dependent components.
        self.register_buffer(
            "sh_mask",
            torch.ones((self.d_sh,), dtype=torch.float32),
            persistent=False,
        )
        for degree in range(1, self.cfg.sh_degree + 1):
            self.sh_mask[degree**2 : (degree + 1) ** 2] = 0.1 * 0.25**degree

    def forward(
        self,
        data_samples,
        enu2latlon,
        rpc_proj_matrices,
        extrinsics: Float[Tensor, "*#batch 4 4"],
        intrinsics: Float[Tensor, "*#batch 3 3"],
        coordinates: Float[Tensor, "*#batch 2"],
        depths: Float[Tensor, "*#batch"],
        opacities: Float[Tensor, "*#batch"],
        raw_gaussians: Float[Tensor, "*#batch _"],
        image_shape: tuple[int, int],
        eps: float = 1e-8,
    ) -> Gaussians:
        device = extrinsics.device
        scales, rotations, sh = raw_gaussians.split((3, 4, 3 * self.d_sh), dim=-1)
        scales = torch.clamp(F.softplus(scales),min=self.cfg.gaussian_scale_min, max=self.cfg.gaussian_scale_max,)
        img_h, img_w = image_shape
        batch, view, _, _, _, _ = scales.shape
        # Normalize the quaternion features to yield a valid quaternion.
        rotations = rotations / (rotations.norm(dim=-1, keepdim=True) + eps)
        # Apply sigmoid to get valid colors.
        sh = rearrange(sh, "... (xyz d_sh) -> ... xyz d_sh", xyz=3)
        sh = sh.broadcast_to((*opacities.shape, 3, self.d_sh)) * self.sh_mask
        # Create world-space covariance matrices.
        covariances = build_covariance(scales, rotations)
        c2w_rotations = extrinsics[..., :3, :3]
        covariances = c2w_rotations @ covariances @ c2w_rotations.transpose(-1, -2)
        covariances = rearrange(covariances, "b v i () () m n -> b v i m n")

        # Compute Gaussian means.
        x_rpc = coordinates[...,0].reshape(batch*view, -1) * 255
        y_rpc = coordinates[...,1].reshape(batch*view, -1) * 255
        x_rpc, y_rpc = x_rpc.clamp(0,255), y_rpc.clamp(0,255)
        height = depths.reshape(batch*view, -1)
        coef = torch.ones((batch*view, img_h * img_w * 1, 20), dtype=torch.double).to(device)
        lat, lon = RPC_Photo2Obj(x_rpc, y_rpc, height, rpc_proj_matrices.reshape(batch*view, -1), coef)

        ### UTM_ENU
        easts, norths = utm_from_latlon(lat.reshape(-1).cpu().detach().numpy(), lon.reshape(-1).cpu().detach().numpy())
        UTM_combined = torch.from_numpy(np.stack((easts, norths, height.reshape(-1).cpu().detach().numpy()), axis=-1)).to(x_rpc.device)
        UTM_combined = UTM_combined.reshape(1, 3, -1, 3)
        ### UTM_ENU

        # Convert to ENU
        lat0, lon0, alt0 = enu2latlon[0,:,0].unsqueeze(-1).repeat(1, img_h * img_w), enu2latlon[0,:,1].unsqueeze(-1).repeat(1, img_h * img_w), enu2latlon[0,:,2].unsqueeze(-1).repeat(1, img_h * img_w)

        from collections import namedtuple
        Ellipsoid = namedtuple("Ellipsoid", ["semimajor_axis", "semiminor_axis"])
        ELL = Ellipsoid(6378137.0, 6356752.31424518)
        e, n, u = geodetic2enu_torch(lat, lon, height, lat0, lon0, alt0, ELL)
        enu_combined = torch.stack([e, n, u], dim=1)  # shape: [B, 3, V]
        means3d = rearrange(enu_combined, "b v i -> () b i v")

        scales = rearrange(scales, "b v i () () j -> b v i j")
        opacities = rearrange(opacities, "b v i () j -> b v i j")

        fixed_scales  = scales
        extrinsics_to_quat_input = rearrange(extrinsics[..., :3, :3], "b v () () () i j -> b v i j")
        fixed_rotations,flag_Not_ortho = rotmat_to_quat(extrinsics_to_quat_input)

        fixed_rotations = fixed_rotations.unsqueeze(2).expand(-1, -1, means3d.size(2), -1)
        rotate_rgb_harmonics = rearrange(rotate_sh(sh, c2w_rotations[..., None, :, :]), "b v i () () m n -> b v i n m")

        return Gaussians(
            utmmean=UTM_combined.to(dtype=torch.float),
            hei = height.to(dtype=torch.float),
            means=means3d.to(dtype=torch.float),
            covariances= covariances,
            harmonics=rotate_rgb_harmonics.to(dtype=torch.float),
            opacities=opacities.to(dtype=torch.float),
            scales=fixed_scales.to(dtype=torch.float),
            rotations=fixed_rotations.to(dtype=torch.float)
        )

    def get_scale_multiplier(
        self,
        intrinsics: Float[Tensor, "*#batch 3 3"],
        pixel_size: Float[Tensor, "*#batch 2"],
        multiplier: float = 0.1,
    ) -> Float[Tensor, " *batch"]:
        xy_multipliers = (multiplier * torch.einsum(
            "... i j, j -> ... i",
            intrinsics[..., :2, :2].inverse().to(torch.float64),
            pixel_size.to(torch.float64),
        )).to(torch.float64)
        return xy_multipliers.sum(dim=-1).to(torch.float32)


    @property
    def d_sh(self) -> int:
        return (self.cfg.sh_degree + 1) ** 2

    @property
    def d_in(self) -> int:
        return 7 + 3 * self.d_sh
