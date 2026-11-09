"""Tests for LeptoWatch Interactive Forecast Simulator API endpoints."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_simulator_discovery():
    """Verify discovery endpoint returns metadata, 26 RDHS, eligible dates, and presets."""
    response = client.get("/api/simulator/discovery")
    assert response.status_code == 200
    data = response.json()

    assert "rdhs_areas" in data
    assert len(data["rdhs_areas"]) == 26
    assert "Colombo" in data["rdhs_areas"]
    assert "Kalmunai" in data["rdhs_areas"]
    assert "Kurunegala" in data["rdhs_areas"]

    assert "eligible_years" in data
    assert 2024 in data["eligible_years"]
    assert 2023 in data["eligible_years"]

    assert data["locked_test_period_start"] == "2025-01-01"

    assert "scenario_presets" in data
    assert len(data["scenario_presets"]) >= 4

    assert "latest_accepted_snapshot" in data
    assert data["latest_accepted_snapshot"]["date"] == "2026-08-10"
    assert data["latest_accepted_snapshot"]["is_fresh_under_policy"] is False


def test_mode_a_historical_simulation_get_and_post():
    """Verify Mode A historical simulation executes inference and returns ground truth comparison."""
    # Test GET
    response_get = client.get("/api/simulator/historical?rdhs=Kurunegala&issue_date=2024-03-30")
    assert response_get.status_code == 200
    data_get = response_get.json()

    assert data_get["rdhs"] == "Kurunegala"
    assert data_get["issue_date"] == "2024-03-30"
    assert data_get["year"] == 2024
    assert data_get["t"] == 900
    assert data_get["forecast_target"].startswith("y35")

    # Check live inference
    assert data_get["live_inference"] is not None
    assert data_get["live_inference"]["mu"] > 0
    assert data_get["live_inference"]["interval"]["lo"] <= data_get["live_inference"]["interval"]["hi"]

    # Check archived OOF benchmark
    assert data_get["archived_oof"] is not None
    assert data_get["archived_oof"]["mu"] > 0

    # Check ground truth outcome comparison
    assert data_get["actual_outcome"]["is_available"] is True
    assert data_get["actual_outcome"]["actual_cases"] == 32.0
    assert data_get["actual_outcome"]["inside_interval"] is True
    assert abs(data_get["actual_outcome"]["error"]) < 10.0

    # Test POST
    payload = {
        "rdhs": "Colombo",
        "issue_date": "2024-03-30",
        "execution_mode": "both"
    }
    response_post = client.post("/api/simulator/historical", json=payload)
    assert response_post.status_code == 200
    data_post = response_post.json()
    assert data_post["rdhs"] == "Colombo"
    assert data_post["live_inference"]["mu"] > 0


def test_mode_a_locked_test_boundary_enforcement():
    """Verify Mode A strictly blocks dates on or after 2025-01-01 to protect locked test evaluation."""
    response = client.get("/api/simulator/historical?rdhs=Kurunegala&issue_date=2025-01-18")
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert "locked evaluation period" in detail or "2025-01-01" in detail


def test_mode_b_latest_snapshot_governance():
    """Verify Mode B retrieves latest snapshot, calculates age, and enforces operational gate."""
    response = client.get("/api/simulator/latest-snapshot?rdhs=Colombo")
    assert response.status_code == 200
    data = response.json()

    assert data["rdhs"] == "Colombo"
    assert data["latest_accepted_date"] == "2026-08-10"
    assert data["age_days"] >= 80
    assert data["is_fresh_under_policy"] is False
    assert data["operational_status_label"] == "EXPERIMENTAL FORECAST — STALE SURVEILLANCE INPUTS"
    assert "operational_gating_reason" in data
    assert data["forecast_available"] is True
    assert data["forecast_record"]["predicted_value"] is not None


def test_mode_c_scenario_simulation():
    """Verify Mode C evaluates what-if scenario with genuine tree-based inference."""
    payload = {
        "rdhs": "Kurunegala",
        "baseline_date": "2024-03-30",
        "scenario_name": "Heavy Monsoonal Precipitation (+50% Rain)",
        "rainfall_factor": 1.5,
        "rainfall_anomaly_offset_mm": 50.0,
        "soil_moisture_offset": 0.08
    }
    response = client.post("/api/simulator/scenario", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["rdhs"] == "Kurunegala"
    assert data["baseline_date"] == "2024-03-30"
    assert data["scenario_name"] == "Heavy Monsoonal Precipitation (+50% Rain)"

    # Verify baseline and scenario forecasts exist and are numeric
    assert data["baseline_forecast"]["mu"] > 0
    assert data["scenario_forecast"]["mu"] > 0

    # Verify comparison metrics
    comp = data["comparison"]
    assert "delta_mu" in comp
    assert "pct_change_mu" in comp
    assert comp["direction"] in ["INCREASE", "DECREASE", "NEUTRAL"]
    assert "interpretation" in comp

    # Verify provenance
    assert data["provenance"]["production_data_modified"] is False
    assert data["provenance"]["model_weights_modified"] is False


def test_mode_c_locked_test_boundary_enforcement():
    """Verify Mode C rejects baseline dates in 2025 or later."""
    payload = {
        "rdhs": "Kurunegala",
        "baseline_date": "2025-05-17",
        "scenario_name": "Test",
        "rainfall_factor": 1.25,
        "rainfall_anomaly_offset_mm": 0.0,
        "soil_moisture_offset": 0.0
    }
    response = client.post("/api/simulator/scenario", json=payload)
    assert response.status_code == 400
