"""Alert schemas."""

from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class AlertRecord(BaseModel):
    """Provisional alert record for an RDHS area."""
    rdhs: str
    tier: str = Field(..., description="Provisional classification (Watch, Advisory, Warning)")
    verification_status: str = Field(default="UNVERIFIED")
    pE: Optional[float] = Field(None, description="Elevated probability")
    pH: Optional[float] = Field(None, description="High probability")
    rule: Optional[str] = Field(None, description="Triggering rule description")
    reasons: Optional[str] = Field(None, description="Diagnostic reasons text")
    failures: Optional[str] = Field(None, description="Quality or freshness failure details")
    C_fire: Optional[int] = Field(None, description="Elevated detector flag (1, 0, or null if missing/unverified)")
    D_fire: Optional[int] = Field(None, description="High detector flag (1, 0, or null if missing/unverified)")
    unverified: Optional[bool] = Field(None, description="Unverified status flag")
    detector_safety_notice: Optional[str] = Field(
        default="Missing or invalid detector flags must not be interpreted as evidence that no alert condition exists.",
        description="Non-negative assertion policy"
    )

    @field_validator("pE", "pH")
    @classmethod
    def validate_prob_range(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            if v < 0.0 or v > 1.0:
                raise ValueError(f"Probability must be between 0.0 and 1.0, got {v}")
        return v


class AlertListResponse(BaseModel):
    """Latest provisional alert status across all RDHS areas."""
    issue_start: Optional[str] = Field(None, description="Forecast issue date or null if missing")
    count: int = Field(default=26)
    provisional_notice: str = Field(
        default="These tiers are provisional project classifications, not official public-health declarations. "
        "Watch-Unverified indicates input freshness or verification requirements were not met. "
        "Flood proxies alone never trigger Warning."
    )
    records: List[AlertRecord]
