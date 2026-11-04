"""Surveillance case history schemas."""

from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import CaseStatus


class HistoryRecord(BaseModel):
    """Weekly case reporting record."""
    week_start: str = Field(..., description="Week start date (YYYY-MM-DD)")
    year: int
    week: int
    t: int = Field(..., description="Relative time index (0=2007-W01)")
    cases: Optional[float] = Field(None, description="Reported case count; null if unaccepted or nonreporting")
    cases_ytd: Optional[float] = None
    status: CaseStatus = Field(..., description="ok, nonreporting, or no_accepted_report")


class HistorySummary(BaseModel):
    """Summary of historical case observations for an area."""
    total_weeks: int
    accepted_weeks_count: int
    unaccepted_weeks_count: int
    latest_accepted_week: Optional[str] = Field(None, description="Latest week with status=ok, or null if none")
    latest_panel_week: Optional[str] = Field(None, description="Latest week in panel, or null if empty")
    safety_rule: str = Field(
        default="Missing or unaccepted case reports (no_accepted_report, nonreporting) are strictly null and never filled as zero."
    )


class HistoryResponse(BaseModel):
    """Historical case time series response."""
    rdhs: str
    district: str
    summary: HistorySummary
    records: List[HistoryRecord]
