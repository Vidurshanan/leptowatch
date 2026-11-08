"""Forecast schemas."""

from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from app.schemas.common import PredictionInterval, QuantileForecast


class ForecastRecord(BaseModel):
    """Single RDHS forecast item."""
    rdhs: str
    issue_start: Optional[str] = Field(None, description="Forecast issue date or null if missing")
    horizon_weeks: Optional[int] = Field(None, description="Forecast lead time in weeks, null if unspecified in source")
    predicted_value: Optional[float] = Field(None, description="Predicted mean case count (mu)")
    interval: Optional[PredictionInterval] = Field(None, description="Prediction interval (lo, hi)")
    quantiles: Optional[QuantileForecast] = Field(None, description="Quantiles q0.05, q0.5, q0.95")
    pE: Optional[float] = Field(None, description="Elevated probability")
    pH: Optional[float] = Field(None, description="High probability")
    tier: str = Field(..., description="Staging alert tier")
    data_quality_status: str = Field(..., description="Data quality classification")
    staging_status: str = Field(
        default="EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED",
        description="Clear staging caveat: not approved for operational use"
    )

    @field_validator("pE", "pH")
    @classmethod
    def validate_prob_range(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            if v < 0.0 or v > 1.0:
                raise ValueError(f"Probability must be between 0.0 and 1.0, got {v}")
        return v


class ForecastListResponse(BaseModel):
    """List response of latest staging forecasts across RDHS areas."""
    issue_start: Optional[str] = Field(None, description="Forecast issue date or null if missing")
    count: int = Field(default=26)
    staging_caveat: str = Field(
        default="Experimental staging outputs. Prediction intervals are not confidence intervals. "
        "Watch-Unverified is not confirmed epidemiological disease activity."
    )
    records: List[ForecastRecord]


class ForecastDetailResponse(BaseModel):
    """Detailed forecast for a single RDHS."""
    rdhs: str
    issue_start: Optional[str] = Field(None, description="Forecast issue date or null if missing")
    horizon_weeks: Optional[int] = Field(None, description="Forecast lead time in weeks, null if unspecified in source")
    predicted_value: Optional[float] = None
    interval: Optional[PredictionInterval] = None
    quantiles: Optional[QuantileForecast] = None
    pE: Optional[float] = None
    pH: Optional[float] = None
    tier: str
    data_quality_status: str
    staging_status: str = "EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED"
    operational_approval: bool = False
    cases_age_days: Optional[int] = None
    freshness_policy_limit: int = 56
    reasons: Optional[str] = None
    caveat: str = (
        "Prediction intervals reflect staging model spread, not official confidence intervals. "
        "Staging inference does not establish operational predictive validity."
    )

    @field_validator("pE", "pH")
    @classmethod
    def validate_prob_range(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            if v < 0.0 or v > 1.0:
                raise ValueError(f"Probability must be between 0.0 and 1.0, got {v}")
        return v


class HistoricalValidationRecord(BaseModel):
    """Retrospective out-of-fold benchmark record for an RDHS."""
    t: int
    issue_start: str
    target_period: str = "t+3..t+5"
    predicted_mu: Optional[float] = None
    actual_y35: Optional[float] = None
    lo: Optional[float] = None
    hi: Optional[float] = None
    pE: Optional[float] = None
    pH: Optional[float] = None


class HistoricalValidationSummary(BaseModel):
    """Summary of historical model validation performance."""
    sample_count: int
    mae: Optional[float] = None
    rmse: Optional[float] = None
    evaluated_year: int = 2024
    target_definition: str = (
        "y35: Reported leptospirosis case total accumulated over forecast weeks t+3 through t+5"
    )
    status_label: str = "HISTORICAL MODEL VALIDATION — NOT CURRENT FORECAST"
    caveat: str = (
        "Retrospective out-of-fold benchmark predictions (2012–2024). "
        "Strictly quarantined from locked test data (2025-01-01 onwards). "
        "Must never be presented as current operational forecasts."
    )


class HistoricalValidationResponse(BaseModel):
    """Historical validation dataset for an RDHS area."""
    rdhs: str
    summary: HistoricalValidationSummary
    records: List[HistoricalValidationRecord]
