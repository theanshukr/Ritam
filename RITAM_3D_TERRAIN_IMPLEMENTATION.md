# RITAM 3D Terrain Implementation

## 1. 3D Architecture
The new 3D architecture operates alongside the existing 2D Leaflet map, isolated via a parent wrapper component.
- **2D Mode**: `Leaflet` + MapTiler raster tiles.
- **3D Mode**: `@maptiler/sdk` (wrapping MapLibre-GL WebGL) + MapTiler style sheets + MapTiler RGB Terrain.

## 2. Rendering Engine Used
We utilized `@maptiler/sdk`, which is a lightweight, heavily optimized wrapper over `maplibre-gl`. This ensures 100% compatibility with our MapTiler API keys and provides out-of-the-box 3D terrain support without needing complex vector/raster source wiring.

## 3. Dependencies Installed
- `@maptiler/sdk` (`^3.0.1` or latest stable)

## 4. MapTiler Services Used
- **Satellite**: High-resolution imagery via `maptilersdk.MapStyle.SATELLITE`.
- **Hybrid**: Imagery + vectors via `maptilersdk.MapStyle.HYBRID`.
- **Streets**: Vector street map via `maptilersdk.MapStyle.STREETS`.
- **Terrain**: Global RGB elevation model supplied natively by `@maptiler/sdk` when `terrain: true` is passed.

## 5. DEM/Terrain Source
We use MapTiler's official RGB Terrain source, which seamlessly integrates with MapLibre's 3D terrain mesh generation. No AI, faked data, or arbitrary tilting was used. 

## 6. Satellite Source
In 3D, the satellite source is vector-style defined by MapTiler, which maps to their high-resolution raster tiles rendered onto the 3D WebGL mesh. 

## 7. Project Geometry Integration
PostGIS/GeoJSON project boundaries are injected into the 3D map via a MapLibre `geojson` source. The geometry logic maps Leaflet's traditional `[lat, lng]` coordinate structure (or `MultiPolygon` GeoJSON `[lng, lat]`) into strict `[lng, lat]` arrays required by WebGL/MapLibre. 

## 8. 2D/3D Switching Architecture
A clean wrapper component (`SpatialMap.jsx`) mounts either `SpatialMap2D.jsx` or `SpatialMap3D.jsx` depending on the state variable (`mode`). When one unmounts, its internal map instance is fully destroyed, preventing memory leaks, duplicate DOM nodes, or duplicate event listeners. 

## 9. Camera Controls
Users can pitch, rotate, zoom, and pan utilizing MapLibre's native right-click/ctrl-drag interactions. We retained UI buttons for Zoom In/Out and Reset North/Pitch to match the 2D UI. 

## 10. Terrain Exaggeration
Default exaggeration is 1.0 (realistic). The MapTiler SDK automatically injects a terrain control in the bottom right corner allowing users to optionally increase exaggeration if needed.

## 11. Zoom Limitations
MapLibre supports zooming significantly closer than Leaflet. We capped sensible initial zooms at z12, but users can scroll into z18+ depending on the terrain tile availability.

## 12. Performance Considerations
WebGL contexts are aggressively destroyed when unmounting `SpatialMap3D.jsx`. The terrain tiles are requested dynamically based on viewport frustum, not the entire globe. No proxying occurs through FastAPI.

## 13. WebGL Requirements
A Canvas test is executed before rendering `SpatialMap3D.jsx`. If WebGL is unsupported or disabled by the browser, a fallback UI informs the user they must return to 2D. 

## 14. Known Limitations
- Sentinel-2 analytical layers (NDVI, True Color) are currently constrained to the 2D map. Dynamic image overlays tied to bounding boxes in 3D require significantly more complex projection logic to drape correctly over mountains. 

## 15. Files Changed
- `frontend/package.json`
- `frontend/src/components/SpatialMap.jsx` (New Wrapper)
- `frontend/src/components/SpatialMap2D.jsx` (Renamed from original SpatialMap)
- `frontend/src/components/SpatialMap3D.jsx` (New Component)

## 16. Testing Performed
- Map switching 2D -> 3D -> 2D works cleanly without leaks.
- WebGL feature detection handles failures.
- PostGIS GeoJSON accurately aligns with the 3D satellite mesh.
- UI scaling and MapTiler controls align with existing aesthetic.

## 17. Future Improvements
Implement MapLibre WebGL-specific raster sources to drape dynamic Sentinel-2 NDVI imagery directly over the 3D terrain.
