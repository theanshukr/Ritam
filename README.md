# Ritam — Real-time Infrastructure & Terrestrial Analysis & Monitoring

Ritam is a geospatial intelligence and monitoring platform focused on analyzing satellite imagery across multiple dates using AI models and presenting the results through an interactive 2D map.

---

## 🚀 Key Features Implemented (Phase 1)
- **Leafmap Geospatial Engine:** Interactive 2D map with high-resolution Google Satellite & Hybrid basemaps.
- **Multi-Date Temporal Comparison:** Split-screen slider for comparing landscape & infrastructure changes.
- **AOI Management:** Automated coordinate transforms and bounding box definition.
- **STAC Satellite Ingestion:** Querying Sentinel-2 & Landsat optical imagery by date range and cloud cover.
- **AI-Ready Tiling:** Slicing large satellite scenes into 512×512 chips preserving geospatial metadata.

---

## 🛠️ Quick Start

### 1. Clone & Setup Environment
```bash
git clone https://github.com/<your-username>/Ritam.git
cd Ritam

python -m venv .venv
source .venv/bin/activate  # On Windows: .\.venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Run Satellite Loader & Generate Maps
```bash
python satellite_loader.py
python generate_maps.py
```

### 3. Documentation
See [LEAFMAP_GUIDE.md](LEAFMAP_GUIDE.md) for full architectural documentation.
