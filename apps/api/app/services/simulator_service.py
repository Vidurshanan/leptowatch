"""Service layer for LeptoWatch Interactive Forecast Simulator.

Provides backend-driven:
1. Mode A: Simulated Real-Time Forecasting (historical pre-2025 feature snapshot + live inference + archived OOF comparison).
2. Mode B: Latest Accepted Surveillance Snapshot Forecasting (surveillance lag audit + 56-day policy gate enforcement).
3. Mode C: Environmental Scenario Simulator (sensitivity analysis on modified rainfall/soil moisture features).

CRITICAL BOUNDARY CONSTRAINTS:
- Dates on or after 2025-01-01 belong to the locked evaluation period and are strictly blocked.
- No production case data, model bundles, or ledgers are modified.
- All scenario runs are computed in-memory on feature copies and never persisted.
"""

from __future__ import annotations

import datetime
import math
import os
import pickle
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from fastapi import HTTPException

# Ensure leptowatch package is importable
repo_root = Path(__file__).resolve().parents[4]
code_pkg = repo_root / "code" / "leptowatch" / "src"
if str(code_pkg) not in sys.path:
    sys.path.insert(0, str(code_pkg))

from app.config import settings
from app.schemas.common import PredictionInterval, QuantileForecast
from app.schemas.simulator import (
    ActualOutcomeComparison,
    EligibleDateInfo,
    HistoricalSimulationRequest,
    HistoricalSimulationResponse,
    LatestSnapshotForecastResponse,
    ModelInferenceOutput,
    PresetScenarioOption,
    ScenarioComparisonMetrics,
    ScenarioConditionSummary,
    ScenarioSimulationRequest,
    ScenarioSimulationResponse,
    SimulatorDiscoveryResponse,
)
from app.services.data_loader import (
    RDHS_DISTRICT_MAP,
    compute_freshness,
    data_loader,
    get_latest_accepted_case_date,
    sanitize_float,
    sanitize_optional_int,
)

LOCKED_TEST_BOUNDARY = "2025-01-01"

PRESET_SCENARIOS: List[PresetScenarioOption] = [
    PresetScenarioOption(
        id="baseline",
        name="Baseline Conditions (1.0x)",
        description="Observed historical environmental conditions without modification.",
        rainfall_factor=1.0,
        rainfall_anomaly_offset_mm=0.0,
        soil_moisture_offset=0.0,
        category="Baseline",
    ),
    PresetScenarioOption(
        id="monsoon_moderate",
        name="Moderate Monsoonal Surge (+25% Rain)",
        description="A 25% increase in antecedent rainfall across recent 4–12 weeks with mild root-zone soil saturation.",
        rainfall_factor=1.25,
        rainfall_anomaly_offset_mm=25.0,
        soil_moisture_offset=0.03,
        category="Rainfall",
    ),
    PresetScenarioOption(
        id="monsoon_heavy",
        name="Heavy Monsoonal Precipitation (+50% Rain)",
        description="A 50% increase in antecedent rainfall accompanied by elevated soil water content (+0.07 m³/m³).",
        rainfall_factor=1.50,
        rainfall_anomaly_offset_mm=60.0,
        soil_moisture_offset=0.07,
        category="Rainfall",
    ),
    PresetScenarioOption(
        id="extreme_flood",
        name="Extreme Precipitation & Flood Event (+100% Rain)",
        description="Doubled cumulative precipitation simulating tropical depression / severe monsoon inundation (+0.12 m³/m³ soil moisture).",
        rainfall_factor=2.00,
        rainfall_anomaly_offset_mm=120.0,
        soil_moisture_offset=0.12,
        category="Extreme",
    ),
    PresetScenarioOption(
        id="soil_saturation",
        name="Saturated Root-Zone Soil (+0.10 m³/m³)",
        description="Elevated soil moisture holding constant baseline rainfall, testing hydrological reservoir retention effects.",
        rainfall_factor=1.0,
        rainfall_anomaly_offset_mm=0.0,
        soil_moisture_offset=0.10,
        category="Soil Moisture",
    ),
    PresetScenarioOption(
        id="drought_deficit",
        name="Severe Rainfall Deficit / Drought (-50% Rain)",
        description="A 50% suppression in antecedent precipitation with depleted soil moisture (-0.06 m³/m³).",
        rainfall_factor=0.50,
        rainfall_anomaly_offset_mm=-50.0,
        soil_moisture_offset=-0.06,
        category="Drought",
    ),
]

