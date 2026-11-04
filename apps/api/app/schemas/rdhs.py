"""RDHS area schemas."""

from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from app.schemas.common import PredictionInterval, QuantileForecast


class RDHSSummaryItem(BaseModel):
    """Brief summary item for RDHS list."""
    rdhs: str = Field(..., description="Canonical RDHS identifier")
    district: str = Field(..., description="Administrative district (Kalmunai is in Ampara district)")
    tier: str = Field(..., description="Provisional alert tier (Watch/Advisory/Warning)")
    data_quality_status: str = Field(..., description="Data quality classification (e.g. UNVERIFIED)")
    pE: Optional[float] = Field(None, description="Elevated probability (0.0 to 1.0) or null if missing")
    pH: Optional[float] = Field(None, description="High probability (0.0 to 1.0) or null if missing")
    mu: Optional[float] = Field(None, description="Point forecast mean")
    reasons: Optional[str] = Field(None, description="Diagnostic reasons text")

    @field_validator("pE", "pH")
    @classmethod
    def validate_prob_range(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            if v < 0.0 or v > 1.0:
                raise ValueError(f"Probability must be between 0.0 and 1.0, got {v}")
        return v


class RDHSDetailResponse(BaseModel):
    """Detailed area profile for a specific RDHS."""
    rdhs: str
    district: str
    issue_start: Optional[str] = Field(None, description="Forecast issue date or null if missing")
    tier: str
    data_quality_status: str
    record_type: str
    reasons: Optional[str] = None
    data_ok_staging: Optional[bool] = Field(None, description="Staging data quality pass flag, null if unverified")
    pE: Optional[float] = None
    pH: Optional[float] = None
    mu: Optional[float] = None
    interval: Optional[PredictionInterval] = None
    quantiles: Optional[QuantileForecast] = None
    nowcast_last3: Optional[float] = None
    thrE35: Optional[float] = None
    thrH35: Optional[float] = None
    C_fire: Optional[int] = Field(None, description="Elevated detector flag (1, 0, or null if unverified/missing)")
    D_fire: Optional[int] = Field(None, description="High detector flag (1, 0, or null if unverified/missing)")
    cases_age_days: Optional[int] = None
    failures: Optional[str] = None
    rule: Optional[str] = None
    unverified: Optional[bool] = Field(None, description="Unverified status flag")
    latest_accepted_case_week: Optional[str] = Field(None, description="Latest week with status=ok or null if none")

    @field_validator("pE", "pH")
    @classmethod
    def validate_prob_range(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            if v < 0.0 or v > 1.0:
                raise ValueError(f"Probability must be between 0.0 and 1.0, got {v}")
        return v


class RDHSListResponse(BaseModel):
    """Collection response of all 26 RDHS areas."""
    count: int = Field(default=26)
    records: List[RDHSSummaryItem]
