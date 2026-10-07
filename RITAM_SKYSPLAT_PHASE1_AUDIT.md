# SkySplat Phase 1 Audit

## 1. Repository
Exact URL: https://github.com/NanCheng2001/SkySplat-main.git
Exact commit: main branch archive (commit hash pending local git initialization since it was downloaded as a zip due to GCM interference)

## 2. SkySplat Version
Version selected: SkySplat (baseline)
Reason: SkySplatV2 has not yet released its source code (the repository only contains a README and a figure placeholder stating code will be released after paper acceptance). The original SkySplat repository contains the full source and baseline checkpoints.

## 3. SkySplatV2 Comparison
Relevant differences: SkySplatV2 extends the baseline by adding coarse-to-fine Gaussian refinement for large-scale structures and textures. However, since the code is unreleased, it cannot be evaluated or integrated yet.

## 4. Environment
Python: 3.12 (venv)
PyTorch: 2.7.1+cu118 (Downloading)
CUDA: 11.8 (required for diff-gaussian-rasterization-modified)
GPU: NVIDIA GeForce RTX 4050 Laptop GPU
VRAM: ~6 GB

## 5. Dependencies
Complete list: 
wheel, tqdm, pytorch_lightning, black, ruff, hydra-core, jaxtyping, beartype, wandb, einops, colorama, scikit-image, colorspacious, matplotlib, moviepy, imageio, diff-gaussian-rasterization-modified, timm, dacite, lpips, e3nn, plyfile, tabulate, svg.py, opencv-python==4.6.0.66, sk-video, scikit-learn, tifffile, xformers, pymap3d, pillow, imagecodecs, iio, icecream.

## 6. Checkpoint
Checkpoint: SkySplat_baseline.ckpt
Location: `./checkpoints/SkySplat_baseline.ckpt` (included in the main zip)
Size: ~30.7 MB
Status: Downloaded and verified.

## 7. Dataset
Dataset: Official Example Dataset (JAX/OMA subset tiles)
Input structure: 256x256 image crops
Number of views: 3 views (0, 1, 2)
Image requirements: Sparse multi-view satellite images with corresponding RPC geometry.

## 8. RPC
RPC requirements: SatelliteSfM-compatible RPC camera model conversions.
Camera conversion: Converts native RPC into pinhole-compatible `cameras` and `cameras_others` matrices for 3DGS projection.
Coordinate system: Local UTM/Cartesian projection anchored to the first view.

## 9. Inference
Exact command: `CUDA_VISIBLE_DEVICES=0 python -m src.main +experiment=re10k checkpointing.load=checkpoints/SkySplat_baseline.ckpt mode=test`
Execution time: N/A (Failed to execute)
VRAM usage: N/A (Failed to execute)
Result: **FAIL: installation/inference fails, including the exact technical failure.**
*Technical Failure:* The custom `diff-gaussian-rasterization-modified` CUDA extension fails to build. The first meaningful compiler error is: `OSError: CUDA_HOME environment variable is not set. Please set it to your CUDA install root.` The user reported installing the native toolchain, but `nvcc` and `cl` are still absent from the system PATH, and `CUDA_PATH` is empty. The compiler toolchain remains undetectable. Attempting to run inference without the extension throws `ModuleNotFoundError: No module named 'diff_gaussian_rasterization'`.

## 10. Output
Exact output files: None
Representation: None
Coordinate system: None

## 11. Visualization
Viewer used: None
Result: None

## 12. Sentinel-2 Compatibility
Compatible: No.
Not compatible: Yes.
Reason: 
1. **Resolution**: SkySplat (and 3DGS in general) requires sub-meter resolution (e.g., 0.3m–0.5m Maxar/WorldView) to extract meaningful geometric structure. Sentinel-2's 10m/px RGB resolution is far too low for urban or detailed 3D reconstruction.
2. **Viewing Angle**: Sentinel-2 is primarily nadir-looking. Multi-view 3D reconstruction requires off-nadir stereo pairs or varying acquisition angles.
3. **RPC Metadata**: Sentinel-2 L1C/L2A data is already orthorectified and map-projected. It does not provide the raw sensor Rational Polynomial Coefficients (RPC) required by the SatelliteSfM pipeline to compute precise camera geometry.

## 13. Live Imagery Options
| Provider | Resolution | India Coverage | Multi-View | RPC | API | Cost | SkySplat Compatible |
|----------|------------|----------------|------------|-----|-----|------|---------------------|
| Maxar (WorldView) | ~0.3m - 0.5m | Yes | Yes (Stereo/Tri-Stereo) | Yes | SecureWatch / API | High (Commercial) | **Yes** |
| Airbus (Pléiades) | ~0.5m | Yes | Yes (Stereo/Tri-Stereo) | Yes | OneAtlas API | High (Commercial) | **Yes** |
| Planet (SkySat) | ~0.5m | Yes | Yes (Video/Stereo) | Yes | Planet API | High (Commercial) | **Yes** |
| MapTiler Satellite | ~0.5m (mixed) | Yes | No (Orthomosaic only) | No | MapTiler API | Low | No (Orthorectified base maps lack RPCs and multi-view geometry) |

## 14. Hardware Requirements
Minimum observed: (Failed to compile)
Recommended: CUDA Toolkit (NVCC) is strictly required to compile the `diff-gaussian-rasterization-modified` C++/CUDA extension. A GPU with significantly more than 6GB VRAM (e.g., 24GB RTX 3090/4090) is generally recommended for 3DGS.

## 15. Blockers
Actual blockers only: 
1. **Missing CUDA Toolkit (NVCC)**: The system lacks the NVIDIA CUDA Toolkit compiler (`nvcc`), which is an absolute prerequisite to compile the `diff-gaussian-rasterization-modified` package on Windows. The PyTorch pip installation failed on this submodule.
2. **Missing MSVC Build Tools**: Compiling CUDA extensions on Windows requires Microsoft Visual Studio C++ Build Tools, which are not configured in this environment.
3. **VRAM Limitation**: The local RTX 4050 has 6GB of VRAM, which is very likely insufficient to run the 3D Gaussian Splatting rasterizer even if compiled.

## 16. Recommendation & Final Status
Final Result: **FAIL: installation/inference fails, including the exact technical failure.**

Exact next phase: 
**HALTED.** Per strict architectural instructions, we cannot proceed to Phase 2 (Frontend Integration/RITAM AI 3D Service) because Phase 1 (Standalone Inference) has failed due to missing compilation toolchains (`nvcc`). 
Next Steps Required:
- Install NVIDIA CUDA Toolkit 11.8+ on the host machine.
- Install Microsoft Visual Studio C++ Build Tools.
- Alternatively, provision a dedicated Cloud GPU inference machine (e.g., AWS g5.xlarge) to run the `skysplat-service` remotely.
