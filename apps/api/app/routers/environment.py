"""Environmental intelligence router."""

from fastapi import APIRouter
from app.schemas.environment import (
    EnvironmentDetailResponse,
    EnvironmentOverviewResponse,
    EnvironmentSummaryResponse,
)
from app.services.staging_service import staging_service

router = APIRouter(prefix="/environment", tags=["Environment"])


@router.get("/overview", response_model=EnvironmentOverviewResponse)
def get_environment_overview() -> EnvironmentOverviewResponse:
    """National-level environmental data freshness and coverage overview."""
    return staging_service.get_environment_overview()


@router.get("/summary", response_model=EnvironmentSummaryResponse)
def get_environment_summary() -> EnvironmentSummaryResponse:
    """Per-RDHS environmental summary (totals and means) for map layer and comparison view."""
    return staging_service.get_environment_summary()


@router.get("/{id}", response_model=EnvironmentDetailResponse)
def get_environment_detail(id: str) -> EnvironmentDetailResponse:
    """Return environmental indicators and caveats for an RDHS area."""
    return staging_service.get_environment(id)
