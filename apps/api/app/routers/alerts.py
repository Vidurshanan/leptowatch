"""Alert routes."""

from fastapi import APIRouter
from app.schemas.alert import AlertListResponse
from app.services.staging_service import staging_service

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("/latest", response_model=AlertListResponse)
def get_latest_alerts() -> AlertListResponse:
    """Return latest provisional alert status across all 26 RDHS areas."""
    return staging_service.get_alerts_latest()
