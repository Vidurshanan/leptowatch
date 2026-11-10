"""Automated regression test suite for ERA5-Land Soil Moisture Intelligence across all 26 RDHS."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.data_loader import RDHS_DISTRICT_MAP

client = TestClient(app)


def test_environment_overview_soil_moisture():
    """Verify that environment overview reports 26/26 RDHS coverage for soil moisture."""
    response = client.get("/api/environment/overview")
    assert response.status_code == 200
    data = response.json()
    assert "soil_moisture" in data
    soil = data["soil_moisture"]
    assert soil["coverage_rdhs"] == 26
    assert soil["total_rdhs"] == 26
    assert soil["districts_in_csv"] == 25
    assert soil["latest_date"] == "2023-12-30"


def test_environment_summary_all_26_rdhs_have_soil_moisture():
    """Verify that every RDHS area has valid soil moisture in the summary."""
    response = client.get("/api/environment/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["rdhs_count"] == 26
    items = data["items"]
    assert len(items) == 26
    for item in items:
        assert item["has_soil_data"] is True, f"RDHS {item['rdhs']} missing soil data"
        assert item["mean_soil_moisture_2023"] is not None
        assert 0.1 <= item["mean_soil_moisture_2023"] <= 0.6, f"RDHS {item['rdhs']} mean out of range"
        assert item["latest_soil_moisture"] is not None


def test_colombo_soil_moisture_detail():
    """Verify Colombo RDHS returns 52 observations and expected volumetric statistics."""
    response = client.get("/api/environment/Colombo")
    assert response.status_code == 200
    data = response.json()
    assert data["rdhs"] == "Colombo"
    assert data["district"] == "Colombo"
    series = data["soil_moisture_series_2023"]
    assert len(series) == 52
    assert series[0]["week_start"] == "2023-01-07"
    assert series[-1]["week_start"] == "2023-12-30"

    fractions = [s["volumetric_fraction"] for s in series]
    mean_val = sum(fractions) / len(fractions)
    assert round(mean_val, 4) == 0.4403
    assert round(max(fractions), 4) == 0.4727
    assert round(min(fractions), 4) == 0.3410


@pytest.mark.parametrize("rdhs", [
    "Kurunegala",   # Previously working
    "Kandy",        # Previously working
    "Gampaha",      # Previously missing
    "Kalutara",     # Previously missing
    "Galle",        # Previously missing
    "Matara",       # Previously missing
    "Ratnapura",    # Previously missing
    "Kegalle",      # Previously missing
    "Nuwara Eliya", # Previously missing
    "Vavuniya",     # Previously missing
    "Kalmunai",     # Ampara proxy
])
def test_district_specific_soil_moisture_detail(rdhs):
    """Verify specific RDHS areas (both previously working and previously null) return 52 observations."""
    response = client.get(f"/api/environment/{rdhs}")
    assert response.status_code == 200
    data = response.json()
    series = data["soil_moisture_series_2023"]
    assert len(series) == 52, f"RDHS {rdhs} expected 52 weeks, got {len(series)}"
    assert series[0]["week_start"] == "2023-01-07"
    assert series[-1]["week_start"] == "2023-12-30"
    for s in series:
        assert isinstance(s["volumetric_fraction"], (int, float))
        assert 0.05 <= s["volumetric_fraction"] <= 0.55


def test_all_26_rdhs_detail_coverage():
    """Verify all 26 RDHS return 52 valid observations without nulls."""
    for rdhs in RDHS_DISTRICT_MAP:
        res = client.get(f"/api/environment/{rdhs}")
        assert res.status_code == 200
        data = res.json()
        series = data["soil_moisture_series_2023"]
        assert len(series) == 52, f"{rdhs} should have 52 weeks"


def test_rainfall_unaffected():
    """Verify that rainfall intelligence is unaffected and continues to function."""
    res = client.get("/api/environment/Colombo")
    assert res.status_code == 200
    data = res.json()
    rain = data["rainfall_series_2023"]
    assert len(rain) == 52
    assert rain[0]["week_start"] == "2023-01-07"
    assert rain[-1]["week_start"] == "2023-12-30"
    rain_vals = [r["rainfall_mm"] for r in rain]
    assert sum(rain_vals) > 1000
