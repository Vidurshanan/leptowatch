"""Historical validation routes."""

from fastapi import APIRouter, Query
from typing import Optional

from app.schemas.forecast import HistoricalValidationResponse
from app.services.staging_service import staging_service

router = APIRouter(prefix="/historical-validation", tags=["Historical Validation"])

@router.get("/", response_model=HistoricalValidationResponse)
def get_historical_validation(
    rdhs: Optional[str] = Query(default="Kurunegala", description="RDHS area name"),
    year: int = Query(default=2024, description="Year of records to filter"),
    limit: int = Query(default=52, description="Maximum number of recent records to return"),
):
    """Return out‑of‑fold benchmark validation records for a given RDHS.
    
    The service merges pre‑computed OOF predictions with actual y35 targets
    from the features dataset and calculates summary MAE / RMSE.
    """
    return staging_service.get_historical_validation(rdhs_id=rdhs, year=year, limit=limit)
