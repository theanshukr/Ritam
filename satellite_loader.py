import os
from dataclasses import dataclass
from typing import Optional, Tuple, Dict, Any

# Ensure localtileserver uses IPv4 on Windows
os.environ["LOCALTILESERVER_CLIENT_HOST"] = "127.0.0.1"
os.environ["LOCALTILESERVER_SERVER_HOST"] = "127.0.0.1"

import rasterio
from rasterio.windows import from_bounds
import leafmap.foliumap as leafmap


@dataclass
class AOI:
    """Area of Interest definition."""
    name: str
    bbox: Tuple[float, float, float, float]  # (min_x, min_y, max_x, max_y)
    crs: str = "EPSG:4326"

    @property
    def center(self) -> Tuple[float, float]:
        """Returns (lat, lon) center coordinates in EPSG:4326."""
        min_x, min_y, max_x, max_y = self.bbox
        cx, cy = (min_x + max_x) / 2.0, (min_y + max_y) / 2.0
        if self.crs != "EPSG:4326":
            from pyproj import Transformer
            transformer = Transformer.from_crs(self.crs, "EPSG:4326", always_xy=True)
            lon, lat = transformer.transform(cx, cy)
            return (lat, lon)
        return (cy, cx)

    def to_geojson(self) -> Dict[str, Any]:
        """Returns GeoJSON FeatureCollection representation reprojected to EPSG:4326."""
        min_x, min_y, max_x, max_y = self.bbox
        coords = [
            [min_x, min_y],
            [max_x, min_y],
            [max_x, max_y],
            [min_x, max_y],
            [min_x, min_y]
        ]
        if self.crs != "EPSG:4326":
            from pyproj import Transformer
            transformer = Transformer.from_crs(self.crs, "EPSG:4326", always_xy=True)
            coords = [[transformer.transform(x, y)[0], transformer.transform(x, y)[1]] for x, y in coords]

        return {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {"name": self.name},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [coords]
                }
            }]
        }


class SatelliteDataLoader:
    """Satellite data loader & geospatial manager using Leafmap and Rasterio."""

    def __init__(self, output_dir: str = "data"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    def get_sample_satellite_imagery(self) -> str:
        """
        Downloads / provides a reliable sample satellite image (GeoTIFF)
        for testing and baseline validation.
        """
        local_filename = os.path.join(self.output_dir, "sample_satellite.tif")
        if not os.path.exists(local_filename):
            print(f"Downloading sample satellite imagery to {local_filename}...")
            sample_url = "https://github.com/opengeos/datasets/releases/download/raster/landsat.tif"
            import requests
            response = requests.get(sample_url, stream=True)
            response.raise_for_status()
            with open(local_filename, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print("Download completed.")
        else:
            print(f"Using existing cached imagery: {local_filename}")

        return local_filename

    def inspect_raster(self, raster_path: str) -> Dict[str, Any]:
        """Reads and returns metadata of a GeoTIFF raster."""
        with rasterio.open(raster_path) as src:
            metadata = {
                "driver": src.driver,
                "width": src.width,
                "height": src.height,
                "count": src.count,
                "crs": str(src.crs),
                "bounds": {
                    "left": src.bounds.left,
                    "bottom": src.bounds.bottom,
                    "right": src.bounds.right,
                    "top": src.bounds.top
                },
                "transform": [val for val in src.transform]
            }
        return metadata

    def crop_to_aoi(self, raster_path: str, aoi: AOI, output_cropped_path: str) -> str:
        """Crops a raster image to the specified AOI bounding box."""
        with rasterio.open(raster_path) as src:
            min_lon, min_lat, max_lon, max_lat = aoi.bbox
            window = from_bounds(min_lon, min_lat, max_lon, max_lat, src.transform)
            transform = rasterio.windows.transform(window, src.transform)
            
            kwargs = src.meta.copy()
            kwargs.update({
                'height': int(window.height),
                'width': int(window.width),
                'transform': transform
            })

            data = src.read(window=window)
            with rasterio.open(output_cropped_path, 'w', **kwargs) as dst:
                dst.write(data)

        print(f"Cropped image saved to: {output_cropped_path}")
        return output_cropped_path

    def create_interactive_map(
        self,
        raster_path: Optional[str] = None,
        aoi: Optional[AOI] = None,
        output_html: str = "data/ritam_map.html"
    ) -> str:
        """
        Creates an interactive 2D map using Leafmap and exports it to HTML.
        """
        center = aoi.center if aoi else (37.7749, -122.4194)
        m = leafmap.Map(center=center, zoom=9)

        # Add High-Res ESRI Satellite basemap and clean Topo basemap
        m.add_basemap("Esri.WorldImagery")
        m.add_basemap("CartoDB.Positron")

        # If raster provided, overlay GeoTIFF raster using local tile server or image layer
        if raster_path and os.path.exists(raster_path):
            try:
                import localtileserver
                client = localtileserver.TileClient(
                    raster_path,
                    host="127.0.0.1",
                    client_host="127.0.0.1"
                )
                tile_layer = localtileserver.get_folium_tile_layer(
                    client,
                    name="Satellite Raster (Tiles)",
                    opacity=0.85
                )
                m.add_layer(tile_layer)
            except Exception as e:
                print(f"Tile server overlay note: {e}, falling back to AOI and basemap.")

        # If AOI provided, overlay bounding box
        if aoi:
            m.add_geojson(
                aoi.to_geojson(),
                layer_name=f"AOI: {aoi.name}",
                style={"color": "#FFD700", "weight": 3, "fillOpacity": 0.15}
            )

        m.to_html(output_html)
        print(f"Interactive 2D Leafmap generated at: {output_html}")
        return output_html


if __name__ == "__main__":
    print("=== Ritam Satellite Data Layer Test ===")
    loader = SatelliteDataLoader(output_dir="data")

    # 1. Download & inspect sample imagery
    raster_file = loader.get_sample_satellite_imagery()
    info = loader.inspect_raster(raster_file)
    print("Raster Info:")
    for k, v in info.items():
        print(f"  {k}: {v}")

    # 2. Define AOI matching the raster bounds
    b = info["bounds"]
    sample_aoi = AOI(
        name="Sample AOI Area",
        bbox=(b["left"], b["bottom"], b["right"], b["top"]),
        crs=info["crs"]
    )

    # 3. Generate 2D Leafmap visualization
    map_file = loader.create_interactive_map(
        raster_path=raster_file,
        aoi=sample_aoi,
        output_html="data/ritam_map.html"
    )
    print("Satellite setup & data pipeline test successful!")