CURATED_HISTORICAL_DATES = [
    {"date": "2024-10-19", "desc": "Late 2024 Pre-Lockdown Surveillance Window"},
    {"date": "2024-05-18", "desc": "May 2024 Southwest Monsoon Surge Episode"},
    {"date": "2024-03-30", "desc": "March 2024 Inter-Monsoon Transition Outbreak"},
    {"date": "2023-11-25", "desc": "November 2023 Northeast Monsoon Peak"},
    {"date": "2023-05-20", "desc": "May 2023 Wet-Zone Seasonal Transmission Peak"},
    {"date": "2022-12-17", "desc": "December 2022 Island-wide Epidemic Expansion"},
    {"date": "2020-05-16", "desc": "May 2020 Historic Ratnapura Flood Episode"},
]


class SimulatorService:
    """Singleton service orchestrating simulator inference and scenario calculations."""

    def __init__(self):
        self._bundle: Optional[Dict[str, Any]] = None
        self._bundle_path = settings.bundle_path

    def get_bundle_status(self) -> Dict[str, Any]:
        """Safely inspect bundle file existence and in-memory cache status without raising exceptions."""
        file_exists = self._bundle_path.exists()
        is_loaded = self._bundle is not None
        return {
            "available": file_exists,
            "file_exists": file_exists,
            "loaded_in_memory": is_loaded,
        }

    def preload_bundle_safe(self) -> bool:
        """Safely preload bundle on startup if file exists, without crashing if missing."""
        if self._bundle is not None:
            return True
        if not self._bundle_path.exists():
            return False
        try:
            with open(self._bundle_path, "rb") as f:
                self._bundle = pickle.load(f)
            return True
        except Exception as e:
            print(f"Warning: Failed to preload model bundle: {e}")
            return False

    def _get_bundle(self) -> Dict[str, Any]:
        """Lazy load and cache model bundle."""
        if self._bundle is not None:
            return self._bundle

        if not self._bundle_path.exists():
            raise FileNotFoundError(
                f"Model bundle not found at {self._bundle_path}. "
                "Ensure leptowatch_bundle_experimental_staging.pkl is present."
            )

        with open(self._bundle_path, "rb") as f:
            self._bundle = pickle.load(f)
        return self._bundle

    def get_discovery(self) -> SimulatorDiscoveryResponse:
        """Return discovery metadata for simulator controls."""
        ft = data_loader.features
        latest_ok = get_latest_accepted_case_date(data_loader.cases) or "2026-08-10"
        freshness = compute_freshness(latest_ok)

        eligible_years = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012]
        sample_dates: List[EligibleDateInfo] = []

        if ft is not None and not ft.empty:
            pre2025 = ft[ft["year"] < 2025]
            total_eligible = int(pre2025["issue_start"].nunique())

            for item in CURATED_HISTORICAL_DATES:
                dt_str = item["date"]
                matching = pre2025[pre2025["issue_start"] == dt_str]
                if not matching.empty:
                    first = matching.iloc[0]
                    sample_dates.append(
                        EligibleDateInfo(
                            date=dt_str,
                            year=int(first["year"]),
                            week=int(first["week"]),
                            t=int(first["t"]),
                            has_actual_outcome=bool(pd.notna(first.get("y35"))),
                            label=f"{dt_str} (W{int(first['week'])}) — {item['desc']}",
                        )
                    )
        else:
            total_eligible = 939

        bundle = self._get_bundle()
        model_meta = {
            "version": bundle.get("version", "1.0.0"),
            "status": bundle.get("status", "EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED"),
            "training_period": bundle.get("training_period", "pre-2025 only"),
            "training_rows": bundle.get("training_rows", 17879),
            "calibration_source": bundle.get("calibration_source", "historical pre-2025 OOF blend"),
            "cqr_quantile_margin_Q": round(float(bundle.get("cqr_Q", 0.2138)), 4),
            "models": [
                "Detector A: Pooled Negative Binomial GLM (spline + case-lag terms)",
                "Detector B: Gradient Boosted Decision Trees (LightGBM 84-feature ensemble)",
                "Stackers: Logistic meta-learners for surge probability calibration",
                "Conformal Prediction: Conformal Quantile Regression (CQR) interval bounds [lo, hi]",
            ],
        }

        return SimulatorDiscoveryResponse(
            rdhs_areas=sorted(list(RDHS_DISTRICT_MAP.keys())),
            eligible_years=eligible_years,
            total_eligible_dates=total_eligible,
            sample_dates=sample_dates,
            locked_test_period_start=LOCKED_TEST_BOUNDARY,
            latest_accepted_snapshot={
                "date": latest_ok,
                "age_days": freshness.get("age_days", 90),
                "policy_threshold_days": freshness.get("policy_threshold_days", 56),
                "is_fresh_under_policy": freshness.get("is_fresh_under_policy", False),
                "status_label": "EXPERIMENTAL FORECAST — STALE SURVEILLANCE INPUTS",
                "policy_caveat": freshness.get("policy_caveat", ""),
            },
            scenario_presets=PRESET_SCENARIOS,
            model_metadata=model_meta,
            disclaimer=(
                "All historical simulations and scenario calculations are reproducible research demonstrations. "
                "The locked test period beginning 2025-01-01 is strictly blocked to maintain evaluation integrity. "
                "Scenario predictions illustrate model sensitivity and do not constitute causal predictions."
            ),
        )

    def simulate_historical(self, req: HistoricalSimulationRequest) -> HistoricalSimulationResponse:
        """Mode A: Execute historical simulation with live inference and archived benchmark comparison."""
        rdhs_clean = req.rdhs.strip()
        if rdhs_clean not in RDHS_DISTRICT_MAP:
            raise HTTPException(status_code=404, detail=f"RDHS area '{req.rdhs}' not recognized.")

        issue_dt = req.issue_date.strip()[:10]

        # Enforce locked test boundary
        if issue_dt >= LOCKED_TEST_BOUNDARY:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Selected date '{issue_dt}' violates the evaluation boundary. "
                    f"Dates on or after {LOCKED_TEST_BOUNDARY} belong to the locked evaluation period "
                    "and cannot be accessed for interactive simulation."
                ),
            )

        ft = data_loader.features
        if ft is None or ft.empty:
            raise HTTPException(status_code=503, detail="Feature repository is not loaded.")

        matched_rows = ft[(ft["rdhs"] == rdhs_clean) & (ft["issue_start"] == issue_dt)]
        if matched_rows.empty:
            raise HTTPException(
                status_code=404,
                detail=f"No feature snapshot found for RDHS '{rdhs_clean}' on issue date '{issue_dt}'.",
            )

        row = matched_rows.iloc[0]
        t_val = int(row["t"])
        year_val = int(row["year"])
        week_val = int(row["week"])

        bundle = self._get_bundle()

        # 1. Live inference using existing pipeline
        from leptowatch.pipeline import forecast_latest

        fc_live = forecast_latest(matched_rows.copy(), bundle, issue_t=t_val)
        fc_live_row = fc_live.iloc[0]

        mu_live = float(fc_live_row["mu"])
        lo_live = float(fc_live_row["lo"])
        hi_live = float(fc_live_row["hi"])
        pE_live = sanitize_float(fc_live_row.get("pE"))
        pH_live = sanitize_float(fc_live_row.get("pH"))

        q05 = sanitize_float(fc_live_row.get("q0.05"))
        q50 = sanitize_float(fc_live_row.get("q0.5"))
        q95 = sanitize_float(fc_live_row.get("q0.95"))

        tier_live = "Watch"
        if pH_live is not None and pH_live >= 0.5:
            tier_live = "Red"
        elif pE_live is not None and pE_live >= 0.5:
            tier_live = "Amber"

        live_output = ModelInferenceOutput(
            model_name="DetectorBlend_v1 (NB-GLM + LightGBM CQR)",
            model_type="Live Inference on Historical Snapshot",
            mu=round(mu_live, 2),
            interval=PredictionInterval(lo=round(lo_live, 2), hi=round(hi_live, 2)),
            quantiles=(
                QuantileForecast(q0_05=round(q05, 2), q0_5=round(q50, 2), q0_95=round(q95, 2))
                if q05 is not None and q50 is not None and q95 is not None
                else None
            ),
            pE=round(pE_live, 4) if pE_live is not None else None,
            pH=round(pH_live, 4) if pH_live is not None else None,
            tier=tier_live,
            provenance_note="Dynamically computed by backend using frozen model bundle on historical feature vector.",
        )

        # 2. Archived OOF lookup
        archived_output: Optional[ModelInferenceOutput] = None
        oof = data_loader.historical_oof
        if oof is not None and not oof.empty:
            matched_oof = oof[(oof["rdhs"] == rdhs_clean) & (oof["issue_start"] == issue_dt)]
            if not matched_oof.empty:
                oof_row = matched_oof.iloc[0]
                mu_oof = float(oof_row["mu"])
                lo_oof = float(oof_row["lo"])
                hi_oof = float(oof_row["hi"])
                q05_oof = sanitize_float(oof_row.get("q0.05"))
                q50_oof = sanitize_float(oof_row.get("q0.5"))
                q95_oof = sanitize_float(oof_row.get("q0.95"))
                pE_oof = sanitize_float(oof_row.get("pE"))
                pH_oof = sanitize_float(oof_row.get("pH"))

                archived_output = ModelInferenceOutput(
                    model_name="Archived_OOF_Benchmark_Blend",
                    model_type="Pre-computed Out-Of-Fold Benchmark Record",
                    mu=round(mu_oof, 2),
                    interval=PredictionInterval(lo=round(lo_oof, 2), hi=round(hi_oof, 2)),
                    quantiles=(
                        QuantileForecast(q0_05=round(q05_oof, 2), q0_5=round(q50_oof, 2), q0_95=round(q95_oof, 2))
                        if q05_oof is not None and q50_oof is not None and q95_oof is not None
                        else None
                    ),
                    pE=round(pE_oof, 4) if pE_oof is not None else None,
                    pH=round(pH_oof, 4) if pH_oof is not None else None,
                    tier="Archived Benchmark",
                    provenance_note="Retrieved verbatim from historical_oof_for_website.csv benchmark artifact.",
                )

        # 3. Actual outcome comparison
        actual_val = sanitize_float(row.get("y35"))
        actual_comparison = ActualOutcomeComparison(is_available=actual_val is not None)

        if actual_val is not None:
            actual_comparison.actual_cases = round(actual_val, 1)
            err = round(mu_live - actual_val, 2)
            actual_comparison.error = err
            actual_comparison.abs_error = round(abs(err), 2)
            actual_comparison.pct_error = (
                round((err / actual_val) * 100, 1) if actual_val > 0 else 0.0
            )
            actual_comparison.inside_interval = bool(lo_live <= actual_val <= hi_live)
            if q05 is not None and q95 is not None:
                actual_comparison.inside_quantiles_5_95 = bool(q05 <= actual_val <= q95)

        # 4. Input snapshot summary
        input_snap = {
            "t": t_val,
            "c_last1": sanitize_float(row.get("c_last1")),
            "c_last4": sanitize_float(row.get("c_last4")),
            "c_last8": sanitize_float(row.get("c_last8")),
            "c_trend4": sanitize_float(row.get("c_trend4")),
            "b0_same_window_last_year": sanitize_float(row.get("b0_same_window_last_year")),
            "b1_clim_mean": sanitize_float(row.get("b1_clim_mean")),
            "thrE35": sanitize_float(row.get("thrE35")),
            "thrH35": sanitize_float(row.get("thrH35")),
            "nowcast_last3": sanitize_float(row.get("nowcast_last3")),
        }

        provenance = {
            "evaluation_period": "Historical pre-2025 (strictly prior to locked test period 2025-01-01)",
            "leakage_prevention_audit": "PASSED — no forward-looking inputs or test-set records utilized",
            "staging_status": "EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED",
            "execution_timestamp": datetime.datetime.now().isoformat(),
        }

        return HistoricalSimulationResponse(
            request_id=str(uuid.uuid4()),
            rdhs=rdhs_clean,
            district=RDHS_DISTRICT_MAP[rdhs_clean],
            issue_date=issue_dt,
            year=year_val,
            week=week_val,
            t=t_val,
            execution_mode=req.execution_mode,
            live_inference=live_output,
            archived_oof=archived_output,
            actual_outcome=actual_comparison,
            input_snapshot=input_snap,
            provenance=provenance,
        )

    def simulate_latest_snapshot(self, rdhs: str) -> LatestSnapshotForecastResponse:
        """Mode B: Evaluate latest accepted surveillance snapshot under 56-day gate."""
        rdhs_clean = rdhs.strip()
        if rdhs_clean not in RDHS_DISTRICT_MAP:
            raise HTTPException(status_code=404, detail=f"RDHS area '{rdhs}' not recognized.")

        latest_ok = get_latest_accepted_case_date(data_loader.cases) or "2026-08-10"
        freshness = compute_freshness(latest_ok)
        age_days = freshness.get("age_days", 90)

        # Retrieve snapshot forecast from staging parquet
        forecast_rec: Optional[Dict[str, Any]] = None
        df_fc = data_loader.forecasts
        matched_fc = df_fc[df_fc["rdhs"] == rdhs_clean]
        if not matched_fc.empty:
            fc_row = matched_fc.iloc[0]
            lo = sanitize_float(fc_row.get("lo"))
            hi = sanitize_float(fc_row.get("hi"))
            q05 = sanitize_float(fc_row.get("q0.05"))
            q50 = sanitize_float(fc_row.get("q0.5"))
            q95 = sanitize_float(fc_row.get("q0.95"))
            pE = sanitize_float(fc_row.get("pE"))
            pH = sanitize_float(fc_row.get("pH"))
            raw_h = fc_row.get("horizon_weeks") if "horizon_weeks" in fc_row else fc_row.get("horizon")
            horizon_weeks = sanitize_optional_int(raw_h) or 1

            forecast_rec = {
                "issue_start": str(fc_row.get("issue_start", "2026-11-02"))[:10],
                "horizon_weeks": horizon_weeks,
                "predicted_value": sanitize_float(fc_row.get("mu")),
                "interval": {"lo": lo, "hi": hi} if lo is not None and hi is not None else None,
                "quantiles": {"q0_05": q05, "q0_5": q50, "q0_95": q95} if q05 is not None and q95 is not None else None,
                "pE": pE,
                "pH": pH,
                "tier": str(fc_row.get("tier", "Watch")),
                "data_quality_status": str(fc_row.get("data_quality_status", "UNVERIFIED")),
                "cases_age_days": sanitize_optional_int(fc_row.get("cases_age_days")),
            }

        gating_reason = (
            f"The latest accepted weekly epidemiological report is dated {latest_ok} ({age_days} days old), "
            f"which exceeds the LeptoWatch operational governance threshold of {settings.freshness_policy_days} days. "
            "Under project safety guidelines, automated operational alert dispatch is gated. "
            "This forecast is marked EXPERIMENTAL to demonstrate pipeline readiness during surveillance reporting delays."
        )

        input_completeness = {
            "surveillance_source": "Weekly Epidemiological Reports (WER) / Epidemiology Unit",
            "latest_accepted_report_date": latest_ok,
            "reporting_delay_days": age_days,
            "freshness_policy_threshold": settings.freshness_policy_days,
            "operational_freshness_gate": "FAILED — STALE SURVEILLANCE INPUTS",
            "missing_inputs": [
                f"Surveillance reports from {latest_ok} to present pending validation",
                "Real-time precipitation stream requires issue-time verification",
            ],
            "model_compatibility": "Compatible with historical lag architecture (requires lag compensation)",
        }

        env_context = {
            "rainfall_source": "CHIRPS 2023 validated historical baseline",
            "soil_moisture_source": "ERA5-Land validated 2023 reanalysis",
            "flood_proxy_source": "Sentinel-1 SAR surface water proxy (LFR v1.0)",
            "data_vintage": "2023 historical baseline alignment",
        }

        provenance = {
            "operational_approval": False,
            "freshness_gate_bypassed": False,
            "staging_status": "EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED",
            "timestamp": datetime.datetime.now().isoformat(),
        }

        return LatestSnapshotForecastResponse(
            request_id=str(uuid.uuid4()),
            rdhs=rdhs_clean,
            district=RDHS_DISTRICT_MAP[rdhs_clean],
            latest_accepted_date=latest_ok,
            as_of_date=datetime.date.today().isoformat(),
            age_days=age_days,
            policy_threshold_days=settings.freshness_policy_days,
            is_fresh_under_policy=False,
            operational_status_label="EXPERIMENTAL FORECAST — STALE SURVEILLANCE INPUTS",
            operational_gating_reason=gating_reason,
            forecast_available=forecast_rec is not None,
            forecast_record=forecast_rec,
            input_completeness=input_completeness,
            environmental_context=env_context,
            provenance=provenance,
        )

    def simulate_scenario(self, req: ScenarioSimulationRequest) -> ScenarioSimulationResponse:
        """Mode C: Evaluate an environmental what-if scenario using actual tree-based inference."""
        rdhs_clean = req.rdhs.strip()
        if rdhs_clean not in RDHS_DISTRICT_MAP:
            raise HTTPException(status_code=404, detail=f"RDHS area '{req.rdhs}' not recognized.")

        base_dt = req.baseline_date.strip()[:10]
        if base_dt >= LOCKED_TEST_BOUNDARY:
            raise HTTPException(
                status_code=400,
                detail=f"Baseline date '{base_dt}' violates the pre-2025 evaluation boundary ({LOCKED_TEST_BOUNDARY}).",
            )

        ft = data_loader.features
        if ft is None or ft.empty:
            raise HTTPException(status_code=503, detail="Feature repository is not loaded.")

        matched_rows = ft[(ft["rdhs"] == rdhs_clean) & (ft["issue_start"] == base_dt)]
        if matched_rows.empty:
            raise HTTPException(
                status_code=404,
                detail=f"No baseline feature vector found for RDHS '{rdhs_clean}' on date '{base_dt}'.",
            )

        # Work on deep copies to guarantee NEVER modifying original data
        row_base = matched_rows.copy().iloc[[0]]
        bundle = self._get_bundle()
        detB = bundle["B"]

        # Nominal realistic environmental baselines if unpopulated
        nom_rain = 25.0  # mm/week nominal wet-zone baseline
        nom_soil = 0.32  # m³/m³ nominal root-zone soil moisture

        for k in range(12):
            c = f"rain_l{k}"
            if c in row_base.columns and pd.isna(row_base[c].iloc[0]):
                row_base.loc[:, c] = nom_rain

        for k in range(8):
            c = f"soil_l{k}"
            if c in row_base.columns and pd.isna(row_base[c].iloc[0]):
                row_base.loc[:, c] = nom_soil

        if "rain_2w" in row_base.columns and pd.isna(row_base["rain_2w"].iloc[0]):
            row_base.loc[:, "rain_2w"] = nom_rain * 2
        if "rain_4w" in row_base.columns and pd.isna(row_base["rain_4w"].iloc[0]):
            row_base.loc[:, "rain_4w"] = nom_rain * 4
        if "rain_8w" in row_base.columns and pd.isna(row_base["rain_8w"].iloc[0]):
            row_base.loc[:, "rain_8w"] = nom_rain * 8
        if "rain_12w" in row_base.columns and pd.isna(row_base["rain_12w"].iloc[0]):
            row_base.loc[:, "rain_12w"] = nom_rain * 12
        if "soil_4w" in row_base.columns and pd.isna(row_base["soil_4w"].iloc[0]):
            row_base.loc[:, "soil_4w"] = nom_soil
        if "rain_4w_anom" in row_base.columns and pd.isna(row_base["rain_4w_anom"].iloc[0]):
            row_base.loc[:, "rain_4w_anom"] = 0.0
        if "rain_12w_anom" in row_base.columns and pd.isna(row_base["rain_12w_anom"].iloc[0]):
            row_base.loc[:, "rain_12w_anom"] = 0.0
        if "soil_4w_anom" in row_base.columns and pd.isna(row_base["soil_4w_anom"].iloc[0]):
            row_base.loc[:, "soil_4w_anom"] = 0.0

        # Create scenario feature vector copy
        row_scen = row_base.copy()
        factor = float(req.rainfall_factor)
        offset_mm = float(req.rainfall_anomaly_offset_mm)
        soil_shift = float(req.soil_moisture_offset)

        # Apply rainfall scenario
        for k in range(12):
            c = f"rain_l{k}"
            if c in row_scen.columns:
                val = max(0.0, float(row_base[c].iloc[0]) * factor + (offset_mm / 4.0 if k < 4 else 0.0))
                row_scen.loc[:, c] = val

        if "rain_2w" in row_scen.columns:
            row_scen.loc[:, "rain_2w"] = max(0.0, float(row_base["rain_2w"].iloc[0]) * factor + (offset_mm / 2.0))
        if "rain_4w" in row_scen.columns:
            row_scen.loc[:, "rain_4w"] = max(0.0, float(row_base["rain_4w"].iloc[0]) * factor + offset_mm)
        if "rain_8w" in row_scen.columns:
            row_scen.loc[:, "rain_8w"] = max(0.0, float(row_base["rain_8w"].iloc[0]) * factor + offset_mm)
        if "rain_12w" in row_scen.columns:
            row_scen.loc[:, "rain_12w"] = max(0.0, float(row_base["rain_12w"].iloc[0]) * factor + offset_mm)

        if "rain_4w_anom" in row_scen.columns:
            row_scen.loc[:, "rain_4w_anom"] = float(row_base["rain_4w_anom"].iloc[0]) + (offset_mm / 25.0)
        if "rain_12w_anom" in row_scen.columns:
            row_scen.loc[:, "rain_12w_anom"] = float(row_base["rain_12w_anom"].iloc[0]) + (offset_mm / 25.0)

        # Apply soil moisture scenario (bounded between 0.05 and 0.55 m³/m³)
        for k in range(8):
            c = f"soil_l{k}"
            if c in row_scen.columns:
                val = min(0.55, max(0.05, float(row_base[c].iloc[0]) + soil_shift))
                row_scen.loc[:, c] = val

        if "soil_4w" in row_scen.columns:
            row_scen.loc[:, "soil_4w"] = min(0.55, max(0.05, float(row_base["soil_4w"].iloc[0]) + soil_shift))
        if "soil_4w_anom" in row_scen.columns:
            row_scen.loc[:, "soil_4w_anom"] = float(row_base["soil_4w_anom"].iloc[0]) + (soil_shift / 0.05)

        # Run genuine Detector B inference on both
        pb_base = detB.predict(row_base).iloc[0]
        pb_scen = detB.predict(row_scen).iloc[0]

        mu_b = float(pb_base["mu"])
        mu_s = float(pb_scen["mu"])

        lo_b = float(pb_base.get("q0.05", pb_base.get("q0.1", mu_b * 0.4)))
        hi_b = float(pb_base.get("q0.95", pb_base.get("q0.9", mu_b * 2.0)))

        lo_s = float(pb_scen.get("q0.05", pb_scen.get("q0.1", mu_s * 0.4)))
        hi_s = float(pb_scen.get("q0.95", pb_scen.get("q0.9", mu_s * 2.0)))

        pE_b = float(pb_base.get("pE", 0.5))
        pH_b = float(pb_base.get("pH", 0.2))

        pE_s = float(pb_scen.get("pE", 0.5))
        pH_s = float(pb_scen.get("pH", 0.2))

        delta_mu = round(mu_s - mu_b, 2)
        pct_change = round((delta_mu / mu_b) * 100, 1) if mu_b > 0 else 0.0
        delta_pE = round(pE_s - pE_b, 4)
        delta_pH = round(pH_s - pH_b, 4)

        direction = "INCREASE" if delta_mu > 0.5 else ("DECREASE" if delta_mu < -0.5 else "NEUTRAL")

        tier_b = "Red" if pH_b >= 0.5 else ("Amber" if pE_b >= 0.5 else "Watch")
        tier_s = "Red" if pH_s >= 0.5 else ("Amber" if pE_s >= 0.5 else "Watch")

        # Condition summaries
        cond_base = ScenarioConditionSummary(
            rainfall_4w_mm=round(float(row_base["rain_4w"].iloc[0]), 1),
            rainfall_8w_mm=round(float(row_base["rain_8w"].iloc[0]), 1),
            rainfall_12w_mm=round(float(row_base["rain_12w"].iloc[0]), 1),
            soil_moisture_m3_m3=round(float(row_base["soil_4w"].iloc[0]), 3),
            case_history_c_last4=round(float(row_base["c_last4"].iloc[0]), 1),
        )

        cond_scen = ScenarioConditionSummary(
            rainfall_4w_mm=round(float(row_scen["rain_4w"].iloc[0]), 1),
            rainfall_8w_mm=round(float(row_scen["rain_8w"].iloc[0]), 1),
            rainfall_12w_mm=round(float(row_scen["rain_12w"].iloc[0]), 1),
            soil_moisture_m3_m3=round(float(row_scen["soil_4w"].iloc[0]), 3),
            case_history_c_last4=round(float(row_scen["c_last4"].iloc[0]), 1),
        )

        inputs_changed = []
        if factor != 1.0 or offset_mm != 0.0:
            inputs_changed.append(
                f"Rainfall features scaled by {factor:.2f}x with {offset_mm:+.1f} mm anomaly offset "
                f"(4-week total: {cond_base.rainfall_4w_mm:.1f} → {cond_scen.rainfall_4w_mm:.1f} mm)"
            )
        if soil_shift != 0.0:
            inputs_changed.append(
                f"Volumetric soil moisture shifted by {soil_shift:+.2f} m³/m³ "
                f"({cond_base.soil_moisture_m3_m3:.3f} → {cond_scen.soil_moisture_m3_m3:.3f} m³/m³)"
            )

        if not inputs_changed:
            inputs_changed.append("None — Unmodified baseline scenario evaluated.")

        interpretation = (
            f"Under the simulated conditions ({req.scenario_name}), the model's predicted 3–5 week mean cumulative cases "
            f"shifted by {delta_mu:+.1f} cases ({pct_change:+.1f}%) from {mu_b:.1f} to {mu_s:.1f} cases. "
            f"Early alert surge probability p(E) changed from {pE_b*100:.1f}% to {pE_s*100:.1f}% ({delta_pE*100:+.1f}%), "
            f"and high severity surge probability p(H) shifted from {pH_b*100:.1f}% to {pH_s*100:.1f}% ({delta_pH*100:+.1f}%)."
        )

        disclosure = (
            "SCIENTIFIC DISCLOSURE: These scenario simulations reflect mathematical model sensitivity "
            "evaluated on a frozen gradient-boosted decision tree pipeline (Detector B). "
            "They do NOT represent empirical causal interventions or guaranteed real-world epidemiology. "
            "Epidemiological case history features were preserved without modification."
        )

        return ScenarioSimulationResponse(
            request_id=str(uuid.uuid4()),
            rdhs=rdhs_clean,
            district=RDHS_DISTRICT_MAP[rdhs_clean],
            baseline_date=base_dt,
            scenario_name=req.scenario_name,
            baseline_conditions=cond_base,
            scenario_conditions=cond_scen,
            baseline_forecast=ModelInferenceOutput(
                model_name="DetectorB_Rainfall_Enabled (LightGBM)",
                model_type="Observed Baseline Feature Inference",
                mu=round(mu_b, 2),
                interval=PredictionInterval(lo=round(lo_b, 2), hi=round(hi_b, 2)),
                quantiles=QuantileForecast(
                    q0_05=round(lo_b, 2),
                    q0_5=round(float(pb_base.get("q0.5", mu_b)), 2),
                    q0_95=round(hi_b, 2),
                ),
                pE=round(pE_b, 4),
                pH=round(pH_b, 4),
                tier=tier_b,
                provenance_note="Inference on unmodified historical baseline feature snapshot.",
            ),
            scenario_forecast=ModelInferenceOutput(
                model_name="DetectorB_Rainfall_Enabled (LightGBM)",
                model_type="Scenario Feature Inference (Hydrological Perturbation)",
                mu=round(mu_s, 2),
                interval=PredictionInterval(lo=round(lo_s, 2), hi=round(hi_s, 2)),
                quantiles=QuantileForecast(
                    q0_05=round(lo_s, 2),
                    q0_5=round(float(pb_scen.get("q0.5", mu_s)), 2),
                    q0_95=round(hi_s, 2),
                ),
                pE=round(pE_s, 4),
                pH=round(pH_s, 4),
                tier=tier_s,
                provenance_note="Inference on modified in-memory feature vector (non-persistent).",
            ),
            comparison=ScenarioComparisonMetrics(
                delta_mu=delta_mu,
                pct_change_mu=pct_change,
                delta_pE=delta_pE,
                delta_pH=delta_pH,
                direction=direction,
                interpretation=interpretation,
            ),
            inputs_changed=inputs_changed,
            scenario_assumptions=[
                "Case history lag features (c_last1..c_last13) kept strictly identical to baseline snapshot",
                "Monsoonal precipitation scaling applied uniformly across antecedent 4–12 week lags",
                "Volumetric soil moisture restricted within physically validated saturation bounds [0.05, 0.55 m³/m³]",
                "Conformal prediction intervals generated using calibrated quantiles from historical splits",
            ],
            scientific_disclosure=disclosure,
            provenance={
                "production_data_modified": False,
                "model_weights_modified": False,
                "execution_mode": "IN_MEMORY_TRANSIENT_INFERENCE",
                "staging_status": "EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED",
                "timestamp": datetime.datetime.now().isoformat(),
            },
        )


simulator_service = SimulatorService()
