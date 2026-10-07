from __future__ import annotations

import argparse
import copy
import itertools
import json
import os
import random
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from RPC_170 import RPCModelParameter as RPC170ModelParameter


rmext = lambda x: x[0:x.rfind(".")]

try:
    from icecream import ic
except ImportError:
    def ic(*args):
        return args[0] if len(args) == 1 else args
ic.disable()


# Fixed examples. The default behavior samples
# three available views randomly for each tile. Use --view-mode fixed if you
# want the legacy triplets instead.
DEFAULT_FIXED_VIEW_IDS = {
    "JAX": ["RGB_001", "RGB_002", "RGB_003"],
    "OMA": ["RGB_001", "RGB_002", "RGB_003"],
    "ATL": ["RGB_001", "RGB_002", "RGB_003"],
}


@dataclass
class ViewItem:
    view_slot: int
    image_path: str
    height_path: str
    out_image_dir: str
    out_height_dir: str
    out_rpc_dir: str
    out_camera_dir: str
    out_camera_extra_dir: str
    image: Any
    height: Any
    meta: dict
    rpc_model: RPC170ModelParameter


def build_rpc170_model_from_meta(rpc_dict):
    model = RPC170ModelParameter()
    model.LINE_OFF = float(rpc_dict["rowOff"])
    model.SAMP_OFF = float(rpc_dict["colOff"])
    model.LAT_OFF = float(rpc_dict["latOff"])
    model.LONG_OFF = float(rpc_dict["lonOff"])
    model.HEIGHT_OFF = float(rpc_dict["altOff"])
    model.LINE_SCALE = float(rpc_dict["rowScale"])
    model.SAMP_SCALE = float(rpc_dict["colScale"])
    model.LAT_SCALE = float(rpc_dict["latScale"])
    model.LONG_SCALE = float(rpc_dict["lonScale"])
    model.HEIGHT_SCALE = float(rpc_dict["altScale"])
    model.LNUM = np.asarray(rpc_dict["rowNum"], dtype=np.float64)
    model.LDEM = np.asarray(rpc_dict["rowDen"], dtype=np.float64)
    model.SNUM = np.asarray(rpc_dict["colNum"], dtype=np.float64)
    model.SDEM = np.asarray(rpc_dict["colDen"], dtype=np.float64)
    model.Calculate_Inverse_RPC()
    return model


def project_center(height_off, rpc_model, center_points):
    lat, lon = rpc_model.RPC_PHOTO2OBJ(
        [float(center_points[0])],
        [float(center_points[1])],
        [float(height_off)],
    )
    return lat, lon


def crop_img(img, min_col, min_row, max_col, max_row):
    if img.shape[0] == 3:
        return img[2, min_row:max_row, min_col:max_col]
    return img[min_row:max_row, min_col:max_col]


def adjust_crop_bounds(min_col, min_row, max_col, max_row, img_height, img_width, crop_size=256):
    if img_width < crop_size or img_height < crop_size:
        raise ValueError(
            f"Image size {img_width}x{img_height} is smaller than crop size {crop_size}."
        )

    if min_col < 0:
        min_col = 0
        max_col = crop_size
    elif max_col > img_width:
        max_col = img_width
        min_col = img_width - crop_size

    if min_row < 0:
        min_row = 0
        max_row = crop_size
    elif max_row > img_height:
        max_row = img_height
        min_row = img_height - crop_size

    return min_col, min_row, max_col, max_row


def read_gdal_path(height_path):
    from osgeo import gdal

    dataset_height = gdal.Open(height_path, gdal.GA_ReadOnly)
    if dataset_height is None:
        missing = [
            path
            for dataset, path in [(dataset_height, height_path)]
            if dataset is None
        ]
        raise FileNotFoundError(f"Unable to open raster file(s): {missing}")
    height = dataset_height.ReadAsArray()
    dataset_height = None
    return height


def make_companion_paths(image_path):
    return {
        "height": image_path.replace("image", "height").replace("RGB", "XYZ"),
        "rpc": image_path.replace("image", "rpc").replace(".tif", "_170.rpc"),
    }


def ensure_dirs(paths):
    for path in paths:
        os.makedirs(path, exist_ok=True)


def output_dirs(output_root, split_name, slot):
    base = os.path.join(output_root, split_name)
    return {
        "image": os.path.join(base, "image", str(slot)),
        "height": os.path.join(base, "height", str(slot)),
        "rpc": os.path.join(base, "rpc", str(slot)),
        "camera": os.path.join(base, "cameras", str(slot)),
        "camera_extra": os.path.join(base, "cameras_others", str(slot)),
    }


