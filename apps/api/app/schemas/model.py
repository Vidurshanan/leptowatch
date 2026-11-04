"""Model performance schemas."""

from typing import List, Optional
from pydantic import BaseModel, Field


class ModelMetric(BaseModel):
    """Evaluation metrics for a model candidate."""
    model_name: str
    code: str
    file: str
    n_samples: int
    mae: float
    rmse: float
    r2: Optional[float] = Field(None, description="Source-backed R2; null if unavailable in source report")
    r2_status: str = Field(
        default="NOT_REPORTED_IN_VERIFIED_OOF_REPORT",
        description="Explicit provenance note for R2"
    )
    wape: Optional[float] = None
    bias: Optional[float] = None
    rank: int
    source_dataset: str = Field(
        default="data/staging/model_experiments/oof_performance_reliability_scorecard/overall_metrics_staging.csv"
    )



class ModelPerformanceResponse(BaseModel):
    """Verified historical model performance metrics from staging reports."""
    evaluation_scope: str = Field(
        default="Historical Out-of-Fold (OOF) cross-validation on pre-2025 training panel (n=13,329)."
    )
    locked_test_boundary: str = Field(
        default="2025-01-01"
    )
    locked_test_status: str = Field(
        default="NOT_EVALUATED — Locked test data was not accessed."
    )
    operational_approval: bool = Field(
        default=False
    )
    model_status: str = Field(
        default="EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED"
    )
    calibration_summary: str = Field(
        default="Elevated/High probability calibration-in-the-large is slightly negative (predicted < observed)."
    )
    models: List[ModelMetric]
