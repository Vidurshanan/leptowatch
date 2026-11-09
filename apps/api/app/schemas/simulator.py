"""Pydantic schemas for LeptoWatch Interactive Forecast Simulator."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import PredictionInterval, QuantileForecast


# ─────────────────────────────────────────────────────────────────────────────
# DISCOVERY SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class EligibleDateInfo(BaseModel):
    """Eligible historical issue date for simulation."""
    date: str
    year: int
    week: int
    t: int
    has_actual_outcome: bool
    label: str


class PresetScenarioOption(BaseModel):
    """Curated scenario demonstration preset."""
    id: str
    name: str
    description: str
    rainfall_factor: float
    rainfall_anomaly_offset_mm: float
    soil_moisture_offset: float
    category: str


class SimulatorDiscoveryResponse(BaseModel):
    """Metadata for simulator discovery and selector population."""
    rdhs_areas: List[str]
    eligible_years: List[int]
    total_eligible_dates: int
    sample_dates: List[EligibleDateInfo]
    locked_test_period_start: str = "2025-01-01"
    latest_accepted_snapshot: Dict[str, Any]
    scenario_presets: List[PresetScenarioOption]
    model_metadata: Dict[str, Any]
    disclaimer: str


# ─────────────────────────────────────────────────────────────────────────────
# MODE A: SIMULATED REAL-TIME SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class HistoricalSimulationRequest(BaseModel):
    """Request to simulate a historical forecast at a selected issue date."""
    rdhs: str = Field(..., description="Target RDHS health administrative area")
    issue_date: str = Field(..., description="Eligible historical issue date (YYYY-MM-DD), must be pre-2025")
    execution_mode: str = Field("both", description="'live_inference', 'archived_oof', or 'both'")


class ModelInferenceOutput(BaseModel):
    """Model inference results."""
    model_name: str
    model_type: str
    mu: float
    interval: Optional[PredictionInterval] = None
    quantiles: Optional[QuantileForecast] = None
    pE: Optional[float] = None
    pH: Optional[float] = None
    tier: Optional[str] = None
    provenance_note: str


class ActualOutcomeComparison(BaseModel):
    """Comparison against recorded ground truth outcome if available."""
    is_available: bool
    actual_cases: Optional[float] = None
    target_definition: str = "y35 (cumulative cases over weeks +3 to +5)"
    error: Optional[float] = None
    abs_error: Optional[float] = None
    pct_error: Optional[float] = None
    inside_interval: Optional[bool] = None
    inside_quantiles_5_95: Optional[bool] = None


class HistoricalSimulationResponse(BaseModel):
    """Complete response for Mode A simulated real-time forecast."""
    request_id: str
    rdhs: str
    district: str
    issue_date: str
    year: int
    week: int
    t: int
    forecast_target: str = "y35 (cumulative cases over forward weeks +3 to +5)"
    forecast_horizon: str = "+3 to +5 Weeks"
    execution_mode: str
    live_inference: Optional[ModelInferenceOutput] = None
    archived_oof: Optional[ModelInferenceOutput] = None
    actual_outcome: ActualOutcomeComparison
    input_snapshot: Dict[str, Any]
    provenance: Dict[str, Any]


# ─────────────────────────────────────────────────────────────────────────────
# MODE B: LATEST ACCEPTED SNAPSHOT SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class LatestSnapshotForecastResponse(BaseModel):
    """Response for Mode B latest accepted surveillance snapshot."""
    request_id: str
    rdhs: str
    district: str
    latest_accepted_date: str
    as_of_date: str
    age_days: int
    policy_threshold_days: int = 56
    is_fresh_under_policy: bool = False
    operational_status_label: str = "EXPERIMENTAL FORECAST — STALE SURVEILLANCE INPUTS"
    operational_gating_reason: str
    forecast_available: bool
    forecast_record: Optional[Dict[str, Any]] = None
    input_completeness: Dict[str, Any]
    environmental_context: Dict[str, Any]
    provenance: Dict[str, Any]


# ─────────────────────────────────────────────────────────────────────────────
# MODE C: ENVIRONMENTAL SCENARIO SIMULATOR SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class ScenarioSimulationRequest(BaseModel):
    """Request for Mode C environmental scenario evaluation."""
    rdhs: str = Field(..., description="Target RDHS area")
    baseline_date: str = Field(..., description="Eligible baseline issue date (pre-2025)")
    scenario_name: str = Field("Custom Scenario", description="Human-readable scenario name")
    rainfall_factor: float = Field(1.0, ge=0.0, le=4.0, description="Multiplier for rainfall features (e.g. 1.5 = +50%)")
    rainfall_anomaly_offset_mm: float = Field(0.0, ge=-200.0, le=500.0, description="Additional rainfall offset in mm")
    soil_moisture_offset: float = Field(0.0, ge=-0.3, le=0.3, description="Soil moisture volumetric offset in m³/m³")


class ScenarioConditionSummary(BaseModel):
    """Summary of environmental conditions for baseline or scenario."""
    rainfall_4w_mm: float
    rainfall_8w_mm: float
    rainfall_12w_mm: float
    soil_moisture_m3_m3: float
    case_history_c_last4: float


class ScenarioComparisonMetrics(BaseModel):
    """Comparison metrics between baseline and scenario predictions."""
    delta_mu: float
    pct_change_mu: float
    delta_pE: float
    delta_pH: float
    direction: str
    interpretation: str


class ScenarioSimulationResponse(BaseModel):
    """Complete response for Mode C scenario simulation."""
    request_id: str
    rdhs: str
    district: str
    baseline_date: str
    scenario_name: str
    forecast_target: str = "y35 (cumulative cases over forward weeks +3 to +5)"
    forecast_horizon: str = "+3 to +5 Weeks"
    baseline_conditions: ScenarioConditionSummary
    scenario_conditions: ScenarioConditionSummary
    baseline_forecast: ModelInferenceOutput
    scenario_forecast: ModelInferenceOutput
    comparison: ScenarioComparisonMetrics
    inputs_changed: List[str]
    scenario_assumptions: List[str]
    scientific_disclosure: str
    provenance: Dict[str, Any]
