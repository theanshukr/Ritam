# RITAM GIS & Spatial Architecture

## 1. Core Geographic Foundation
RITAM's mapping architecture relies on **PostGIS** as the ultimate source of truth for spatial data. The frontend employs a robust Leaflet workspace (`SpatialMap.jsx`) handling WGS84 coordinates (EPSG:4326) internally while projecting to Web Mercator (EPSG:3857) for tile rendering.

## 2. Location Selection & Geocoding
The application implements a decoupled geocoding service abstraction (`GeocodingService.js`), currently utilizing **OpenStreetMap Nominatim** to ensure license compliance without hardcoding dependencies on Google Maps. 

The project creation flow supports three unified methods:
1. **Search Place**: Invokes the geocoding service and resolves a bounding box / center coordinate.
2. **Map Click**: Captures precise coordinates from a Leaflet interaction.
3. **Manual Coordinates**: Parses standard latitude/longitude inputs.

All three methods normalize to a standard `projectLocation` state before entering the boundary-drawing phase.

## 3. Project Geometry & Boundary (AOI)
During project creation, users define their Area of Interest (AOI) using **Leaflet Draw**.
- The geometry is extracted as standard GeoJSON.
- The frontend computes area using `@turf/area`.
- The geometry is sent to the FastAPI backend, where it is validated via Shapely and converted to WKT (Well-Known Text).
- It is stored in the PostGIS database using `geoalchemy2` using the `ST_Area` and `ST_GeomFromText` functions, resolving a previous bug where the geometry wasn't properly bound during the SQLAlchemy insertion phase.
- The saved geometry acts as the persistent AOI for all subsequent satellite clipping and analysis.

## 4. Satellite Imagery Architecture & XYZ vs WMTS Evaluation
RITAM currently utilizes a dynamically generated **XYZ Tile Pipeline** via Sentinel Hub evaluation scripts on the backend. 

### WMTS vs XYZ Decision
We evaluated migrating to a pure WMTS (Web Map Tile Service) approach:
- **WMTS Advantages**: Standardized metadata, structured layer capabilities, often better client-side caching in mature GIS clients (like QGIS).
- **XYZ Advantages**: Extreme simplicity, perfect compatibility with Leaflet's `L.tileLayer`, dynamic URL parametrization (allowing us to pass custom `max_cloud_cover` or dynamic time windows directly in the URL), and lower parsing overhead.

**Conclusion**: The existing XYZ pipeline is preserved. WMTS does not offer a *material advantage* for RITAM's highly dynamic, project-specific, cloud-filtered evalscripts. The XYZ structure `/{z}/{x}/{y}?max_cloud_cover=X` is significantly more agile for on-the-fly Sentinel-2 L2A rendering than maintaining complex WMTS GetCapabilities XML overhead. 

## 5. Performance Strategy
- **Viewport-based Loading**: Future tree and evidence markers will query PostGIS using bounding box intersections (`ST_Intersects`) rather than loading the entire dataset.
- **Tile Caching**: Satellite tiles are cached server-side (and aggressively cached in the browser via headers) to prevent redundant upstream Sentinel API calls.
- **Render Optimitations**: React `useEffect` hooks cleanly manage Leaflet layer lifecycles, ensuring stale layers are pruned and memory leaks are avoided during fast pans/zooms.

## 6. High-Resolution Imagery Abstraction
While Sentinel-2 provides 10m resolution suitable for canopy health (NDVI) and regional monitoring, it *cannot* resolve individual trees. RITAM explicitly avoids faking high-resolution zoom levels.
The architecture allows future integration of Drone/High-Res providers via the `ImageryProvider` abstraction. High-res true-color tiles can be registered and placed above Sentinel layers when zoomed past level 15.

## 7. Security Considerations
- No API keys are exposed to the client. The frontend requests all satellite data through the RITAM backend.
- Geocoding uses the backend-agnostic OpenStreetMap endpoint, preventing token leakage.
- User authentication (JWT) applies to all spatial data routes.

## 8. Known Limitations & Next Steps
- Currently, only Polygon/MultiPolygon geometries are stored for Projects. Linear corridors (LineString) support in PostGIS exists but the UI currently restricts to polygons to enforce area-based monitoring.
- Future phases should implement vector-tile loading for massive field evidence datasets.
