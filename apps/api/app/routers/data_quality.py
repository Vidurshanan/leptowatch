"""Data quality router."""

from fastapi import APIRouter
from app.schemas.data_quality import DataQualityResponse
from app.services.staging_service import staging_service

router = APIRouter(prefix="/data-quality", tags=["Data Quality"])


@router.get("", response_model=DataQualityResponse)
def get_data_quality() -> DataQualityResponse:
    """Return national and RDHS-level data completeness, status, and freshness."""
    return staging_service.get_data_quality()
