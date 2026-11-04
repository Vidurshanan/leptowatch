"""Data quality schemas."""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import FreshnessInfo


class RDHSQualityItem(BaseModel):
    """Quality summary for an individual RDHS."""
    rdhs: str
    total_weeks: int
    accepted_weeks: int
    missing_weeks: int
    nonreporting_weeks: int
    completeness_pct: float
    latest_accepted_week: Optional[str] = Field(None, description="Latest week with status=ok or null if none")
    current_status: str


class DataQualitySummary(BaseModel):
    """National data quality breakdown."""
    total_reports: int = Field(default=26936)
    accepted_reports: int = Field(default=23573, description="status=ok")
    missing_reports: int = Field(default=3354, description="status=no_accepted_report")
    nonreporting_reports: int = Field(default=9, description="status=nonreporting")
    accepted_percentage: float = Field(default=87.51)
    freshness: FreshnessInfo
    operational_status: str = Field(
        default="BLOCKED_STALE_ACCEPTED_CASE_DATA",
        description="Freshness age exceeds 56-day gate"
    )
    unaccepted_reports_rule: str = Field(
        default="Unaccepted reports are preserved as null. They are never filled with zero."
    )


class DataQualityResponse(BaseModel):
    """Comprehensive data quality response."""
    national_summary: DataQualitySummary
    rdhs_breakdown: List[RDHSQualityItem]
