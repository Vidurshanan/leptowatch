"""Environmental intelligence router."""

from fastapi import APIRouter
from app.schemas.environment import EnvironmentDetailResponse
from app.services.staging_service import staging_service

router = APIRouter(prefix="/environment", tags=["Environment"])


@router.get("/{id}", response_model=EnvironmentDetailResponse)
def get_environment_detail(id: str) -> EnvironmentDetailResponse:
    """Return environmental indicators and caveats for an RDHS area."""
    return staging_service.get_environment(id)
