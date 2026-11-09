"""Router for LeptoWatch Interactive Forecast Simulator."""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from app.schemas.simulator import (
    HistoricalSimulationRequest,
    HistoricalSimulationResponse,
    LatestSnapshotForecastResponse,
    ScenarioSimulationRequest,
    ScenarioSimulationResponse,
    SimulatorDiscoveryResponse,
)
from app.services.simulator_service import simulator_service

router = APIRouter(prefix="/simulator", tags=["Forecast Simulator"])


@router.get("/discovery", response_model=SimulatorDiscoveryResponse)
def get_simulator_discovery() -> SimulatorDiscoveryResponse:
    """Return simulator metadata, eligible historical dates, presets, and model specs."""
    return simulator_service.get_discovery()


@router.post("/historical", response_model=HistoricalSimulationResponse)
def simulate_historical_post(request: HistoricalSimulationRequest) -> HistoricalSimulationResponse:
    """Mode A: Execute historical simulation with live inference and archived benchmark comparison (POST)."""
    return simulator_service.simulate_historical(request)


@router.get("/historical", response_model=HistoricalSimulationResponse)
def simulate_historical_get(
    rdhs: str = Query("Kurunegala", description="Target RDHS health area"),
    issue_date: str = Query("2024-03-30", description="Historical issue date (pre-2025)"),
    execution_mode: str = Query("both", description="'live_inference', 'archived_oof', or 'both'"),
) -> HistoricalSimulationResponse:
    """Mode A: Execute historical simulation with live inference and archived benchmark comparison (GET)."""
    req = HistoricalSimulationRequest(
        rdhs=rdhs,
        issue_date=issue_date,
        execution_mode=execution_mode,
    )
    return simulator_service.simulate_historical(req)


@router.get("/latest-snapshot", response_model=LatestSnapshotForecastResponse)
def simulate_latest_snapshot(
    rdhs: str = Query("Colombo", description="Target RDHS health area"),
) -> LatestSnapshotForecastResponse:
    """Mode B: Retrieve forecast and governance audit for latest accepted surveillance snapshot."""
    return simulator_service.simulate_latest_snapshot(rdhs)


@router.post("/scenario", response_model=ScenarioSimulationResponse)
def simulate_scenario_post(request: ScenarioSimulationRequest) -> ScenarioSimulationResponse:
    """Mode C: Evaluate an environmental what-if scenario using actual tree-based inference (POST)."""
    return simulator_service.simulate_scenario(request)


@router.get("/scenario", response_model=ScenarioSimulationResponse)
def simulate_scenario_get(
    rdhs: str = Query("Kurunegala", description="Target RDHS health area"),
    baseline_date: str = Query("2024-03-30", description="Baseline historical issue date (pre-2025)"),
    scenario_name: str = Query("Moderate Monsoonal Surge", description="Scenario display name"),
    rainfall_factor: float = Query(1.25, ge=0.0, le=4.0, description="Multiplier for rainfall features"),
    rainfall_anomaly_offset_mm: float = Query(25.0, ge=-200.0, le=500.0, description="Rainfall offset in mm"),
    soil_moisture_offset: float = Query(0.03, ge=-0.3, le=0.3, description="Soil moisture volumetric shift in m³/m³"),
) -> ScenarioSimulationResponse:
    """Mode C: Evaluate an environmental what-if scenario using actual tree-based inference (GET)."""
    req = ScenarioSimulationRequest(
        rdhs=rdhs,
        baseline_date=baseline_date,
        scenario_name=scenario_name,
        rainfall_factor=rainfall_factor,
        rainfall_anomaly_offset_mm=rainfall_anomaly_offset_mm,
        soil_moisture_offset=soil_moisture_offset,
    )
    return simulator_service.simulate_scenario(req)
