"""Forecast routes."""

from fastapi import APIRouter
from app.schemas.forecast import ForecastListResponse, ForecastDetailResponse
from app.services.staging_service import staging_service

router = APIRouter(prefix="/forecasts", tags=["Forecasts"])


@router.get("/latest", response_model=ForecastListResponse)
def get_latest_forecasts() -> ForecastListResponse:
    """Return all 26 latest staging forecasts."""
    return staging_service.get_forecasts_latest()


@router.get("/{id}", response_model=ForecastDetailResponse)
def get_forecast_detail(id: str) -> ForecastDetailResponse:
    """Return detailed staging forecast for a specific RDHS area."""
    return staging_service.get_forecast_detail(id)
