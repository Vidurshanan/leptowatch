"""Model performance router."""

from fastapi import APIRouter
from app.schemas.model import ModelPerformanceResponse
from app.services.staging_service import staging_service

router = APIRouter(prefix="/model", tags=["Model"])


@router.get("/performance", response_model=ModelPerformanceResponse)
def get_model_performance() -> ModelPerformanceResponse:
    """Return verified historical validation metrics from staging reports."""
    return staging_service.get_model_performance()
