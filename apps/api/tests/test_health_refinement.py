"""Comprehensive verification of refined health check, model bundle visibility, and OOF telemetry."""

import os
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.services.data_loader import data_loader
from app.services.simulator_service import simulator_service
from app.services.staging_service import staging_service


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_model_bundle_exists_and_loaded(client):
    """Scenario 1: Model bundle file exists on disk and is loaded in process memory."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()

    assert "model_bundle" in data
    bundle_info = data["model_bundle"]
    assert bundle_info["available"] is True
    assert bundle_info["file_exists"] is True
    assert bundle_info["loaded_in_memory"] is True

    # Also exposed via data_sources dictionary
    assert "model_bundle" in data["data_sources"]
    assert data["data_sources"]["model_bundle"]["loaded_in_memory"] is True


def test_model_bundle_missing_handles_gracefully(client):
    """Scenario 2: When model bundle file is missing, health check returns 200 without raising exceptions."""
    fake_path = Path("non_existent_bundle_path_test.pkl")

    with patch.object(simulator_service, "_bundle_path", fake_path), \
         patch.object(simulator_service, "_bundle", None):

        status = simulator_service.get_bundle_status()
        assert status["file_exists"] is False
        assert status["loaded_in_memory"] is False
        assert status["available"] is False

        res = client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["model_bundle"]["file_exists"] is False
        assert data["model_bundle"]["loaded_in_memory"] is False


def test_historical_oof_loaded(client):
    """Scenario 3: Historical OOF benchmark matrix is mounted, accessible, and contains expected rows."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()

    assert "historical_oof" in data
    oof_info = data["historical_oof"]
    assert oof_info["available"] is True
    assert oof_info["accessible"] is True
    assert oof_info["loaded_in_memory"] is True
    assert oof_info["rows"] > 10000  # 17,628 rows across 26 RDHS

    # Also exposed via data_sources dictionary
    assert "historical_oof" in data["data_sources"]
    assert data["data_sources"]["historical_oof"]["rows"] == oof_info["rows"]


def test_historical_oof_missing_handles_gracefully(client):
    """Scenario 4: When historical OOF file is missing or unmounted, health check returns 200 without crashing."""
    fake_path = Path("non_existent_oof_file.csv")

    with patch.object(settings, "historical_oof_path", fake_path), \
         patch.object(data_loader, "_df_historical_oof", None):

        res = client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["historical_oof"]["available"] is False
        assert data["historical_oof"]["loaded_in_memory"] is False
        assert data["historical_oof"]["rows"] == 0


def test_core_dataset_missing_readiness_unavailable(client):
    """Scenario 5: When a core surveillance dataset (e.g. cases_weekly) is missing, readiness transitions to UNAVAILABLE."""
    with patch.object(data_loader, "_df_cases", None):
        res = client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["dataset_readiness"] == "UNAVAILABLE"


def test_secondary_environmental_missing_readiness_degraded(client):
    """Scenario 6: When a secondary dataset throws a load error, readiness transitions to DEGRADED."""
    # Inject a simulated secondary loading error
    original_errors = list(data_loader.loading_errors)
    try:
        data_loader.loading_errors.append("Simulated test: Secondary environmental raster offline")
        res = client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["dataset_readiness"] == "DEGRADED"
        assert len(data["loading_errors"]) > 0
    finally:
        data_loader.loading_errors = original_errors


def test_api_health_safety_governance_preserved(client):
    """Scenario 7: Operational approval remains strictly FALSE and locked test evaluated remains FALSE."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()

    assert data["operational_approval"] is False
    assert data["locked_test_evaluated"] is False
    assert data["mode"] == "STAGING_DEMONSTRATION_NOT_OPERATIONAL"


def test_health_latency_measurement_contract(client):
    """Scenario 8: Health endpoint responds under 50ms and maintains clean contract for frontend performance.now()."""
    import time

    t0 = time.perf_counter()
    res = client.get("/api/health")
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    assert res.status_code == 200
    # Health endpoint is a lightweight in-memory inspection responding in <50ms
    assert elapsed_ms < 50.0
    data = res.json()
    assert data["service_status"] == "OK"
