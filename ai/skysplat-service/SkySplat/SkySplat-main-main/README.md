# SkySplat: Generalizable 3D Gaussian Splatting from Multi-Temporal Sparse Satellite Images

![Python](https://img.shields.io/badge/Python-3.9+-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![GitHub stars](https://img.shields.io/github/stars/<用户名>/<仓库名>?style=social)

SkySplat GitHub repository is the official implementation of the AAAI 2026 paper “SkySplat”.
It is a 3D Gaussian Splatting framework for sparse-view satellite image reconstruction from multi-temporal remote sensing imagery.


## ✨ Overview

SkySplat addresses multi-temporal sparse-view satellite reconstruction by integrating the RPC camera model into a generalizable 3D Gaussian Splatting pipeline.

<p align="center"> <img src="paper/fig2.jpg" width="100%" alt="Overview"> </p>

## 🚀 Key Features
- **RPC-aware 3D Gaussian Splatting** for satellite-specific geometric modeling.
 
- **Self-supervised learning** with radiometric-robust relative height supervision (no ground-truth labels required)
 
- **Efficient inference**, achieving up to 86× speedup over per-scene optimization methods (e.g., EOGS)

## 📊 Results
<p align="center"> <img src="paper/fig1.jpg" width="100%" alt="Results"> </p>

- **Strong performanceDFC19**: MAE reduced from 13.18 m → 1.80 m with 3.19s!

- **Strong generalization**: consistent performance on MVS3D benchmark

## ⚙️ Setup
Before training, modify the dataset path in:
```
config/experiment/re10k.yaml
```

Then update:
```
dataset:
  roots: /path/to/your/dataset
```

## 🏋️ Training

Run training with:
```
CUDA_VISIBLE_DEVICES=0 python -m src.main +experiment=re10k data_loader.train.batch_size=1
```

## 🚀 Inference

Run evaluation on a trained checkpoint:
```
CUDA_VISIBLE_DEVICES=0 python -m src.main +experiment=re10k checkpointing.load=Path_ckpt mode=test
```


## 🔥 Pretrained Baseline Checkpoint

We have released the baseline pretrained weights for SkySplat:
```
./checkpoints/SkySplat_baseline.ckpt
```
Please note that this checkpoint is retrained on an optimized version of the dataset. We recommend using this model as a standard baseline for benchmarking and reproduction, as it is also adopted as the baseline in our subsequent work for consistency.


## 📁 Dataset

SkySplat is trained exclusively on the public US3D dataset, including the following subsets:
```
JAX-Extra, JAX-Train, JAX-Val
OMA-Extra, OMA-Train, OMA-Val
```
The dataset is publicly available at:

👉 https://ieee-dataport.org/open-access/urban-semantic-3d-dataset

## 🛠️ Dataset Preparation (CreateDataset)

SkySplat provides an official dataset preparation script under:
```
SkySplat-main/CreateDataset
```
The pipeline (adapted from SatelliteSfM) crops 2048×2048 multi-view satellite tiles into 256×256 samples and generates ```image/, height/, rpc/, cameras/, and cameras_others/```, which are directly compatible with SkySplat.
```
Example
python satellite_sfm_crop2048to256.py \
  --input_folder ./CreatDataset/example/input2048 \
  --output_folder ./CreatDataset/example/output256
```
For detailed usage and examples, please refer to SkySplat-main/CreateDataset/README.md.

## 🛰️ RPC camera models Processing (Important)

SkySplat relies on RPC camera models for satellite image geometry.
To convert RPC imagery into pinhole-hole camera representations, we follow the pipeline from:

👉 https://github.com/Kai-46/SatelliteSfM

This process generates:

```
dataset/
├── cameras/
├── cameras_others/
```

These camera files are required for training and inference.

## 📐 Optional: Depth Projection

If depth maps need to be generated from height maps, projection can be performed using camera geometry from the RPC-to-pinhole conversion step.

## 📝 TODO
In the coming period, we plan to release the following resources to facilitate easier testing and debugging of SkySplat:
- ✅ **Dataset generation code with a sample dataset.**  
  We have released the official dataset preparation scripts along with one example dataset to help users understand the data format and generation process.

## 🙏 Acknowledgement
We acknowledge that this work is built upon and benefits from the following open-source projects:

- [MVSplat](https://github.com/donydchen/mvsplat)  
- [SatMVS](https://github.com/WHU-GPCV/SatMVS)

We thank the authors for their contributions to the community.

## 💳 Citation

If your work uses all or part of this code, please cite:
```
@inproceedings{huang2026skysplat,
  title={SkySplat: Generalizable 3D Gaussian splatting from multi-temporal sparse satellite images},
  author={Huang, Xuejun and Liu, Xinyi and Wan, Yi and Zheng, Zhi and Zhang, Bin and Xiong, Mingtao and Pei, Yingying and Zhang, Yongjun},
  booktitle={Proceedings of the AAAI Conference on Artificial Intelligence},
  volume={40},
  number={7},
  pages={5158--5166},
  year={2026}
}
```

You can find our [paper on AAAI2026 and arxiv 📄](https://ojs.aaai.org/index.php/AAAI/article/view/37430).
