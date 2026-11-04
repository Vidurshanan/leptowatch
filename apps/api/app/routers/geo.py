"""Geographic boundary router."""

from fastapi import APIRouter
from app.schemas.geo import GeoRDHSResponse
from app.services.geo_service import geo_service

geo_router = APIRouter(prefix="/geo", tags=["Geographic"])


@geo_router.get("/rdhs", response_model=GeoRDHSResponse)
def get_rdhs_boundaries() -> GeoRDHSResponse:
    """Retrieve GeoJSON boundaries for all 26 RDHS health areas with provisional warning."""
    return geo_service.get_rdhs_boundaries()
