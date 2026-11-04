"""Dashboard summary schema."""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import FreshnessInfo


class DashboardSummaryResponse(BaseModel):
    """National surveillance staging summary."""
    mode: str = Field(default="STAGING_DEMONSTRATION_NOT_OPERATIONAL")
    operational_approval: bool = Field(default=False)
    issue_start: Optional[str] = Field(None, description="Demonstration issue week start date (YYYY-MM-DD), null if missing")
    rdhs_count: int = Field(default=26, description="Total coverage count of RDHS areas")
    tier_counts: Dict[str, int] = Field(..., description="Counts of RDHS per alert tier (Watch, Advisory, Warning)")
    data_quality_counts: Dict[str, int] = Field(..., description="Counts of RDHS per data quality status")
    freshness: FreshnessInfo = Field(..., description="National case data freshness calculation")
    staging_banner: str = Field(
        default="Staging demonstration — not approved for operational public-health use. "
        "Watch + UNVERIFIED means freshness or verification requirements were not met; "
        "it is not evidence of elevated disease activity."
    )
    known_limitations: List[str] = Field(..., description="Caveats documented in demonstration manifest")
