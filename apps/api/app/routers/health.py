"""Health check router."""

from fastapi import APIRouter
from app.schemas.health import HealthResponse
from app.services.staging_service import staging_service

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Return system status, data availability, and staging mode."""
    return staging_service.get_health()
