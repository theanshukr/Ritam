from dataclasses import dataclass
from functools import cached_property
from pathlib import Path
from typing import Literal
from .dataset import DatasetCfgCommon
from .types import Stage

@dataclass
class DatasetRE10kCfg(DatasetCfgCommon):
    name: Literal["re10k"]
    roots: list[Path]
    baseline_epsilon: float
    max_fov: float
    make_baseline_1: bool
    augment: bool
    test_len: int
    test_chunk_interval: int
    test_times_per_scene: int
    skip_bad_shape: bool = True
    near: float = -1.0
    far: float = -1.0
    baseline_scale_bounds: bool = True
    shuffle_val: bool = True


from torch.utils.data import Dataset
import torch
import numpy as np
import tifffile
import json
from pathlib import Path
import copy
import os

class DatasetRE10k(Dataset):
    cfg: DatasetRE10kCfg
    stage: Stage
    num_views: int = 3

    def __init__(self, cfg: DatasetRE10kCfg, stage: Stage):
        super().__init__()
        self.cfg = cfg
        self.stage = stage

        # near / far
        self.near = cfg.near if cfg.near != -1 else 0.1
        self.far = cfg.far if cfg.far != -1 else 1000.0

        # Collect chunks (all view-0 files)
        self.chunks = []
        for root in cfg.roots:
            root = Path(root) / self.data_stage / "image/0"
            root_chunks = sorted([p for p in root.iterdir() if p.suffix == ".tif"])
            self.chunks.extend(root_chunks)


    def __len__(self):
        return len(self.chunks)


    # We suggest rewriting this function (function: load_one_chunk).
    # Due to the need for data augmentation (random cropping and random view selection, corresponding to different RPC crops),
    # it is preferable to adopt online cropping during training rather than relying on a fixed pre-generated training set.
    # This strategy can significantly increase the effective number of training samples.
    # We plan to use this approach in future training. If you manage to implement and validate the code, feel free to push it to our GitHub repository.
    def load_one_chunk(self, chunk_path: Path):
        results = {}
        results["target"]  = {}
        results["context"] = {}
        filename, cam2img, cam2enu, enu2latlon = [], [], [], []
        hei_min_max, rpc_proj_matrices = [], []
        # The random view selection strategy should be used. Just an example.
        JAX_index = ["RGB_001", "RGB_002", "RGB_003"]
        OMA_index = ["RGB_001", "RGB_002", "RGB_003"]
        ref_filename = str(chunk_path)
        for index_view in range(self.num_views):
            if "JAX" in ref_filename:
                idx = JAX_index
            elif "OMA" in ref_filename:
                idx = OMA_index

            per_filename_path = ref_filename.replace(idx[0], idx[index_view]).replace("/0/", f"/{index_view}/")
            per_rpc_path = per_filename_path.replace("image", "rpc").replace(".tif", "_170.rpc")
            per_cameras_path = per_filename_path.replace("image", "cameras").replace(".tif", ".json")
            per_lat0lon0_path = per_filename_path.replace("image", "cameras_others").replace(".tif", "_enu_observer_latlonalt.json")

            cam_dict = json.load(open(per_cameras_path))
            K = np.array(cam_dict["K"]).reshape((4, 4)).astype(np.float32)
            W2C = np.array(cam_dict["W2C"]).reshape((4, 4)).astype(np.float32)
            C2W = np.linalg.inv(W2C)

            per_rpc, _, _ = load_rpc_as_array(per_rpc_path)
            latlon = np.array(json.load(open(per_lat0lon0_path))).astype(np.float32)

            per_hei_min_max_path = (per_filename_path.replace("/image/", "/height/").replace("_RGB_", "_XYZ_").replace(".tif", "_height_minmax.json"))
            hm_dict = json.load(open(per_hei_min_max_path))
            hm = np.array([hm_dict["min_height"], hm_dict["max_height"]]).astype(np.float32)


            filename.append(per_filename_path)
            cam2img.append(K)
            cam2enu.append(C2W)
            enu2latlon.append(latlon)
            hei_min_max.append(hm)
            rpc_proj_matrices.append(per_rpc)
        # pack arrays
        results["context"]["cam2img"] = np.stack(cam2img)
        results["context"]["cam2enu"] = np.stack(cam2enu)
        results["context"]["enu2latlon"] = np.stack(enu2latlon)
        results["context"]["ori_cam2img"] = copy.deepcopy(results["context"]["cam2img"])
        results["context"]["hei_min_max"] = np.stack(hei_min_max)
        results["context"]["rpc_proj_matrices"] = np.stack(rpc_proj_matrices)
        # load images
        imgs = [tifffile.imread(name).transpose(2, 0, 1) for name in filename]
        img = np.stack(imgs).astype(np.float32) / 255.0
        results["context"]["ref_filename"] = filename
        results["context"]["image"] = img
        results["context"]["img_shape"] = img.shape[:2]
        results["context"]["num_views"] = self.num_views
        # print(filename)
        # load Sgt height
        SAM_feats_list, gt_height_list, height_DAM3_list = [], [], []
        for fn in filename:
            # gt height
            path = fn.replace("/image/", "/height/").replace("_RGB_", "_XYZ_")
            gt = torch.from_numpy(tifffile.imread(path)).float()
            gt_height_list.append(gt)
            # height_DAM3
            path = fn.replace("/image/", "/height_DAM3/").replace("_RGB_", "_XYZ_")
            height_DAM3 = torch.from_numpy(tifffile.imread(path)).float()
            height_DAM3_list.append(height_DAM3)

        results["context"]["gt_height"]  =  np.stack(gt_height_list)
        results["context"]["height"]  =  np.stack(height_DAM3_list)

        if self.stage == "train":
            results["context"]["height"] = np.stack(height_DAM3_list)
        else:
            # --------------------------------------------
            # --------------------------------------------
            target_filename = []
            ref_name = Path(ref_filename).name  # e.g., JAX_Tile_033_RGB_002_crop_0.tif
            parts = ref_name.split("_")
            tile_prefix = "_".join(parts[:3])  # JAX_Tile_033
            crop_suffix = "crop_" + parts[-1]  # crop_0.tif
            base_dir = Path(ref_filename).parent.parent
            for idx in [3,4]:
                view_dir = base_dir / str(idx)
                tif_files = sorted(view_dir.glob("*.tif"))
                matched = [str(f) for f in tif_files if tile_prefix in f.name and crop_suffix in f.name]
                target_filename.append(matched[0])
            target_cam2img, target_cam2enu = [], []
            target_imgs = []
            for fn in target_filename:
                # camera json
                per_cameras_path = fn.replace("image", "cameras").replace(".tif", ".json")
                cam_dict = json.load(open(per_cameras_path))
                K = np.array(cam_dict["K"]).reshape((4, 4)).astype(np.float32)
                W2C = np.array(cam_dict["W2C"]).reshape((4, 4)).astype(np.float32)
                C2W = np.linalg.inv(W2C)
                # image
                img = tifffile.imread(fn).transpose(2, 0, 1).astype(np.float32) / 255.0
                target_cam2img.append(K)
                target_cam2enu.append(C2W)
                target_imgs.append(img)
            results["target"]["cam2img"] = np.stack(target_cam2img)
            results["target"]["cam2enu"] = np.stack(target_cam2enu)
            results["target"]["image"] = np.stack(target_imgs)
            results["target"]["ref_filename"] = target_filename

        return results

    def __getitem__(self, idx: int):
        chunk_path = self.chunks[idx]
        return self.load_one_chunk(chunk_path)


    @property
    def data_stage(self) -> Stage:
        if self.cfg.overfit_to_scene is not None:
            return "test"
        return self.stage

    @cached_property
    def index(self) -> dict[str, Path]:
        merged_index = {}
        data_stages = [self.data_stage]
        if self.cfg.overfit_to_scene is not None:
            data_stages = ("test", "train")
        for data_stage in data_stages:
            for root in self.cfg.roots:
                # Load the root's index.
                with (root / data_stage / "index.json").open("r") as f:
                    index = json.load(f)
                index = {k: Path(root / data_stage / v) for k, v in index.items()}

                # The constituent datasets should have unique keys.
                assert not (set(merged_index.keys()) & set(index.keys()))

                # Merge the root's index into the main index.
                merged_index = {**merged_index, **index}
        return merged_index


def load_rpc_as_array(filepath):
    if os.path.exists(filepath) is False:
        raise Exception("RPC not found! Can not find " + filepath + " in the file system!")

    with open(filepath, 'r') as f:
        all_the_text = f.read().splitlines()

    data = [text.split(' ')[1] for text in all_the_text]
    # print(data)
    data = np.array(data, dtype=np.float64)

    h_min = data[4] - data[9]
    h_max = data[4] + data[9]

    return data, h_max, h_min
