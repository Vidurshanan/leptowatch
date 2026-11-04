"""Health check schema."""

from typing import Dict, Any, List
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """API health and environment status."""
    service: str = Field(default="LeptoWatch Read-Only Staging API")
    service_status: str = Field(default="OK", description="Process execution health: OK or ERROR")
    dataset_readiness: str = Field(..., description="Data availability status: READY, DEGRADED, or UNAVAILABLE")
    version: str = Field(default="0.1.0")
    mode: str = Field(default="STAGING_DEMONSTRATION_NOT_OPERATIONAL")
    operational_approval: bool = Field(default=False)
    locked_test_evaluated: bool = Field(default=False)
    loading_errors: List[str] = Field(default_factory=list, description="Explicit record of dataset loading errors")
    data_sources: Dict[str, Any] = Field(..., description="Availability status of registered staging files")
    freshness_policy_days: int = Field(default=56)

