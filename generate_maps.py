"""
Generates the original standalone Leafmap HTML files:
1. data/map_satellite_aoi.html
2. data/map_split_comparison.html
"""

import os
import leafmap.foliumap as leafmap
from satellite_loader import SatelliteDataLoader, AOI

def restore_html_maps():
    os.makedirs("data", exist_ok=True)
    loader = SatelliteDataLoader(output_dir="data")

    # Sample AOI
    sample_raster = loader.get_sample_satellite_imagery()
    info = loader.inspect_raster(sample_raster)
    b = info["bounds"]

    sample_aoi = AOI(
        name="Selected Satellite AOI",
        bbox=(b["left"], b["bottom"], b["right"], b["top"]),
        crs=info["crs"]
    )

    # -------------------------------------------------------------
    # Map 1: Satellite & Hybrid Basemap + AOI Layer + Layer Control
    # -------------------------------------------------------------
    print("Generating Map 1: data/map_satellite_aoi.html ...")
    m1 = leafmap.Map(center=sample_aoi.center, zoom=10, draw_control=False)
    m1.add_basemap("HYBRID")
    m1.add_basemap("SATELLITE")
    m1.add_basemap("ROADMAP")
    m1.add_layer_control()
    
    m1.add_geojson(
        sample_aoi.to_geojson(),
        layer_name=f"AOI: {sample_aoi.name}",
        style={"color": "#00FFCC", "weight": 3, "fillColor": "#00FFCC", "fillOpacity": 0.2}
    )
    
    map1_path = "data/map_satellite_aoi.html"
    m1.to_html(map1_path)
    print(f"Saved: {map1_path}")

    # -------------------------------------------------------------
    # Map 2: Split-Screen Comparison (Satellite vs Road Map)
    # -------------------------------------------------------------
    print("Generating Map 2: data/map_split_comparison.html ...")
    m2 = leafmap.Map(center=sample_aoi.center, zoom=10)
    m2.split_map(
        left_layer="HYBRID",
        right_layer="ROADMAP"
    )
    map2_path = "data/map_split_comparison.html"
    m2.to_html(map2_path)
    print(f"Saved: {map2_path}")

    print("\nBoth maps restored successfully!")

if __name__ == "__main__":
    restore_html_maps()