def build_view_item(image_path, view_slot, output_root, split_name):
    from preprocess.parse_tif_image import parse_tif_image

    paths = make_companion_paths(image_path)
    out_dirs = output_dirs(output_root, split_name, view_slot)
    ensure_dirs(out_dirs.values())

    required = [image_path, paths["height"]]
    missing = [path for path in required if not os.path.exists(path)]
    if missing:
        raise FileNotFoundError(f"Missing files for view {image_path}: {missing}")

    image, meta = parse_tif_image(image_path)
    height = read_gdal_path(paths["height"])
    return ViewItem(
        view_slot=view_slot,
        image_path=image_path,
        height_path=paths["height"],
        out_image_dir=out_dirs["image"],
        out_height_dir=out_dirs["height"],
        out_rpc_dir=out_dirs["rpc"],
        out_camera_dir=out_dirs["camera"],
        out_camera_extra_dir=out_dirs["camera_extra"],
        image=image,
        height=height,
        meta=meta,
        rpc_model=build_rpc170_model_from_meta(meta["rpc"]),
    )


def rpc_to_cameras(latlonalt_bbx, item, out_folder, out_others_folder, img_size, meta_dict, use_srtm4=True):
    import numpy as np

    from preprocess.approximate_rpc_locally import approximate_rpc_locally
    from preprocess.coordinate_system import latlonalt_to_enu

    altitude = resolve_height_off(
        float(np.mean(latlonalt_bbx["lon_minmax"])),
        float(np.mean(latlonalt_bbx["lat_minmax"])),
        float(np.min(latlonalt_bbx["alt_minmax"])),
        use_srtm4=use_srtm4,
    )
    latlonalt_bbx["alt_minmax"] = [altitude - 10, 300]
    ic("altitude range: ", latlonalt_bbx["alt_minmax"])

    with open(os.path.join(out_others_folder, f"{item}_latlonalt_bbx.json"), "w") as fp:
        json.dump(latlonalt_bbx, fp, indent=2)
    ic(latlonalt_bbx)
    lat_minmax = latlonalt_bbx["lat_minmax"]
    lon_minmax = latlonalt_bbx["lon_minmax"]
    alt_minmax = latlonalt_bbx["alt_minmax"]
    observer_lat = (lat_minmax[0] + lat_minmax[1]) / 2.0
    observer_lon = (lon_minmax[0] + lon_minmax[1]) / 2.0
    observer_alt = np.min(alt_minmax) - 20.0
    with open(os.path.join(out_others_folder, f"{item}_enu_observer_latlonalt.json"), "w") as fp:
        json.dump([observer_lat, observer_lon, observer_alt], fp)
    ic(observer_lat, observer_lon, observer_alt)

    latlonalt_pts = np.array(list(itertools.product(list(lat_minmax), list(lon_minmax), list(alt_minmax))))
    e, n, u = latlonalt_to_enu(
        latlonalt_pts[:, 0],
        latlonalt_pts[:, 1],
        latlonalt_pts[:, 2],
        observer_lat,
        observer_lon,
        observer_alt,
    )
    enu_bbx = {
        "e_minmax": [np.min(e), np.max(e)],
        "n_minmax": [np.min(n), np.max(n)],
        "u_minmax": [np.min(u) - 10.0, np.max(u) + 10.0],
    }
    with open(os.path.join(out_others_folder, f"{item}_enu_bbx.json"), "w") as fp:
        json.dump(enu_bbx, fp, indent=2)
    ic(enu_bbx)

    with open(os.path.join(out_others_folder, item + ".json"), "w") as fp:
        json.dump(meta_dict, fp, indent=2)
    K, W2C = approximate_rpc_locally(
        meta_dict,
        lat_minmax,
        lon_minmax,
        alt_minmax,
        observer_lat,
        observer_lon,
        observer_alt,
    )

    cam_dict = {
        "K": K.flatten().tolist(),
        "W2C": W2C.flatten().tolist(),
        "img_size": img_size,
    }
    with open(os.path.join(out_folder, item + ".json"), "w") as fp:
        json.dump(cam_dict, fp, indent=2)


def resolve_height_off(lon, lat, fallback_height, use_srtm4=True):
    if not use_srtm4:
        return fallback_height
    try:
        import srtm4

        height = srtm4.srtm4(lon, lat)
        if height is None or not np.isfinite(height):
            return fallback_height
        return height
    except Exception as exc:
        print(f"Warning: SRTM4 height lookup failed ({exc}); using RPC HEIGHT_OFF={fallback_height}.")
        return fallback_height


