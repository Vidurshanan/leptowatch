"""Dashboard summary router."""

from fastapi import APIRouter
from app.schemas.summary import DashboardSummaryResponse
from app.services.staging_service import staging_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary() -> DashboardSummaryResponse:
    """Return national surveillance overview and freshness summary."""
    return staging_service.get_summary()
