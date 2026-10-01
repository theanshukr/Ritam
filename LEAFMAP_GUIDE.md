# 🛰️ Ritam Leafmap Geospatial Guide & Architecture

## 1. Overview
In **Ritam** (*Real-time Infrastructure & Terrestrial Analysis & Monitoring*), **Leafmap** serves as the primary **Python Geospatial, Satellite Ingestion, and 2D Interactive Map Engine**.

Leafmap connects the raw satellite data layer with the Hugging Face AI pipeline and interactive user interface.

---

## 2. Core Capabilities Implemented & Tested in Ritam

| Feature | Description | Generated Test Map |
| :--- | :--- | :--- |
| **1. STAC Satellite Query** | Search Sentinel-2 & Landsat optical imagery by **Date Range**, **AOI Bounding Box**, and **Max Cloud Filter**. | Tested via STAC API |
| **2. Multi-Date Split Slider** | Side-by-side split screen with an interactive swipe slider comparing satellite scenes across two dates. | [`data/suite_split_comparison.html`](file:///d:/Projects/Ritam/data/suite_split_comparison.html) |
| **3. Spectral Indices (NDVI)** | Computes Normalized Difference Vegetation Index from Red & NIR bands with colormap legend. | [`data/suite_spectral_ndvi_map.html`](file:///d:/Projects/Ritam/data/suite_spectral_ndvi_map.html) |
| **4. Interactive AOI Drawing** | Allows users to draw custom polygons, rectangles, and markers directly on the map to define AOIs. | [`data/suite_interactive_drawing.html`](file:///d:/Projects/Ritam/data/suite_interactive_drawing.html) |
| **5. Synced Multi-Temporal Maps** | Dual side-by-side synchronized view showing optical satellite view alongside infrastructure/roads. | [`data/suite_synced_timemaps.html`](file:///d:/Projects/Ritam/data/suite_synced_timemaps.html) |
| **6. AI-Ready Tiling / Chipping** | Cuts large satellite scenes into 512×512 image tiles preserving geospatial coordinates and affine transforms. | [`data/chips/`](file:///d:/Projects/Ritam/data/chips) |
| **7. Vector GeoJSON Inspection** | Renders AI-detected building/infrastructure polygons with interactive metadata popups & change states. | [`data/suite_vector_inspection.html`](file:///d:/Projects/Ritam/data/suite_vector_inspection.html) |

---

## 3. Code Architecture & Modules

```
d:/Projects/Ritam/
├── satellite_loader.py         # AOI dataclass, GeoTIFF ingestion, CRS reprojections
├── ritam_temporal_explorer.py  # STAC API connector & multi-date search
├── ritam_leafmap_suite.py      # Master suite executing all 7 Leafmap capabilities
├── LEAFMAP_GUIDE.md            # This complete technical reference guide
└── data/                       # Cached rasters, AI chips, and interactive HTML maps
    ├── sample_satellite.tif    # 4-band satellite scene (RGB + NIR)
    ├── ndvi_index.tif          # Computed NDVI spectral raster
    ├── chips/                  # 512x512 AI-ready GeoTIFF chips
    ├── suite_split_comparison.html
    ├── suite_spectral_ndvi_map.html
    ├── suite_interactive_drawing.html
    ├── suite_synced_timemaps.html
    └── suite_vector_inspection.html
```

---

## 4. Usage Examples & Workflows

### A. Searching Satellite Data for a Specific Date & AOI
```python
from ritam_leafmap_suite import RitamLeafmapMasterSuite

suite = RitamLeafmapMasterSuite()
# Search Sentinel-2 optical imagery for Delhi NCR during Q1 2024 with < 10% clouds
scenes = suite.search_stac_scenes(
    bbox=(77.05, 28.45, 77.35, 28.75),
    date_range="2024-01-01/2024-03-31",
    collection="sentinel-2-l2a",
    max_clouds=10,
    max_items=3
)
for scene in scenes:
    print(f"Date: {scene['datetime']} | Clouds: {scene['cloud_cover']}% | ID: {scene['id']}")
```

### B. Generating Multi-Date Split Comparison Map
```python
suite.generate_multidate_split_map(
    center=(28.6139, 77.2090),
    left_label="Date 1 (2023 Satellite)",
    right_label="Date 2 (2024 Hybrid)",
    output_html="data/suite_split_comparison.html"
)
```

### C. Calculating Spectral Vegetation & Construction Indices
```python
# Calculates (NIR - Red) / (NIR + Red) and saves color-coded map
suite.compute_and_map_spectral_indices(
    raster_path="data/sample_satellite.tif",
    output_ndvi_path="data/ndvi_index.tif",
    output_map_html="data/suite_spectral_ndvi_map.html"
)
```

### D. Chipping Rasters for Hugging Face AI Models
```python
# Slices satellite raster into 512x512 chips preserving affine transforms
chips = suite.generate_ai_chips(
    raster_path="data/sample_satellite.tif",
    chip_size=512,
    output_chips_dir="data/chips"
)
```

---

## 5. How to Launch & Test the Interactive Maps

Run any of the following commands in PowerShell to open the interactive maps directly in your browser:

```powershell
# 1. Multi-Date Split Swipe Map
Start-Process "d:\Projects\Ritam\data\suite_split_comparison.html"

# 2. Spectral NDVI Vegetation & Built-Up Map
Start-Process "d:\Projects\Ritam\data\suite_spectral_ndvi_map.html"

# 3. Interactive AOI Drawing & Measurement Tool
Start-Process "d:\Projects\Ritam\data\suite_interactive_drawing.html"

# 4. Synced Dual Multi-Temporal View
Start-Process "d:\Projects\Ritam\data\suite_synced_timemaps.html"

# 5. AI Vector Detections & Inspection Layer
Start-Process "d:\Projects\Ritam\data\suite_vector_inspection.html"
```

---

## 6. Next Phase: Hugging Face AI Pipeline Integration
With Leafmap's complete satellite ingestion, tiling, and 2D map visualization confirmed working, the next step is connecting Hugging Face AI models (e.g. SegFormer / Mask2Former / YOLO) to process the 512×512 chips and automatically output vector polygons back into Leafmap.
