# RITAM Geospatial Map Architecture

## Overview
RITAM's mapping system utilizes a "Dual-Layer Architecture" to provide high-performance visual navigation alongside high-fidelity environmental analysis. 

### 1. Visual Base Maps (MapTiler)
- **Role:** Primary navigation and visual context.
- **Provider:** MapTiler (via CDN).
- **Styles:** Satellite (High Res), Hybrid (Labels), Streets (Vector).
- **Performance:** Sub-second tile loading, continuous zooming up to zoom level 20, fluid panning.
- **Implementation:** Standard Leaflet `L.tileLayer` pointing to MapTiler XYZ endpoints.

### 2. Analytical Overlays (Sentinel-2)
- **Role:** Environmental monitoring, NDVI vegetation analysis, True Color temporal comparison.
- **Provider:** Sentinel Hub (via RITAM FastAPI Backend).
- **Rendering:** Bounding-box image overlays (`L.imageOverlay`) scoped exactly to project boundaries.
- **Resolution:** Native 10m/px.
- **Features:**
  - **NDVI Overlay:** Color-mapped index showing vegetation health (red to green scale).
  - **True Color Overlay:** Cloud-filtered optical imagery for temporal comparison.
  - **Change Detection:** Automated vegetation loss/gain analysis.

## Key Design Principles
- **Separation of Concerns:** Do not use heavy analytical satellite pipelines (like Sentinel-2) for general map navigation.
- **Resolution Honesty:** Sentinel-2 imagery is not upscaled beyond its native optical ceiling (Zoom 14).
- **Cost Efficiency:** MapTiler tiles are cheap and CDN-cached. Sentinel Hub processing units are conserved strictly for bounding-box analytical queries.

## API Key Management
MapTiler requires an API key which is stored in `.env` as `VITE_MAPTILER_API_KEY`.
Sentinel Hub credentials are kept securely on the backend in `.env`.
