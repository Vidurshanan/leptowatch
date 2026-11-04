"""Automated test suite verifying Phase 3 safety, provenance, and data rules."""

import math
import pytest
from pydantic import ValidationError

from app.schemas.common import PredictionInterval, QuantileForecast, FreshnessInfo
from app.schemas.rdhs import RDHSSummaryItem, RDHSDetailResponse
from app.schemas.alert import AlertRecord
from app.services.data_loader import (
    compute_freshness,
    sanitize_optional_bool,
    sanitize_optional_int,
    sanitize_float,
    get_latest_accepted_case_date,
)


def test_1_api_health(client):
    """1. Test API health status, distinguishing service health from dataset readiness."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["service_status"] == "OK"
    assert data["dataset_readiness"] in ["READY", "DEGRADED"]
    assert data["mode"] == "STAGING_DEMONSTRATION_NOT_OPERATIONAL"
    assert data["operational_approval"] is False
    assert data["locked_test_evaluated"] is False
    assert "data_sources" in data
    assert data["data_sources"]["forecast_staging_parquet"]["available"] is True


def test_2_rdhs_count(client):
    """2. Test RDHS count equals 26."""
    res = client.get("/api/rdhs")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 26
    assert len(data["records"]) == 26


def test_3_rdhs_identifiers_unique(client):
    """3. Test RDHS identifiers are unique and include Kalmunai mapped to Ampara district."""
    res = client.get("/api/rdhs")
    assert res.status_code == 200
    records = res.json()["records"]
    names = [r["rdhs"] for r in records]
    assert len(names) == len(set(names)), "RDHS names must be unique"
    assert "Kalmunai" in names
    assert "Ampara" in names

    kalmunai = next(r for r in records if r["rdhs"] == "Kalmunai")
    assert kalmunai["district"] == "Ampara"


def test_4_missing_cases_not_zero(client):
    """4. Test missing and unaccepted case reports are never converted to zero."""
    res = client.get("/api/history/Colombo")
    assert res.status_code == 200
    data = res.json()
    unaccepted = [r for r in data["records"] if r["status"] in ["no_accepted_report", "nonreporting"]]
    assert len(unaccepted) > 0, "Expected unaccepted weeks in the panel"
    for r in unaccepted:
        assert r["cases"] is None, f"Week {r['week_start']} has status {r['status']} but cases={r['cases']} (must be null!)"


def test_5_dynamic_freshness_calculation(client):
    """5. Test dynamic case freshness calculation against 56-day policy gate."""
    res = client.get("/api/dashboard/summary")
    assert res.status_code == 200
    data = res.json()
    freshness = data["freshness"]
    assert freshness["latest_accepted_date"] == "2026-08-10"
    assert freshness["policy_threshold_days"] == 56
    assert freshness["age_days"] >= 56
    assert freshness["is_fresh_under_policy"] is False

    # Ensure /api/data-quality uses the exact same calculation
    dq_res = client.get("/api/data-quality")
    assert dq_res.status_code == 200
    dq_freshness = dq_res.json()["national_summary"]["freshness"]
    assert dq_freshness["latest_accepted_date"] == freshness["latest_accepted_date"]
    assert dq_freshness["age_days"] == freshness["age_days"]
    assert dq_freshness["is_fresh_under_policy"] == freshness["is_fresh_under_policy"]


def test_6_no_accepted_reports_freshness():
    """6. Test explicit unavailable freshness state when no accepted reports exist."""
    freshness = compute_freshness(None)
    assert freshness["latest_accepted_date"] is None
    assert freshness["age_days"] is None
    assert freshness["is_fresh_under_policy"] is None
    assert freshness["status"] == "UNAVAILABLE_NO_ACCEPTED_REPORTS"


def test_7_missing_boolean_fields_and_detector_flags():
    """7. Test that NaN/None never converts to True or 0 silently."""
    # Boolean sanitizer: NaN must NOT become True
    assert sanitize_optional_bool(float("nan")) is None
    assert sanitize_optional_bool(None) is None
    assert sanitize_optional_bool(True) is True
    assert sanitize_optional_bool(False) is False
    assert sanitize_optional_bool(1) is True
    assert sanitize_optional_bool(0) is False

    # Int sanitizer for detector flags: NaN must NOT become 0
    assert sanitize_optional_int(float("nan")) is None
    assert sanitize_optional_int(None) is None
    assert sanitize_optional_int(1) == 1
    assert sanitize_optional_int(0) == 0

    # Schemas must permit nullable detector flags
    alert = AlertRecord(
        rdhs="TestArea",
        tier="Watch",
        verification_status="UNVERIFIED",
        C_fire=None,
        D_fire=None,
        unverified=None,
    )
    assert alert.C_fire is None
    assert alert.D_fire is None
    assert alert.unverified is None


def test_8_missing_probabilities_remain_null():
    """8. Test missing probabilities remain null and invalid probabilities are rejected."""
    # Sanitizer preserves NaN as None
    assert sanitize_float(float("nan")) is None
    assert sanitize_float(None) is None

    # Schema validation
    item = RDHSSummaryItem(
        rdhs="Test", district="Test", tier="Watch", data_quality_status="UNVERIFIED",
        pE=None, pH=None, mu=10.0
    )
    assert item.pE is None
    assert item.pH is None

    # Out of range probabilities rejected
    with pytest.raises(ValidationError):
        RDHSSummaryItem(
            rdhs="Test", district="Test", tier="Watch", data_quality_status="UNVERIFIED",
            pE=1.2, pH=0.1, mu=10.0
        )
    with pytest.raises(ValidationError):
        RDHSSummaryItem(
            rdhs="Test", district="Test", tier="Watch", data_quality_status="UNVERIFIED",
            pE=-0.05, pH=0.1, mu=10.0
        )


def test_9_metrics_provenance_and_r2_handling(client):
    """9. Test verified metrics provenance and ensure unverified R2 is not fabricated."""
    res = client.get("/api/model/performance")
    assert res.status_code == 200
    data = res.json()
    assert "pre-2025" in data["evaluation_scope"]
    assert data["locked_test_boundary"] == "2025-01-01"
    assert "NOT_EVALUATED" in data["locked_test_status"]
    assert data["operational_approval"] is False
    assert data["model_status"] == "EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED"

    models_by_code = {m["code"]: m for m in data["models"]}
    # Verify MAE and RMSE from source reports
    assert models_by_code["B0"]["mae"] == 9.601
    assert models_by_code["B0"]["rmse"] == 21.074

    assert models_by_code["B1"]["mae"] == 9.337
    assert models_by_code["B1"]["rmse"] == 19.038

    assert models_by_code["B2"]["mae"] == 8.006
    assert models_by_code["B2"]["rmse"] == 15.333

    assert models_by_code["Detector A"]["mae"] == 7.777
    assert models_by_code["Detector A"]["rmse"] == 15.099

    assert models_by_code["Detector B"]["mae"] == 7.814
    assert models_by_code["Detector B"]["rmse"] == 15.708

    assert models_by_code["Blend"]["mae"] == 7.517
    assert models_by_code["Blend"]["rmse"] == 14.960

    # Ensure R2 is null since it is not reported in overall_metrics_staging.csv
    for code, m in models_by_code.items():
        assert m["r2"] is None, f"Model {code} must not have fabricated R2!"
        assert m["r2_status"] == "NOT_REPORTED_IN_VERIFIED_OOF_REPORT"


def test_10_forecast_response_schemas(client):
    """10. Test forecast response schemas and ensure no invented defaults for case age."""
    res = client.get("/api/forecasts/latest")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] == 26
    assert len(data["records"]) == 26

    # Test individual detail
    res_ind = client.get("/api/forecasts/Kandy")
    assert res_ind.status_code == 200
    fc = res_ind.json()
    assert fc["rdhs"] == "Kandy"
    assert fc["staging_status"] == "EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED"
    assert fc["operational_approval"] is False


def test_11_prediction_interval_ordering(client):
    """11. Test prediction interval and quantile ordering across all 26 RDHS areas."""
    res = client.get("/api/forecasts/latest")
    assert res.status_code == 200
    for r in res.json()["records"]:
        if r["interval"]:
            lo = r["interval"]["lo"]
            hi = r["interval"]["hi"]
            assert lo <= hi, f"Interval ordering violated for {r['rdhs']}: {lo} > {hi}"
        if r["quantiles"]:
            q05 = r["quantiles"]["q0_05"]
            q50 = r["quantiles"]["q0_5"]
            q95 = r["quantiles"]["q0_95"]
            assert q05 <= q50 <= q95, f"Quantile ordering violated for {r['rdhs']}: {q05}, {q50}, {q95}"


def test_12_environment_as_of_safety_and_kalmunai_proxy(client):
    """12. Test environmental issue-time safety and Kalmunai district proxy labelling."""
    # Test Kalmunai
    res_kal = client.get("/api/environment/Kalmunai")
    assert res_kal.status_code == 200
    kal_data = res_kal.json()
    assert kal_data["rdhs"] == "Kalmunai"
    assert kal_data["district"] == "Ampara"
    assert kal_data["is_district_proxy"] is True
    assert "Ampara district data is a whole-district proxy" in kal_data["proxy_notes"]
    assert "not an area-specific observation for Kalmunai RDHS" in kal_data["proxy_notes"]
    assert kal_data["issue_time_availability_verified"] is False
    assert kal_data["model_inputs_as_of_status"] == "UNAVAILABLE_AT_ISSUE_TIME"

    # Test another RDHS (Colombo)
    res_col = client.get("/api/environment/Colombo")
    assert res_col.status_code == 200
    col_data = res_col.json()
    assert col_data["is_district_proxy"] is True
    assert col_data["model_inputs_as_of_status"] == "UNAVAILABLE_AT_ISSUE_TIME"
    assert "Experimental SAR flood proxy" in col_data["flood_proxy_notice"]


def test_13_missing_dataset_and_404_handling(client):
    """13. Test graceful 404 response when querying nonexistent RDHS."""
    assert client.get("/api/rdhs/nonexistent_area").status_code == 404
    assert client.get("/api/forecasts/nonexistent_area").status_code == 404
    assert client.get("/api/environment/nonexistent_area").status_code == 404
    assert client.get("/api/history/nonexistent_area").status_code == 404


def test_14_read_only_behaviour(client):
    """14. Test that mutating HTTP methods (POST, PUT, DELETE) are refused (405)."""
    assert client.post("/api/forecasts/latest").status_code == 405
    assert client.put("/api/rdhs/Colombo").status_code == 405
    assert client.delete("/api/alerts/latest").status_code == 405
    assert client.post("/api/dashboard/summary").status_code == 405
    assert client.post("/api/data-quality").status_code == 405


def test_15_forecast_missing_horizon_and_issue_handling(client):
    """15. Test that missing forecast horizon is null and not hardcoded to 1."""
    res = client.get("/api/forecasts/latest")
    assert res.status_code == 200
    data = res.json()
    for record in data["records"]:
        assert record["horizon_weeks"] is None, f"Expected horizon_weeks=None, got {record['horizon_weeks']}"

    res_ind = client.get("/api/forecasts/Colombo")
    assert res_ind.status_code == 200
    fc = res_ind.json()
    assert fc["horizon_weeks"] is None


def test_16_history_summary_missing_accepted_week_null():
    """16. Test that HistorySummary latest_accepted_week is None (not string 'None') when no accepted reports."""
    from app.services.data_loader import data_loader
    from app.services.staging_service import staging_service
    import pandas as pd
    from unittest.mock import patch

    mock_cases = pd.DataFrame([
        {"rdhs": "ZeroOkArea", "week_start": "2024-01-01", "year": 2024, "week": 1, "t": 100, "cases": None, "cases_ytd": None, "status": "no_accepted_report"},
        {"rdhs": "ZeroOkArea", "week_start": "2024-01-08", "year": 2024, "week": 2, "t": 101, "cases": None, "cases_ytd": None, "status": "nonreporting"},
    ])
    with patch.object(data_loader, "_df_cases", mock_cases):
        resp = staging_service.get_history("ZeroOkArea")
        assert resp.summary.latest_accepted_week is None
        assert resp.summary.latest_accepted_week != "None"
        assert resp.summary.accepted_weeks_count == 0
        assert resp.summary.unaccepted_weeks_count == 2


def test_17_missing_metrics_source_reporting():
    """17. Test that missing metrics dataset returns explicit unavailable state without fabricating values."""
    from app.services.data_loader import data_loader
    from app.services.staging_service import staging_service
    from unittest.mock import patch

    with patch.object(data_loader, "_df_metrics", None):
        resp = staging_service.get_model_performance()
        assert resp.models == []
        assert resp.evaluation_scope == "UNAVAILABLE_SOURCE_METRICS_MISSING"
        assert resp.locked_test_status == "NOT_EVALUATED_SOURCE_METRICS_MISSING"


def test_18_geo_endpoint_rdhs_count_and_crs(client):
    """18. Test geographic GeoJSON endpoint returns all 26 RDHS areas with valid WGS84 CRS."""
    res = client.get("/api/geo/rdhs")
    assert res.status_code == 200
    data = res.json()
    assert data["type"] == "FeatureCollection"
    assert data["count"] == 26
    assert len(data["features"]) == 26
    assert data["crs"] == "EPSG:4326"
    assert data["boundary_validation_status"] == "UNRESOLVED_SPATIAL_OVERLAPS"
    assert data["unparseable_geometries"] == [], f"Unparseable geometries found: {data['unparseable_geometries']}"

    # Verify geometries and coordinates within Sri Lanka WGS84 bounds
    for feat in data["features"]:
        assert feat["type"] == "Feature"
        geom = feat["geometry"]
        assert geom["type"] in ["Polygon", "MultiPolygon"]
        assert len(geom["coordinates"]) > 0


def test_19_geo_kalmunai_separate_entity(client):
    """19. Test Kalmunai remains a distinct RDHS feature from Ampara with whole-district proxy note."""
    res = client.get("/api/geo/rdhs")
    assert res.status_code == 200
    features = {f["id"]: f for f in res.json()["features"]}

    assert "Kalmunai" in features, "Kalmunai must be present as a separate RDHS feature"
    assert "Ampara" in features, "Ampara must be present as a separate RDHS feature"

    kal = features["Kalmunai"]["properties"]
    amp = features["Ampara"]["properties"]

    assert kal["rdhs"] == "Kalmunai"
    assert kal["district"] == "Ampara"
    assert kal["is_district_proxy"] is True
    assert "Ampara district data is a whole-district proxy" in kal["proxy_notes"]

    assert amp["rdhs"] == "Ampara"
    assert amp["district"] == "Ampara"
    assert amp["is_district_proxy"] is False


def test_20_geo_provisional_warning_and_staging_notice(client):
    """20. Test mandatory provisional boundary warning and staging disclaimer."""
    res = client.get("/api/geo/rdhs")
    assert res.status_code == 200
    data = res.json()
    assert "PROVISIONAL RDHS BOUNDARY VISUALIZATION" in data["provisional_warning"]
    assert "Unverified boundaries must not be claimed as officially validated" in data["provisional_warning"]
    assert "experimental research classifications" in data["staging_classification_notice"]
    assert "never be interpreted as validated official public-health epidemiological warnings" in data["staging_classification_notice"]


def test_21_geo_properties_derived_from_staging(client):
    """21. Test feature properties (tier, pE, pH, mu) are derived from actual staging forecast records."""
    res = client.get("/api/geo/rdhs")
    assert res.status_code == 200
    data = res.json()
    features = {f["id"]: f["properties"] for f in data["features"]}

    # Verify Colombo properties match staging forecasts
    col = features.get("Colombo")
    assert col is not None
    assert col["rdhs"] == "Colombo"
    assert col["district"] == "Colombo"
    assert col["tier"] == "Watch"
    assert col["data_quality_status"] == "UNVERIFIED"
    assert col["pE"] is not None
    assert col["pH"] is not None
    assert col["mu"] is not None

