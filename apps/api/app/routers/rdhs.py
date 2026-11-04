"""RDHS routes."""

from fastapi import APIRouter
from app.schemas.rdhs import RDHSListResponse, RDHSDetailResponse
from app.services.staging_service import staging_service

router = APIRouter(prefix="/rdhs", tags=["RDHS"])


@router.get("", response_model=RDHSListResponse)
def list_rdhs() -> RDHSListResponse:
    """Return all 26 RDHS areas with summary metrics."""
    return staging_service.get_rdhs_list()


@router.get("/{id}", response_model=RDHSDetailResponse)
def get_rdhs(id: str) -> RDHSDetailResponse:
    """Return detailed profile for a specific RDHS area."""
    return staging_service.get_rdhs_detail(id)
