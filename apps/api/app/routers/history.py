"""Historical surveillance case router."""

from typing import Optional
from fastapi import APIRouter, Query
from app.schemas.history import HistoryResponse
from app.services.staging_service import staging_service

router = APIRouter(prefix="/history", tags=["History"])


@router.get("/{id}", response_model=HistoryResponse)
def get_case_history(
    id: str,
    start_year: Optional[int] = Query(None, description="Filter from starting year (e.g. 2020)"),
    end_year: Optional[int] = Query(None, description="Filter up to ending year (e.g. 2026)"),
    limit: Optional[int] = Query(None, description="Limit to most recent N weekly observations"),
) -> HistoryResponse:
    """Return historical weekly case records for an RDHS area."""
    return staging_service.get_history(id, start_year=start_year, end_year=end_year, limit=limit)