def save_cropped_view(view, bounds, flag_block, pinhole_size, latlonalt_bbx, use_srtm4=True):
    import tifffile

    min_col, min_row, max_col, max_row = bounds

    image_crop = crop_img(view.image, min_col, min_row, max_col, max_row)
    height_crop = crop_img(view.height, min_col, min_row, max_col, max_row)

    crop_image_name = Path(view.image_path).name.replace(".tif", f"_crop_{flag_block}.tif")
    crop_height_name = Path(view.height_path).name.replace(".tif", f"_crop_{flag_block}.tif")
    crop_rpc_name = Path(view.image_path).name.replace(".tif", f"_crop_{flag_block}_170.rpc")

    crop_image_path = os.path.join(view.out_image_dir, crop_image_name)
    crop_rpc_path = os.path.join(view.out_rpc_dir, crop_rpc_name)

    tifffile.imwrite(crop_image_path, image_crop)
    tifffile.imwrite(os.path.join(view.out_height_dir, crop_height_name), height_crop)

    crop_rpc_model = copy.deepcopy(view.rpc_model)
    crop_rpc_model.LINE_OFF -= min_row
    crop_rpc_model.SAMP_OFF -= min_col
    crop_rpc_model.save_dirpc_to_file(crop_rpc_path)

    meta_dict_new = copy.deepcopy(view.meta)
    meta_dict_new["rpc"]["rowOff"] = view.meta["rpc"]["rowOff"] - min_row
    meta_dict_new["rpc"]["colOff"] = view.meta["rpc"]["colOff"] - min_col
    meta_dict_new["height"] = pinhole_size
    meta_dict_new["width"] = pinhole_size

    item = Path(crop_image_path).stem
    rpc_to_cameras(
        latlonalt_bbx,
        item,
        view.out_camera_dir,
        view.out_camera_extra_dir,
        [pinhole_size, pinhole_size],
        meta_dict_new,
        use_srtm4=use_srtm4,
    )


