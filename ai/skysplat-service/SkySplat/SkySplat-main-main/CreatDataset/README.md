# CreatDataset

This dataset conversion code is adapted from [SatelliteSfM](https://github.com/Kai-46/SatelliteSfM). It crops 2048x2048 multi-view satellite tiles into 256x256 samples and writes:

```text
image/
height/
rpc/
cameras/
cameras_others/
```

RPC parameters are read from TIFF metadata; cropped `_170.rpc` files are generated automatically.

## Example

```bash
python satellite_sfm_crop2048to256.py \
  --input_folder ./CreatDataset/example/input2048 \
  --output_folder ./CreatDataset/example/output256
```

PyCharm parameters:

```text
--input_folder ./CreatDataset/example/input2048 --output_folder ./CreatDataset/example/output256
```

## Options

- Random views: default behavior.
- Fixed views: add `--view-mode fixed`.
- Avoid SRTM downloads: add `--disable_srtm4`.
- Process another split: add `--splits train` or `--splits test`.

## SFM

```bash
python satellite_sfm_crop2048to256.py --input_folder /path/to/input2048 --output_folder /path/to/output256 --run_sfm
```

For SFM details, see the original [SatelliteSfM](https://github.com/Kai-46/SatelliteSfM) project and the code under `preprocess_sfm/`.
