from dataclasses import dataclass

from jaxtyping import Float
from torch import Tensor


@dataclass
class Gaussians:
    means: Float[Tensor, "batch gaussian dim"]
    covariances: Float[Tensor, "batch gaussian dim dim"]
    harmonics: Float[Tensor, "batch gaussian 3 d_sh"]
    opacities: Float[Tensor, "batch gaussian"]

@dataclass
class Gaussians_features:
    utmmean: Tensor
    hei: Tensor
    means: Tensor
    scales: Tensor
    rotations: Tensor
    opacities: Tensor
    harmonics: Tensor
    covariances: Tensor
