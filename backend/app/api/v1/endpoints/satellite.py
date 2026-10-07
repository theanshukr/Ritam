"""
Satellite Monitoring API Endpoints

Provides Sentinel-2 scene search, NDVI calculation, and vegetation
change detection for RITAM projects.

Integrates with existing:
- Project model (PostGIS boundary)
- ChangeEvent model (vegetation change alerts)
- EvidenceRecord model (satellite evidence storage)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone, timedelta
import hashlib
import json
import logging
import asyncio
from collections import OrderedDict

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.project import Project
from app.models.change_event import ChangeEvent
from app.models.evidence_record import EvidenceRecord
from app.models.satellite_scene import SatelliteScene
from app.models.user import User
from fastapi.responses import Response
from app.services.satellite.sentinel import (
    search_sentinel2_scenes,
    calculate_ndvi_for_boundary,
    detect_vegetation_change,
    classify_ndvi_change,
    classify_severity,
    postgis_geometry_to_geojson,
    get_sh_config,
    project_boundary_to_bbox,
    project_boundary_to_geometry,
    fetch_true_color_png,
    xyz_tile_to_bbox,
    SENTINEL2_L2A_COLLECTION,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class _TrueColorLRU:
    """Small in-process LRU cache for rendered true-color PNG bytes."""

    def __init__(self, maxsize: int = 40):
        self.maxsize = maxsize
        self._data: OrderedDict = OrderedDict()

    def get(self, key: str):
        if key in self._data:
            self._data.move_to_end(key)
            return self._data[key]
        return None

    def set(self, key: str, value: bytes) -> None:
        if key in self._data:
            self._data.move_to_end(key)
        self._data[key] = value
        while len(self._data) > self.maxsize:
            self._data.popitem(last=False)

    def clear(self) -> None:
        self._data.clear()


TRUE_COLOR_CACHE = _TrueColorLRU(maxsize=512)

# Pre-generate a transparent 1x1 PNG for tiles where Sentinel Hub has no data.
# Leaflet expects every tile request to return a valid image — never 404/502.
def _make_transparent_tile() -> bytes:
    from io import BytesIO
    from PIL import Image
    import numpy as np
    img = Image.fromarray(np.zeros((1, 1, 4), dtype=np.uint8), 'RGBA')
    buf = BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()

TRANSPARENT_TILE_PNG = _make_transparent_tile()


# ---------------------------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------------------------

class SceneSearchRequest(BaseModel):
    start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date (YYYY-MM-DD)")
    max_cloud_cover: float = Field(20.0, ge=0, le=100)


class NDVICalculationRequest(BaseModel):
    start_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    end_date: str = Field(..., description="End date (YYYY-MM-DD)")
    max_cloud_cover: float = Field(20.0, ge=0, le=100)


class CompareRequest(BaseModel):
    baseline_date_from: str = Field(..., description="Baseline period start (YYYY-MM-DD)")
    baseline_date_to: str = Field(..., description="Baseline period end (YYYY-MM-DD)")
    current_date_from: str = Field(..., description="Current period start (YYYY-MM-DD)")
    current_date_to: str = Field(..., description="Current period end (YYYY-MM-DD)")
    max_cloud_cover: float = Field(20.0, ge=0, le=100)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_project_with_boundary(
    project_id: str,
    current_user: User,
    db: AsyncSession,
) -> Project:
    """
    Fetch a project and verify tenant ownership.
    Returns the project with its PostGIS boundary.
    """
    result = await db.execute(
        select(Project).filter(
            Project.id == project_id,
            Project.organization_id == current_user.organization_id,
        )
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found or not accessible",
        )
    if not project.boundary:
        raise HTTPException(
            status_code=400,
            detail="Project has no boundary defined",
        )
    return project


def _compute_sha256(data: bytes) -> str:
    """Compute SHA-256 hash of binary data."""
    return hashlib.sha256(data).hexdigest()


# ---------------------------------------------------------------------------
# ENDPOINT 1: Search Sentinel-2 Scenes
# ---------------------------------------------------------------------------

@router.get("/{project_id}/scenes")
async def get_scenes(
    project_id: str,
    start_date: str,
    end_date: str,
    max_cloud_cover: float = 20.0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Search available Sentinel-2 L2A scenes for a project boundary.

    Parameters:
    - start_date: Start date (YYYY-MM-DD)
    - end_date: End date (YYYY-MM-DD)
    - max_cloud_cover: Maximum cloud cover percentage (0-100)

    Returns:
    - List of available scenes with metadata
    """
    project = await _get_project_with_boundary(project_id, current_user, db)

    # Convert PostGIS geometry to GeoJSON
    boundary_str = str(project.boundary)
    boundary_geojson = postgis_geometry_to_geojson(boundary_str)

    try:
        scenes = search_sentinel2_scenes(
            boundary_geojson=boundary_geojson,
            date_from=start_date,
            date_to=end_date,
            max_cloud_cover=max_cloud_cover,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Sentinel Hub API error: {str(e)}",
        )

    return {
        "project_id": str(project.id),
        "project_name": project.name,
        "boundary_bbox": boundary_geojson,
        "query": {
            "start_date": start_date,
            "end_date": end_date,
            "max_cloud_cover": max_cloud_cover,
        },
        "scene_count": len(scenes),
        "scenes": scenes,
    }


