from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text, func
from app.core.database import get_db
from app.models.project import Project, ProjectStatus
from app.api.deps import get_current_user
from pydantic import BaseModel
import json
from shapely.geometry import shape, MultiPolygon

router = APIRouter()
class ProjectCreate(BaseModel):
    name: str
    description: str = None
    geojson_boundary: dict
    
@router.get("/")
async def list_projects(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user)):
    result = await db.execute(
        select(
            Project.id,
            Project.name,
            Project.description,
            Project.status,
            Project.organization_id,
            Project.area_hectares,
            func.ST_AsGeoJSON(Project.boundary).label("boundary"),
        ).filter(Project.organization_id == current_user.organization_id)
    )
    return [
        {
            "id": str(row.id),
            "name": row.name,
            "description": row.description,
            "status": row.status.value if row.status else None,
            "organization_id": str(row.organization_id) if row.organization_id else None,
            "area_hectares": row.area_hectares,
            "boundary": json.loads(row.boundary) if row.boundary else None,
        }
        for row in result
    ]

@router.post("/")
async def create_project(project_in: ProjectCreate, db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        geom = shape(project_in.geojson_boundary)
        if geom.type == 'Polygon':
            geom = MultiPolygon([geom])
        elif geom.type != 'MultiPolygon':
            raise ValueError(f"Unsupported geometry type: {geom.type}. Must be Polygon or MultiPolygon.")
            
        if not geom.is_valid:
            raise ValueError("Invalid geometry")
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    # Area calculation in hectares (approximate using WGS84 for demonstration, but PostGIS geography is better)
    # We can still use PostGIS for the area calculation, or shapely + pyproj.
    # Let's just use PostGIS to compute area after inserting, or use the DB as before.
    
    # We can insert using WKT
    wkt_data = f"SRID=4326;{geom.wkt}"
    
    project = Project(
        name=project_in.name, 
        description=project_in.description,
        status=ProjectStatus.BASELINE_PENDING,
        organization_id=current_user.organization_id,
        boundary=wkt_data
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)
    
    # Calculate area using PostGIS
    query = select((func.ST_Area(project.boundary.cast(text("geography"))) / 10000.0).label("area_hectares"))
    result = await db.execute(query)
    area_hectares = float(result.scalar() or 0)
    
    project.area_hectares = area_hectares
    db.add(project)
    await db.commit()
    
    return {"message": "Project created", "area_hectares": area_hectares, "status": "BASELINE_PENDING"}