def crop_everything(pinhole_size, views, crop_size=256, run_sfm=False, use_srtm4=True):
    if len(views) != 3:
        raise ValueError(f"Expected exactly 3 views, got {len(views)}.")

    ref_view = views[0]
    height_off = ref_view.rpc_model.HEIGHT_OFF

    height = ref_view.meta["height"]
    width = ref_view.meta["width"]
    h_blocks = height // crop_size
    w_blocks = width // crop_size
    flag_block = 0

    for i in range(h_blocks):
        for j in range(w_blocks):
            center_x = j * crop_size + crop_size // 2
            center_y = i * crop_size + crop_size // 2

            lat, lon = ref_view.rpc_model.RPC_PHOTO2OBJ(
                [float(center_x)],
                [float(center_y)],
                [float(height_off)],
            )
            lon0 = float(np.asarray(lon).reshape(-1)[0])
            lat0 = float(np.asarray(lat).reshape(-1)[0])
            height_off = resolve_height_off(lon0, lat0, float(height_off), use_srtm4=use_srtm4)

            bounds_by_view = []
            for view_idx, view in enumerate(views):
                view_height = view.meta["height"]
                view_width = view.meta["width"]
                if view_idx == 0:
                    min_col = j * crop_size
                    min_row = i * crop_size
                else:
                    sample, line = view.rpc_model.RPC_OBJ2PHOTO(lat, lon, height_off)
                    sample0 = float(np.asarray(sample).reshape(-1)[0])
                    line0 = float(np.asarray(line).reshape(-1)[0])
                    min_col = int(sample0 - crop_size // 2)
                    min_row = int(line0 - crop_size // 2)
                max_col = min_col + crop_size
                max_row = min_row + crop_size
                bounds = adjust_crop_bounds(
                    min_col,
                    min_row,
                    max_col,
                    max_row,
                    img_height=view_height,
                    img_width=view_width,
                    crop_size=crop_size,
                )
                bounds_by_view.append(bounds)

            ref_rpc_path = os.path.join(
                ref_view.out_rpc_dir,
                Path(ref_view.image_path).name.replace(".tif", f"_crop_{flag_block}_170.rpc"),
            )
            ref_min_col, ref_min_row, ref_max_col, ref_max_row = bounds_by_view[0]

            # Build one shared geographic bounding box so all views use the same ENU origin.
            ref_rpc_model = copy.deepcopy(ref_view.rpc_model)
            ref_rpc_model.LINE_OFF -= ref_min_row
            ref_rpc_model.SAMP_OFF -= ref_min_col
            ref_rpc_model.save_dirpc_to_file(ref_rpc_path)

            left_points = [0, 0]
            right_points = [pinhole_size, pinhole_size]
            llat, llon = project_center(height_off, ref_rpc_model, left_points)
            rlat, rlon = project_center(height_off, ref_rpc_model, right_points)
            lat_min, lat_max = min(llat, rlat), max(llat, rlat)
            lon_min, lon_max = min(llon, rlon), max(llon, rlon)
            latlonalt_bbx = {
                "lat_minmax": [float(np.asarray(lat_min).reshape(-1)[0]) - 0.001, float(np.asarray(lat_max).reshape(-1)[0]) + 0.001],
                "lon_minmax": [float(np.asarray(lon_min).reshape(-1)[0]) - 0.001, float(np.asarray(lon_max).reshape(-1)[0]) + 0.001],
                "alt_minmax": [50, 300],
            }

            for view, bounds in zip(views, bounds_by_view):
                save_cropped_view(
                    view,
                    bounds,
                    flag_block,
                    pinhole_size,
                    latlonalt_bbx.copy(),
                    use_srtm4=use_srtm4,
                )

            if run_sfm:
                run_sfm_for_crop(views, flag_block)

            flag_block += 1


def parse_site_name(filename):
    match = re.match(r"^(JAX|OMA|ATL)_", filename)
    if not match:
        return None
    return match.group(1)


def extract_view_id(filename):
    match = re.search(r"RGB_\d{3}", filename)
    if not match:
        return None
    return match.group(0)


def replace_view_id(filename, view_id):
    current = extract_view_id(filename)
    if current is None:
        raise ValueError(f"Cannot find RGB view ID in filename: {filename}")
    return filename.replace(current, view_id)


def discover_available_views(split_path, ref_image_name, max_slots=128):
    available = []
    seen_view_ids = set()
    for slot in range(max_slots):
        slot_dir = os.path.join(split_path, "image", str(slot))
        if not os.path.isdir(slot_dir):
            continue
        for item in sorted(os.listdir(slot_dir)):
            if not item.endswith(".tif") or item.startswith("Thumbs"):
                continue
            ref_view = extract_view_id(ref_image_name)
            item_without_view = item.replace(extract_view_id(item), "<VIEW>")
            ref_without_view = ref_image_name.replace(ref_view, "<VIEW>")
            if item_without_view != ref_without_view:
                continue
            view_id = extract_view_id(item)
            if view_id and view_id not in seen_view_ids:
                available.append((slot, view_id, os.path.join(slot_dir, item)))
                seen_view_ids.add(view_id)
    return available


def choose_views(split_path, ref_image_name, site_name, view_mode, rng):
    available = discover_available_views(split_path, ref_image_name)
    if len(available) < 3:
        raise ValueError(f"Need at least 3 views for {ref_image_name}; found {len(available)}.")

    # Keep the original reference view first when it is available. This preserves
    # the old crop-grid behavior while still randomizing the two companion views.
    ref_view_id = extract_view_id(ref_image_name)
    ref_view = next((item for item in available if item[1] == ref_view_id), None)

    if view_mode == "fixed":
        fixed_ids = DEFAULT_FIXED_VIEW_IDS.get(site_name)
        if fixed_ids is None:
            raise ValueError(f"No fixed view list is configured for site {site_name}.")
        fixed = []
        by_id = {view_id: (slot, view_id, path) for slot, view_id, path in available}
        missing = [view_id for view_id in fixed_ids if view_id not in by_id]
        if missing:
            raise FileNotFoundError(f"Fixed views are unavailable for {ref_image_name}: {missing}")
        for view_id in fixed_ids:
            fixed.append(by_id[view_id])
        return fixed

    if ref_view is None:
        return rng.sample(available, 3)

    companions = [item for item in available if item[1] != ref_view_id]
    if len(companions) < 2:
        raise ValueError(f"Need at least two companion views for {ref_image_name}; found {len(companions)}.")
    return [ref_view] + rng.sample(companions, 2)


def import_sfm_runner():
    try:
        from preprocess_sfm.preprocess_sfm import preprocess_sfm
    except (ImportError, AssertionError) as exc:
        raise RuntimeError(
            "SFM bundle adjustment requires optional dependencies and a built "
            "preprocess_sfm/ColmapForVisSat installation. Run without --run_sfm "
            "to use RPC-only cameras."
        ) from exc
    return preprocess_sfm


def run_sfm_for_crop(views, flag_block):
    import imageio.v2 as imageio
    import shutil

    preprocess_sfm = import_sfm_runner()
    sfm_root = os.path.join(
        Path(views[0].out_image_dir).parents[1],
        "sfm",
        f"{Path(views[0].image_path).stem}_crop_{flag_block}",
    )
    image_dir = os.path.join(sfm_root, "images")
    camera_dir = os.path.join(sfm_root, "cameras")
    os.makedirs(image_dir, exist_ok=True)
    os.makedirs(camera_dir, exist_ok=True)

    for view in views:
        image_name = Path(view.image_path).name.replace(".tif", f"_crop_{flag_block}.tif")
        stem = Path(image_name).stem
        tif_path = os.path.join(view.out_image_dir, image_name)
        camera_path = os.path.join(view.out_camera_dir, stem + ".json")
        png_name = f"{view.view_slot}_{stem}.png"
        camera_name = f"{view.view_slot}_{stem}.json"
        imageio.imwrite(os.path.join(image_dir, png_name), imageio.imread(tif_path))
        shutil.copy2(camera_path, os.path.join(camera_dir, camera_name))

    preprocess_sfm(sfm_root)


def process_split(args, split_name, rng):
    split_path = os.path.join(args.input_folder, split_name)
    ref_dir = os.path.join(split_path, "image", "0")
    if not os.path.isdir(ref_dir):
        raise FileNotFoundError(f"Reference image folder does not exist: {ref_dir}")

    all_ref_images = [
        item for item in sorted(os.listdir(ref_dir))
        if item.endswith(".tif") and "Thumbs" not in item
    ]
    if args.max_tiles is not None:
        all_ref_images = all_ref_images[:args.max_tiles]

    for ref_image_name in all_ref_images:
        site_name = parse_site_name(ref_image_name)
        if site_name is None:
            print(f"Skip unsupported site name: {ref_image_name}")
            continue

        selected_views = choose_views(split_path, ref_image_name, site_name, args.view_mode, rng)
        print(f"{ref_image_name}: selected {[view_id for _, view_id, _ in selected_views]}")

        views = [
            build_view_item(image_path, out_slot, args.output_folder, split_name)
            for out_slot, (_, _, image_path) in enumerate(selected_views)
        ]
        crop_everything(
            args.pinhole_size,
            views,
            crop_size=args.crop_size,
            run_sfm=args.run_sfm,
            use_srtm4=not args.disable_srtm4,
        )


def build_arg_parser():
    parser = argparse.ArgumentParser(
        description="Create cropped multi-view satellite samples with RPC-derived camera files."
    )
    parser.add_argument("--input_folder", type=str, required=True, help="Dataset root containing train/test folders.")
    parser.add_argument("--output_folder", type=str, required=True, help="Folder for generated crops and cameras.")
    parser.add_argument("--splits", nargs="+", default=["test"], help="Dataset splits to process, for example train test.")
    parser.add_argument("--crop_size", type=int, default=256, help="Crop size in pixels.")
    parser.add_argument("--pinhole_size", type=int, default=256, help="Image size used for local pinhole fitting.")
    parser.add_argument(
        "--view-mode",
        choices=["random", "fixed"],
        default="random",
        help="Randomly sample three available views, or use the documented fixed legacy views.",
    )
    parser.add_argument("--seed", type=int, default=0, help="Random seed for view sampling.")
    parser.add_argument("--max_tiles", type=int, default=None, help="Optional cap for quick smoke tests.")
    parser.add_argument("--enable_debug", action="store_true", default=False, help="Reserved for debug visualizations.")
    parser.add_argument(
        "--disable_srtm4",
        action="store_true",
        default=False,
        help="Use RPC HEIGHT_OFF directly instead of querying/downloading SRTM4 elevation tiles.",
    )
    parser.add_argument(
        "--run_sfm",
        action="store_true",
        default=False,
        help="Run ColmapForVisSat bundle adjustment after crop/camera generation. This is off by default.",
    )
    return parser


def main():
    args = build_arg_parser().parse_args()
    if args.enable_debug:
        ic.enable()
    rng = random.Random(args.seed)
    ic(args)
    for split_name in args.splits:
        process_split(args, split_name, rng)


if __name__ == "__main__":
    main()
    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(0)