@router.post("/{project_id}/scenes")
async def search_scenes(
    project_id: str,
    request: SceneSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """POST variant of scene search for complex queries."""
    project = await _get_project_with_boundary(project_id, current_user, db)

    boundary_str = str(project.boundary)
    boundary_geojson = postgis_geometry_to_geojson(boundary_str)

    try:
        scenes = search_sentinel2_scenes(
            boundary_geojson=boundary_geojson,
            date_from=request.start_date,
            date_to=request.end_date,
            max_cloud_cover=request.max_cloud_cover,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Sentinel Hub API error: {str(e)}",
        )

    return {
        "project_id": str(project.id),
        "project_name": project.name,
        "query": {
            "start_date": request.start_date,
            "end_date": request.end_date,
            "max_cloud_cover": request.max_cloud_cover,
        },
        "scene_count": len(scenes),
        "scenes": scenes,
    }


# ---------------------------------------------------------------------------
# ENDPOINT 2: NDVI Calculation
# ---------------------------------------------------------------------------

@router.get("/{project_id}/ndvi")
async def get_ndvi(
    project_id: str,
    start_date: str,
    end_date: str,
    max_cloud_cover: float = 20.0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Calculate NDVI for a project boundary using Sentinel-2 L2A.

    Parameters:
    - start_date: Start date (YYYY-MM-DD)
    - end_date: End date (YYYY-MM-DD)
    - max_cloud_cover: Maximum cloud cover percentage

    Returns:
    - NDVI statistics (mean, min, max, std)
    - Acquisition period
    - Coverage percentage
    """
    project = await _get_project_with_boundary(project_id, current_user, db)

    boundary_str = str(project.boundary)
    boundary_geojson = postgis_geometry_to_geojson(boundary_str)

    try:
        ndvi_result = calculate_ndvi_for_boundary(
            boundary_geojson=boundary_geojson,
            date_from=start_date,
            date_to=end_date,
            max_cloud_cover=max_cloud_cover,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Sentinel Hub NDVI calculation error: {str(e)}",
        )

    # Store scene metadata in database
    scene = SatelliteScene(
        project_id=project.id,
        scene_id=f"S2A_NDVI_{start_date}_{end_date}",
        acquisition_date=datetime.now(timezone.utc),
        cloud_cover_pct=max_cloud_cover,
        source="Sentinel-2 L2A",
        provider="Copernicus Data Space",
        ndvi_mean=ndvi_result["ndvi_mean"],
        ndvi_min=ndvi_result["ndvi_min"],
        ndvi_max=ndvi_result["ndvi_max"],
        metadata_json={
            "ndvi_std": ndvi_result["ndvi_std"],
            "valid_pixels": ndvi_result["valid_pixels"],
            "total_pixels": ndvi_result["total_pixels"],
            "coverage_pct": ndvi_result["coverage_pct"],
            "date_range": {"from": start_date, "to": end_date},
            "processing_method": "Sentinel Hub evalscript server-side",
        },
    )
    db.add(scene)
    await db.commit()

    return {
        "project_id": str(project.id),
        "project_name": project.name,
        "acquisition_period": {
            "start": start_date,
            "end": end_date,
        },
        "cloud_cover_threshold": max_cloud_cover,
        "ndvi": {
            "mean": round(ndvi_result["ndvi_mean"], 4),
            "min": round(ndvi_result["ndvi_min"], 4),
            "max": round(ndvi_result["ndvi_max"], 4),
            "std": round(ndvi_result["ndvi_std"], 4),
        },
        "coverage": {
            "valid_pixels": ndvi_result["valid_pixels"],
            "total_pixels": ndvi_result["total_pixels"],
            "coverage_pct": ndvi_result["coverage_pct"],
        },
        "vegetation_status": classify_ndvi_change(ndvi_result["ndvi_mean"] - 0.5),
        "scene_id": str(scene.id),
    }


@router.post("/{project_id}/ndvi")
async def calculate_ndvi(
    project_id: str,
    request: NDVICalculationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """POST variant for NDVI calculation."""
    project = await _get_project_with_boundary(project_id, current_user, db)

    boundary_str = str(project.boundary)
    boundary_geojson = postgis_geometry_to_geojson(boundary_str)

    try:
        ndvi_result = calculate_ndvi_for_boundary(
            boundary_geojson=boundary_geojson,
            date_from=request.start_date,
            date_to=request.end_date,
            max_cloud_cover=request.max_cloud_cover,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Sentinel Hub NDVI calculation error: {str(e)}",
        )

    scene = SatelliteScene(
        project_id=project.id,
        scene_id=f"S2A_NDVI_{request.start_date}_{request.end_date}",
        acquisition_date=datetime.now(timezone.utc),
        cloud_cover_pct=request.max_cloud_cover,
        source="Sentinel-2 L2A",
        provider="Copernicus Data Space",
        ndvi_mean=ndvi_result["ndvi_mean"],
        ndvi_min=ndvi_result["ndvi_min"],
        ndvi_max=ndvi_result["ndvi_max"],
        metadata_json={
            "ndvi_std": ndvi_result["ndvi_std"],
            "valid_pixels": ndvi_result["valid_pixels"],
            "total_pixels": ndvi_result["total_pixels"],
            "coverage_pct": ndvi_result["coverage_pct"],
            "date_range": {"from": request.start_date, "to": request.end_date},
            "processing_method": "Sentinel Hub evalscript server-side",
        },
    )
    db.add(scene)
    await db.commit()

    return {
        "project_id": str(project.id),
        "project_name": project.name,
        "acquisition_period": {
            "start": request.start_date,
            "end": request.end_date,
        },
        "ndvi": {
            "mean": round(ndvi_result["ndvi_mean"], 4),
            "min": round(ndvi_result["ndvi_min"], 4),
            "max": round(ndvi_result["ndvi_max"], 4),
            "std": round(ndvi_result["ndvi_std"], 4),
        },
        "coverage": {
            "valid_pixels": ndvi_result["valid_pixels"],
            "total_pixels": ndvi_result["total_pixels"],
            "coverage_pct": ndvi_result["coverage_pct"],
        },
        "vegetation_status": classify_ndvi_change(ndvi_result["ndvi_mean"] - 0.5),
        "scene_id": str(scene.id),
    }


# ---------------------------------------------------------------------------
# ENDPOINT 3: Before / After Comparison
# ---------------------------------------------------------------------------

@router.get("/{project_id}/compare")
async def compare_periods(
    project_id: str,
    baseline_date_from: str,
    baseline_date_to: str,
    current_date_from: str,
    current_date_to: str,
    max_cloud_cover: float = 20.0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compare baseline and current Sentinel-2 periods for vegetation change.

    Parameters:
    - baseline_date_from/to: Baseline period
    - current_date_from/to: Current period
    - max_cloud_cover: Maximum cloud cover percentage

    Returns:
    - Baseline NDVI, current NDVI, change, classification
    - Confidence score
    - ChangeEvent created if significant vegetation loss detected
    """
    project = await _get_project_with_boundary(project_id, current_user, db)

    boundary_str = str(project.boundary)
    boundary_geojson = postgis_geometry_to_geojson(boundary_str)

    try:
        comparison = detect_vegetation_change(
            boundary_geojson=boundary_geojson,
            baseline_date_from=baseline_date_from,
            baseline_date_to=baseline_date_to,
            current_date_from=current_date_from,
            current_date_to=current_date_to,
            max_cloud_cover=max_cloud_cover,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Sentinel Hub comparison error: {str(e)}",
        )

    # Create ChangeEvent if significant vegetation loss detected
    change_event_id = None
    evidence_id = None

    if comparison["vegetation_change"] == "VEGETATION_LOSS":
        severity = classify_severity(comparison["ndvi_change"])

        change_event = ChangeEvent(
            project_id=project.id,
            indicator="Vegetation",
            change_type="Decrease",
            severity=severity,
            confidence=comparison["confidence"],
            status="DETECTED",
            evidence_data={
                "source": "Sentinel-2 L2A",
                "baseline_date": comparison["baseline_date"],
                "current_date": comparison["current_date"],
                "baseline_ndvi": comparison["baseline_ndvi"],
                "current_ndvi": comparison["current_ndvi"],
                "ndvi_change": comparison["ndvi_change"],
                "vegetation_change": comparison["vegetation_change"],
                "processing_method": "NDVI differencing via Sentinel Hub evalscripts",
                "note": "Satellite NDVI indicates area-level vegetation change. "
                        "Does NOT confirm individual tree-level activity.",
            },
        )
        db.add(change_event)
        await db.flush()
        change_event_id = str(change_event.id)

        # Create EvidenceRecord for satellite evidence
        evidence_metadata = {
            "provider": "Copernicus Data Space / Sentinel Hub",
            "source": "Sentinel-2 L2A",
            "baseline_date": comparison["baseline_date"],
            "current_date": comparison["current_date"],
            "scene_id_baseline": f"S2A_{baseline_date_from}_{baseline_date_to}",
            "scene_id_current": f"S2A_{current_date_from}_{current_date_to}",
            "cloud_coverage": max_cloud_cover,
            "baseline_ndvi": comparison["baseline_ndvi"],
            "current_ndvi": comparison["current_ndvi"],
            "ndvi_change": comparison["ndvi_change"],
            "comparison_period": f"{baseline_date_from} to {current_date_from}",
            "processing_method": "Sentinel Hub server-side evalscripts",
            "ndvi_method": "(B08 - B04) / (B08 + B04)",
        }

        evidence = EvidenceRecord(
            entity_id=str(change_event.id),
            entity_type="ChangeEvent",
            evidence_type="Satellite",
            url=f"/api/v1/satellite/{project_id}/compare?baseline_date_from={baseline_date_from}&current_date_from={current_date_from}",
            file_hash_sha256=_compute_sha256(
                json.dumps(evidence_metadata, sort_keys=True).encode()
            ),
            metadata_json=evidence_metadata,
            uploaded_by=current_user.id,
        )
        db.add(evidence)
        await db.flush()
        evidence_id = str(evidence.id)

    await db.commit()

    return {
        "project_id": str(project.id),
        "project_name": project.name,
        "comparison": comparison,
        "change_event_created": change_event_id is not None,
        "change_event_id": change_event_id,
        "evidence_record_id": evidence_id,
    }


@router.post("/{project_id}/compare")
async def compare_periods_post(
    project_id: str,
    request: CompareRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """POST variant of before/after comparison."""
    project = await _get_project_with_boundary(project_id, current_user, db)

    boundary_str = str(project.boundary)
    boundary_geojson = postgis_geometry_to_geojson(boundary_str)

    try:
        comparison = detect_vegetation_change(
            boundary_geojson=boundary_geojson,
            baseline_date_from=request.baseline_date_from,
            baseline_date_to=request.baseline_date_to,
            current_date_from=request.current_date_from,
            current_date_to=request.current_date_to,
            max_cloud_cover=request.max_cloud_cover,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Sentinel Hub comparison error: {str(e)}",
        )

    change_event_id = None
    evidence_id = None

    if comparison["vegetation_change"] == "VEGETATION_LOSS":
        severity = classify_severity(comparison["ndvi_change"])

        change_event = ChangeEvent(
            project_id=project.id,
            indicator="Vegetation",
            change_type="Decrease",
            severity=severity,
            confidence=comparison["confidence"],
            status="DETECTED",
            evidence_data={
                "source": "Sentinel-2 L2A",
                "baseline_date": comparison["baseline_date"],
                "current_date": comparison["current_date"],
                "baseline_ndvi": comparison["baseline_ndvi"],
                "current_ndvi": comparison["current_ndvi"],
                "ndvi_change": comparison["ndvi_change"],
                "vegetation_change": comparison["vegetation_change"],
                "processing_method": "NDVI differencing via Sentinel Hub evalscripts",
                "note": "Satellite NDVI indicates area-level vegetation change. "
                        "Does NOT confirm individual tree-level activity.",
            },
        )
        db.add(change_event)
        await db.flush()
        change_event_id = str(change_event.id)

        evidence_metadata = {
            "provider": "Copernicus Data Space / Sentinel Hub",
            "source": "Sentinel-2 L2A",
            "baseline_date": comparison["baseline_date"],
            "current_date": comparison["current_date"],
            "scene_id_baseline": f"S2A_{request.baseline_date_from}_{request.baseline_date_to}",
            "scene_id_current": f"S2A_{request.current_date_from}_{request.current_date_to}",
            "cloud_coverage": request.max_cloud_cover,
            "baseline_ndvi": comparison["baseline_ndvi"],
            "current_ndvi": comparison["current_ndvi"],
            "ndvi_change": comparison["ndvi_change"],
            "processing_method": "Sentinel Hub server-side evalscripts",
            "ndvi_method": "(B08 - B04) / (B08 + B04)",
        }

        evidence = EvidenceRecord(
            entity_id=str(change_event.id),
            entity_type="ChangeEvent",
            evidence_type="Satellite",
            url=f"/api/v1/satellite/{project_id}/compare",
            file_hash_sha256=_compute_sha256(
                json.dumps(evidence_metadata, sort_keys=True).encode()
            ),
            metadata_json=evidence_metadata,
            uploaded_by=current_user.id,
        )
        db.add(evidence)
        await db.flush()
        evidence_id = str(evidence.id)

    await db.commit()

    return {
        "project_id": str(project.id),
        "project_name": project.name,
        "comparison": comparison,
        "change_event_created": change_event_id is not None,
        "change_event_id": change_event_id,
        "evidence_record_id": evidence_id,
    }


# ---------------------------------------------------------------------------
# ENDPOINT 4: Get Stored Scenes for a Project
# ---------------------------------------------------------------------------

@router.get("/{project_id}/history")
async def get_satellite_history(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve stored satellite scene history for a project.

    Returns previously calculated NDVI measurements and scene metadata.
    """
    project = await _get_project_with_boundary(project_id, current_user, db)

    result = await db.execute(
        select(SatelliteScene)
        .filter(SatelliteScene.project_id == project.id)
        .order_by(SatelliteScene.created_at.desc())
    )
    scenes = result.scalars().all()

    return {
        "project_id": str(project.id),
        "project_name": project.name,
        "scene_count": len(scenes),
        "scenes": [
            {
                "id": str(scene.id),
                "scene_id": scene.scene_id,
                "acquisition_date": str(scene.acquisition_date) if scene.acquisition_date else None,
                "cloud_cover_pct": scene.cloud_cover_pct,
                "source": scene.source,
                "provider": scene.provider,
                "ndvi_mean": scene.ndvi_mean,
                "ndvi_min": scene.ndvi_min,
                "ndvi_max": scene.ndvi_max,
                "metadata": scene.metadata_json,
                "created_at": str(scene.created_at) if scene.created_at else None,
            }
            for scene in scenes
        ],
    }


# ---------------------------------------------------------------------------
# ENDPOINT 5: Sentinel-2 NDVI Image Overlay
# ---------------------------------------------------------------------------

# NDVI color ramp evalscript: returns a color-mapped NDVI image
NDVI_VISUALIZATION_EVALSCRIPT = """
//VERSION=3
function setup() {
  return {
    input: [
      { bands: ["B04", "B08", "SCL"], units: "DN" }
    ],
    output: { id: "ndvi_rgb", bands: 3, sampleType: "AUTO" }
  };
}

function evaluatePixel(sample) {
  // Calculate NDVI
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  
  // Map NDVI to color ramp: red (bare) → yellow → green (vegetation)
  let r, g, b;
  
  if (ndvi < 0.0) {
    // Water/bare soil: dark blue to brown
    r = 0.1;
    g = 0.15;
    b = 0.3;
  } else if (ndvi < 0.2) {
    // Bare soil: brown to yellow
    r = 0.7;
    g = 0.5;
    b = 0.2;
  } else if (ndvi < 0.4) {
    // Sparse vegetation: yellow
    r = 0.9;
    g = 0.85;
    b = 0.1;
  } else if (ndvi < 0.6) {
    // Moderate vegetation: yellow-green to green
    let t = (ndvi - 0.4) / 0.2;
    r = 0.9 * (1.0 - t);
    g = 0.85 + 0.15 * t;
    b = 0.1 * (1.0 - t);
  } else if (ndvi < 0.8) {
    // Dense vegetation: green
    let t = (ndvi - 0.6) / 0.2;
    r = 0.0;
    g = 0.8 + 0.2 * t;
    b = 0.1 * t;
  } else {
    // Very dense vegetation: deep green
    r = 0.0;
    g = 1.0;
    b = 0.2;
  }
  
  return { ndvi_rgb: [r, g, b] };
}
"""


@router.get("/{project_id}/ndvi-overlay")
async def get_ndvi_overlay(
    project_id: str,
    start_date: str,
    end_date: str,
    max_cloud_cover: float = 20.0,
    width: int = 512,
    height: int = 512,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a Sentinel-2 NDVI visualization image for a project boundary.

    Returns a PNG image that can be used as a Leaflet ImageOverlay on the map.
    The image shows NDVI values color-mapped from red (bare) to green (vegetation).

    Parameters:
    - start_date: Start date (YYYY-MM-DD)
    - end_date: End date (YYYY-MM-DD)
    - max_cloud_cover: Maximum cloud cover percentage
    - width: Image width in pixels (default 512)
    - height: Image height in pixels (default 512)

    Returns:
    - PNG image (Content-Type: image/png)
    """
    from sentinelhub import SentinelHubRequest, DataCollection, MimeType
    import numpy as np
    from io import BytesIO

    project = await _get_project_with_boundary(project_id, current_user, db)

    boundary_str = str(project.boundary)
    boundary_geojson = postgis_geometry_to_geojson(boundary_str)

    config = get_sh_config()
    bbox = project_boundary_to_bbox(boundary_geojson)
    geometry = project_boundary_to_geometry(boundary_geojson)

    try:
        request = SentinelHubRequest(
            evalscript=NDVI_VISUALIZATION_EVALSCRIPT,
            input_data=[
                SentinelHubRequest.input_data(
                    data_collection=SENTINEL2_L2A_COLLECTION,
                    time_interval=(start_date, end_date),
                    maxcc=max_cloud_cover / 100.0,
                )
            ],
            responses=[
                SentinelHubRequest.output_response("ndvi_rgb", MimeType.PNG)
            ],
            bbox=bbox,
            geometry=geometry,
            size=(width, height),
            config=config,
        )

        img_data = request.get_data()

        if not img_data or len(img_data) == 0:
            raise HTTPException(
                status_code=404,
                detail="No Sentinel-2 data available for the specified parameters",
            )

        # Convert numpy array to PNG
        ndvi_image = img_data[0]
        if ndvi_image is None or ndvi_image.size == 0:
            raise HTTPException(
                status_code=404,
                detail="NDVI visualization returned empty",
            )

        # Ensure correct shape (H, W, 3)
        if len(ndvi_image.shape) == 2:
            # Grayscale → convert to RGB
            ndvi_image = np.stack([ndvi_image] * 3, axis=-1)

        # Convert to uint8 if needed
        if ndvi_image.dtype != np.uint8:
            ndvi_image = (ndvi_image * 255).clip(0, 255).astype(np.uint8)

        # Encode as PNG using PIL
        from PIL import Image
        img = Image.fromarray(ndvi_image, 'RGB')
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)

        return Response(
            content=buffer.getvalue(),
            media_type="image/png",
            headers={
                "Content-Disposition": f"inline; filename=ndvi_{project_id}_{start_date}_{end_date}.png",
                "Cache-Control": "public, max-age=3600",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Sentinel Hub NDVI visualization error: {str(e)}",
        )


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# ENDPOINT 6: Sentinel-2 True Color RGB Imagery (dynamic map layer)
#
# Two modes:
#   1. PROJECT MODE  — no viewport BBOX given: renders the full project
#      boundary, clipped by the PostGIS polygon (RGBA mask).
#   2. VIEWPORT MODE — west/south/east/north + width/height given: renders the
#      visible map rectangle. Used by the frontend on every pan/zoom so that
#      Sentinel-2 imagery always matches the current viewport resolution.
# ---------------------------------------------------------------------------


@router.get("/{project_id}/true-color")
async def get_true_color(
    project_id: str,
    start_date: str,
    end_date: str,
    max_cloud_cover: float = 20.0,
    width: int = 512,
    height: int = 512,
    west: Optional[float] = None,
    south: Optional[float] = None,
    east: Optional[float] = None,
    north: Optional[float] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a Sentinel-2 true-color RGB(A) image for an interactive map viewport.

    When viewport bounds (west/south/east/north) are supplied the request
    renders exactly that rectangle at ``width`` x ``height`` pixels; otherwise
    the full project boundary is rendered.

    Returns a PNG image (Content-Type: image/png).
    """
    from sentinelhub import BBox, CRS

    project = await _get_project_with_boundary(project_id, current_user, db)

    boundary_str = str(project.boundary)
    boundary_geojson = postgis_geometry_to_geojson(boundary_str)

    # Determine request geometry: project-clipped default vs free viewport.
    viewport_mode = any(value is not None for value in (west, south, east, north))
    if viewport_mode:
        if None in (west, south, east, north):
            raise HTTPException(status_code=400, detail="Viewport BBOX requires west, south, east, and north")
        if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
            raise HTTPException(status_code=400, detail="Invalid viewport BBOX")
        bbox = BBox(bbox=(west, south, east, north), crs=CRS.WGS84)
        geometry = None
    else:
        bbox = project_boundary_to_bbox(boundary_geojson)
        geometry = project_boundary_to_geometry(boundary_geojson)

    if not (1 <= width <= 2048 and 1 <= height <= 2048):
        raise HTTPException(status_code=400, detail="Image dimensions must be between 1 and 2048 pixels")

    cache_key = (
        f"{project_id}|{bbox.min_x:.6f},{bbox.min_y:.6f},{bbox.max_x:.6f},{bbox.max_y:.6f}"
        f"|{width}x{height}|{start_date}..{end_date}|cc{max_cloud_cover}"
    )
    cached = TRUE_COLOR_CACHE.get(cache_key)
    if cached is not None:
        logger.info("Sentinel true-color cache HIT project_id=%s key=%s", project.id, cache_key)
        return Response(
            content=cached,
            media_type="image/png",
            headers={
                "Content-Disposition": f"inline; filename=truecolor_{project_id}.png",
                "Cache-Control": "public, max-age=3600",
                "X-Sentinel-Cache": "HIT",
            },
        )

    logger.info(
        "Sentinel true-color request project_id=%s bbox=%s dates=%s..%s "
        "max_cloud_cover=%s size=%sx%s viewport_mode=%s collection=SENTINEL2_L2A",
        project.id,
        (bbox.min_x, bbox.min_y, bbox.max_x, bbox.max_y),
        start_date,
        end_date,
        max_cloud_cover,
        width,
        height,
        viewport_mode,
    )

    try:
        # Blocking Sentinel Hub SDK call runs in a worker thread so the
        # async event loop (and every other API request) stays responsive.
        result = await asyncio.to_thread(
            fetch_true_color_png,
            bbox,
            geometry,
            width,
            height,
            start_date,
            end_date,
            max_cloud_cover,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Sentinel Hub true-color imagery error: {exc}",
        )

    png_bytes = result["png"]
    TRUE_COLOR_CACHE.set(cache_key, png_bytes)

    # Persist full-project scene metadata only — per-viewport tile requests
    # should not flood the project's satellite history.
    if not viewport_mode:
        scene = SatelliteScene(
            project_id=project.id,
            scene_id=f"S2A_TRUECOLOR_{start_date}_{end_date}",
            acquisition_date=datetime.now(timezone.utc),
            cloud_cover_pct=max_cloud_cover,
            source="Sentinel-2 L2A",
            provider="Copernicus Data Space",
            metadata_json={
                "type": "true_color_rgb",
                "bands": ["B04", "B03", "B02"],
                "date_range": {"from": start_date, "to": end_date},
                "max_cloud_cover": max_cloud_cover,
                "processing_method": "Sentinel Hub Process API evalscript server-side",
            },
        )
        db.add(scene)
        await db.commit()

    logger.info(
        "Sentinel true-color PNG ready project_id=%s bytes=%s dimensions=%sx%s mode=%s",
        project.id,
        len(png_bytes),
        result["size"][0],
        result["size"][1],
        result["mode"],
    )

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": f"inline; filename=truecolor_{project_id}_{start_date}_{end_date}.png",
            "Cache-Control": "public, max-age=3600",
            "X-Sentinel-Cache": "MISS",
        },
    )


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# ENDPOINT 7: Sentinel-2 True Color TILE (z/x/y)
#
# Serves individual 256x256 (or 512x512) PNG tiles for a Web-Mercator tile grid.
# The frontend Leaflet map requests tiles by (z, x, y); this endpoint converts
# the tile coordinate to a geographic BBox, renders Sentinel-2 true-color imagery
# via the Process API, and returns a PNG tile.
# ---------------------------------------------------------------------------
# Sentinel-2 True Color TILE (z/x/y)
#
# PUBLIC endpoint — no authentication required.
# Leaflet's L.tileLayer loads tiles via <img> elements which cannot carry
# Authorization headers, so this endpoint must be accessible without auth.
# The project_id in the URL provides lightweight access scoping.
