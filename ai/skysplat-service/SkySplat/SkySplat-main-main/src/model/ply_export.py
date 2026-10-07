from pathlib import Path

import numpy as np
import torch
from einops import einsum, rearrange
from jaxtyping import Float
from plyfile import PlyData, PlyElement
from scipy.spatial.transform import Rotation as R
from torch import Tensor


def construct_list_of_attributes(num_rest: int) -> list[str]:
    attributes = ["x", "y", "z", "nx", "ny", "nz"]
    for i in range(3):
        attributes.append(f"f_dc_{i}")
    for i in range(num_rest):
        attributes.append(f"f_rest_{i}")
    attributes.append("opacity")
    for i in range(3):
        attributes.append(f"scale_{i}")
    for i in range(4):
        attributes.append(f"rot_{i}")
    return attributes


def export_ply(
    extrinsics: Float[Tensor, "4 4"],
    means: Float[Tensor, "gaussian 3"],
    scales: Float[Tensor, "gaussian 3"],
    rotations: Float[Tensor, "gaussian 4"],
    harmonics: Float[Tensor, "gaussian 3 d_sh"],
    opacities: Float[Tensor, " gaussian"],
    path: Path,
):
    # Shift the scene so that the median Gaussian is at the origin.
    means = means - means.median(dim=0).values

    # Rescale the scene so that most Gaussians are within range [-1, 1].
    scale_factor = means.abs().quantile(0.95, dim=0).max()
    means = means / scale_factor
    scales = scales / scale_factor

    # Define a rotation that makes +Z be the world up vector.
    rotation = [
        [0, 0, 1],
        [-1, 0, 0],
        [0, -1, 0],
    ]
    rotation = torch.tensor(rotation, dtype=torch.float32, device=means.device)

    # The Polycam viewer seems to start at a 45 degree angle. Since we want to be
    # looking directly at the object, we compose a 45 degree rotation onto the above
    # rotation.
    adjustment = torch.tensor(
        R.from_rotvec([0, 0, -45], True).as_matrix(),
        dtype=torch.float32,
        device=means.device,
    )
    rotation = adjustment @ rotation

    # We also want to see the scene in camera space (as the default view). We therefore
    # compose the w2c rotation onto the above rotation.
    rotation = rotation @ extrinsics[:3, :3].inverse()

    # Apply the rotation to the means (Gaussian positions).
    means = einsum(rotation, means, "i j, ... j -> ... i")

    # Apply the rotation to the Gaussian rotations.
    rotations = R.from_quat(rotations.detach().cpu().numpy()).as_matrix()
    rotations = rotation.detach().cpu().numpy() @ rotations
    rotations = R.from_matrix(rotations).as_quat()
    x, y, z, w = rearrange(rotations, "g xyzw -> xyzw g")
    rotations = np.stack((w, x, y, z), axis=-1)

    # Since our axes are swizzled for the spherical harmonics, we only export the DC
    # band.
    harmonics_view_invariant = harmonics[..., 0]

    dtype_full = [(attribute, "f4") for attribute in construct_list_of_attributes(0)]
    elements = np.empty(means.shape[0], dtype=dtype_full)
    attributes = (
        means.detach().cpu().numpy(),
        torch.zeros_like(means).detach().cpu().numpy(),
        harmonics_view_invariant.detach().cpu().contiguous().numpy(),
        opacities[..., None].detach().cpu().numpy(),
        scales.log().detach().cpu().numpy(),
        rotations,
    )
    attributes = np.concatenate(attributes, axis=1)
    elements[:] = list(map(tuple, attributes))
    path.parent.mkdir(exist_ok=True, parents=True)
    PlyData([PlyElement.describe(elements, "vertex")]).write(path)

def color2feat(color):
    color = color.reshape(-1,3,1)
    color = (color - 0.5) / 0.28209479177387814
    features_dc = color[:, :, 0:1]
    return features_dc

def construct_list_of_attributes2(features_dc, scale, rotation):
    l = ['x', 'y', 'z', 'nx', 'ny', 'nz']
    # All channels except the 3 DC
    for i in range(features_dc.shape[1] * features_dc.shape[2]):
        l.append('f_dc_{}'.format(i))
    l.append('opacity')
    for i in range(scale.shape[1]):
        l.append('scale_{}'.format(i))
    for i in range(rotation.shape[1]):
        l.append('rot_{}'.format(i))
    return l

def save_ply(scene, path):
    xyz = torch.cat([gf.reshape(-1, 3) for gf in scene.utmmean[0]], dim=0).detach().cpu().numpy()
    xyz[:, :2] *= -1
    scale = torch.cat([gf.reshape(-1, 3) for gf in scene.scales[0]], dim=0).detach().cpu().numpy()
    opacities = torch.cat([gf.reshape(-1) for gf in scene.opacities[0]], dim=0)[:, None].detach().cpu().numpy()
    rotation = torch.cat([gf.reshape(-1, 4) for gf in scene.rotations[0]], dim=0).detach().cpu().numpy()
    rgb = torch.cat([gf.reshape(-1, 3) for gf in scene.harmonics[0]], dim=0)
    features_dc = color2feat(rgb)
    f_dc = features_dc.flatten(start_dim=1).detach().cpu().numpy()
    normals = np.zeros_like(xyz)
    # save
    dtype_full = [(attribute, 'f4') for attribute in construct_list_of_attributes2(features_dc, scale, rotation)]
    opacity_mean = np.mean(opacities, axis=1)  # shape: [100]
    scale_norm = np.linalg.norm(scale, axis=1)  # shape: [100]
    scale_norm_mean = scale_norm.mean()
    opacity_thresh = 0.01
    scale_thresh = 1.2
    mask = (opacity_mean > opacity_thresh) & (scale_norm < scale_thresh)
    xyz, normals, f_dc, opacities, scale, rotation = xyz[mask], normals[mask], f_dc[mask], opacities[mask], scale[mask], rotation[mask]
    elements = np.empty(xyz.shape[0], dtype=dtype_full)
    attributes = np.concatenate((xyz, normals, f_dc, opacities, scale, rotation), axis=1)
    elements[:] = list(map(tuple, attributes))
    el = PlyElement.describe(elements, 'vertex')
    PlyData([el]).write(path)