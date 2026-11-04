"""Common models, enums and validators for LeptoWatch API."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, model_validator


class CaseStatus(str, Enum):
    """Recognized surveillance case reporting statuses."""
    OK = "ok"
    NONREPORTING = "nonreporting"
    NO_ACCEPTED_REPORT = "no_accepted_report"


class AlertTier(str, Enum):
    """Provisional project alert tiers."""
    WATCH = "Watch"
    ADVISORY = "Advisory"
    WARNING = "Warning"


class PredictionInterval(BaseModel):
    """Prediction interval bounds (not confidence intervals)."""
    lo: float = Field(..., description="Lower prediction interval bound")
    hi: float = Field(..., description="Upper prediction interval bound")
    nominal_coverage: float = Field(default=0.90, description="Nominal interval coverage level (e.g. 0.90 for 90%)")

    @model_validator(mode="after")
    def validate_interval_ordering(self) -> "PredictionInterval":
        if self.lo > self.hi:
            raise ValueError(f"Lower interval bound {self.lo} exceeds upper bound {self.hi}")
        return self


class QuantileForecast(BaseModel):
    """Forecast quantiles."""
    q0_05: float = Field(..., description="5th percentile forecast")
    q0_5: float = Field(..., description="Median (50th percentile) forecast")
    q0_95: float = Field(..., description="95th percentile forecast")

    @model_validator(mode="after")
    def validate_quantile_ordering(self) -> "QuantileForecast":
        if not (self.q0_05 <= self.q0_5 <= self.q0_95):
            raise ValueError(
                f"Quantile ordering violated: q0.05={self.q0_05}, q0.5={self.q0_5}, q0.95={self.q0_95}"
            )
        return self


class FreshnessInfo(BaseModel):
    """Surveillance reporting freshness calculation."""
    latest_accepted_date: Optional[str] = Field(None, description="Latest week with status=ok (YYYY-MM-DD), null if no accepted reports")
    as_of_date: str = Field(..., description="Date against which freshness was computed (YYYY-MM-DD)")
    age_days: Optional[int] = Field(None, description="Dynamic day difference between latest report and as_of_date, null if unavailable")
    policy_threshold_days: int = Field(default=56, description="Internal 56-day policy gate")
    is_fresh_under_policy: Optional[bool] = Field(None, description="Whether age_days <= policy_threshold_days, null if unavailable")
    status: str = Field(default="CALCULATED", description="CALCULATED or UNAVAILABLE_NO_ACCEPTED_REPORTS")
    policy_caveat: str = Field(
        default="The 56-day gate is an internal project safety policy, not an official reporting-delay standard."
    )

