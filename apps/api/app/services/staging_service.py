"""Domain service providing read-only endpoints over LeptoWatch staging data."""

from typing import Dict, List, Optional, Any
import pandas as pd
from fastapi import HTTPException

from app.schemas.common import PredictionInterval, QuantileForecast, FreshnessInfo, CaseStatus
from app.schemas.health import HealthResponse
from app.schemas.summary import DashboardSummaryResponse
from app.schemas.rdhs import RDHSSummaryItem, RDHSDetailResponse, RDHSListResponse
from app.schemas.forecast import ForecastRecord, ForecastListResponse, ForecastDetailResponse
from app.schemas.alert import AlertRecord, AlertListResponse
from app.schemas.environment import EnvironmentDetailResponse, RainfallSeriesItem, SoilMoistureSeriesItem
from app.schemas.history import HistoryRecord, HistoryResponse, HistorySummary
from app.schemas.model import ModelMetric, ModelPerformanceResponse
from app.schemas.data_quality import DataQualityResponse, DataQualitySummary, RDHSQualityItem
from app.services.data_loader import (
    data_loader,
    RDHS_DISTRICT_MAP,
    sanitize_val,
    sanitize_float,
    sanitize_optional_int,
    sanitize_optional_bool,
    compute_freshness,
    get_latest_accepted_case_date,
)


class StagingService:
    """Read-only business service."""

    @staticmethod
    def _find_rdhs_row(df: pd.DataFrame, rdhs_id: str) -> Optional[pd.Series]:
        """Case-insensitive matching of RDHS name."""
        match = df[df["rdhs"].astype(str).str.casefold() == str(rdhs_id).strip().casefold()]
        if match.empty:
            return None
        return match.iloc[0]

    def get_health(self) -> HealthResponse:
        """System health and data-source availability, distinguishing service health from data readiness."""
        data_loader.load_all()

        has_forecast = False
        forecast_rows = 0
        try:
            fc = data_loader.forecasts
            has_forecast = True
            forecast_rows = len(fc)
        except Exception:
            pass

        has_cases = False
        cases_rows = 0
        try:
            cs = data_loader.cases
            has_cases = True
            cases_rows = len(cs)
        except Exception:
            pass

        data_sources = {
            "demonstration_manifest": {
                "available": bool(data_loader.manifest),
            },
            "forecast_staging_parquet": {
                "available": has_forecast,
                "rows": forecast_rows,
                "expected_rdhs_count": 26,
            },
            "cases_weekly_csv": {
                "available": has_cases,
                "rows": cases_rows,
            },
            "features_parquet": {
                "available": data_loader.features is not None,
            },
            "overall_metrics_csv": {
                "available": data_loader.metrics is not None,
            },
            "rainfall_2023_csv": {
                "available": data_loader.rain_2023 is not None,
            },
            "soil_moisture_2023_csv": {
                "available": data_loader.soil_2023 is not None,
            },
            "flood_series_csv": {
                "available": data_loader.flood is not None,
            },
        }

        readiness = data_loader.get_readiness_status()

        return HealthResponse(
            service="LeptoWatch Read-Only Staging API",
            service_status="OK",
            dataset_readiness=readiness,
            version="0.1.0",
            mode="STAGING_DEMONSTRATION_NOT_OPERATIONAL",
            operational_approval=False,
            locked_test_evaluated=False,
            loading_errors=list(data_loader.loading_errors),
            data_sources=data_sources,
            freshness_policy_days=56,
        )

    def get_summary(self) -> DashboardSummaryResponse:
        """National surveillance overview using dynamic case freshness."""
        df = data_loader.forecasts
        manifest = data_loader.manifest

        issue_start = (
            str(df["issue_start"].iloc[0])[:10]
            if "issue_start" in df and not df.empty and pd.notna(df["issue_start"].iloc[0])
            else None
        )

        tier_counts = {str(k): int(v) for k, v in df["tier"].value_counts().items()}
        quality_counts = {
            str(k): int(v) for k, v in df["data_quality_status"].value_counts().items()
        }

        # Dynamic case freshness derived directly from accepted case records
        latest_ok = get_latest_accepted_case_date(data_loader.cases)
        freshness_dict = compute_freshness(latest_ok)
        freshness_info = FreshnessInfo(**freshness_dict)

        limitations = manifest.get("known_limitations", [
            "Accepted case data freshness gate may block operational use.",
            "Staging inference does not establish current-period predictive validity.",
            "Environmental predictor issue-time availability has not been verified.",
            "Alert thresholds are not production-approved.",
            "The locked test has not been evaluated.",
        ])

        return DashboardSummaryResponse(
            mode="STAGING_DEMONSTRATION_NOT_OPERATIONAL",
            operational_approval=False,
            issue_start=issue_start,
            rdhs_count=int(df["rdhs"].nunique()),
            tier_counts=tier_counts,
            data_quality_counts=quality_counts,
            freshness=freshness_info,
            staging_banner=(
                "Staging demonstration — not approved for operational public-health use. "
                "Watch + UNVERIFIED means freshness or verification requirements were not met; "
                "it is not evidence of elevated disease activity."
            ),
            known_limitations=limitations,
        )

    def get_rdhs_list(self) -> RDHSListResponse:
        """List summary of all 26 RDHS areas."""
        df = data_loader.forecasts
        items: List[RDHSSummaryItem] = []

        for _, row in df.iterrows():
            rdhs_name = str(row["rdhs"])
            district = RDHS_DISTRICT_MAP.get(rdhs_name, rdhs_name)
            items.append(
                RDHSSummaryItem(
                    rdhs=rdhs_name,
                    district=district,
                    tier=str(row.get("tier", "Watch")),
                    data_quality_status=str(row.get("data_quality_status", "UNVERIFIED")),
                    pE=sanitize_float(row.get("pE")),
                    pH=sanitize_float(row.get("pH")),
                    mu=sanitize_float(row.get("mu")),
                    reasons=str(row["reasons"]) if pd.notna(row.get("reasons")) else None,
                )
            )

        return RDHSListResponse(count=len(items), records=items)

    def get_rdhs_detail(self, rdhs_id: str) -> RDHSDetailResponse:
        """Detailed profile for a specific RDHS area with safe nullable fields."""
        df = data_loader.forecasts
        row = self._find_rdhs_row(df, rdhs_id)
        if row is None:
            raise HTTPException(status_code=404, detail=f"RDHS '{rdhs_id}' not found.")

        rdhs_name = str(row["rdhs"])
        district = RDHS_DISTRICT_MAP.get(rdhs_name, rdhs_name)
        issue_start = str(row["issue_start"])[:10] if pd.notna(row.get("issue_start")) else None

        # Interval ordering validation
        lo = sanitize_float(row.get("lo"))
        hi = sanitize_float(row.get("hi"))
        interval = None
        if lo is not None and hi is not None and lo <= hi:
            interval = PredictionInterval(lo=lo, hi=hi)

        # Quantile ordering validation
        q05 = sanitize_float(row.get("q0.05"))
        q50 = sanitize_float(row.get("q0.5"))
        q95 = sanitize_float(row.get("q0.95"))
        quantiles = None
        if q05 is not None and q50 is not None and q95 is not None and q05 <= q50 <= q95:
            quantiles = QuantileForecast(q0_05=q05, q0_5=q50, q0_95=q95)

        # Dynamic latest accepted week for this specific RDHS
        rdhs_cases = data_loader.cases[
            data_loader.cases["rdhs"].astype(str).str.casefold() == rdhs_name.casefold()
        ]
        rdhs_latest_ok = get_latest_accepted_case_date(rdhs_cases)

        return RDHSDetailResponse(
            rdhs=rdhs_name,
            district=district,
            issue_start=issue_start,
            tier=str(row.get("tier", "Watch")),
            data_quality_status=str(row.get("data_quality_status", "UNVERIFIED")),
            record_type=str(row.get("record_type", "STAGING_DEMONSTRATION")),
            reasons=str(row["reasons"]) if pd.notna(row.get("reasons")) else None,
            data_ok_staging=sanitize_optional_bool(row.get("data_ok_staging")),
            pE=sanitize_float(row.get("pE")),
            pH=sanitize_float(row.get("pH")),
            mu=sanitize_float(row.get("mu")),
            interval=interval,
            quantiles=quantiles,
            nowcast_last3=sanitize_float(row.get("nowcast_last3")),
            thrE35=sanitize_float(row.get("thrE35")),
            thrH35=sanitize_float(row.get("thrH35")),
            C_fire=sanitize_optional_int(row.get("C_fire")),
            D_fire=sanitize_optional_int(row.get("D_fire")),
            cases_age_days=sanitize_optional_int(row.get("cases_age_days")),
            failures=str(row["failures"]) if pd.notna(row.get("failures")) else None,
            rule=str(row["rule"]) if pd.notna(row.get("rule")) else None,
            unverified=sanitize_optional_bool(row.get("unverified")),
            latest_accepted_case_week=rdhs_latest_ok,
        )

    def get_forecasts_latest(self) -> ForecastListResponse:
        """All 26 latest staging forecasts."""
        df = data_loader.forecasts
        records: List[ForecastRecord] = []

        issue_start = (
            str(df["issue_start"].iloc[0])[:10]
            if "issue_start" in df and not df.empty and pd.notna(df["issue_start"].iloc[0])
            else None
        )

        for _, row in df.iterrows():
            rdhs_name = str(row["rdhs"])
            lo = sanitize_float(row.get("lo"))
            hi = sanitize_float(row.get("hi"))
            interval = None
            if lo is not None and hi is not None and lo <= hi:
                interval = PredictionInterval(lo=lo, hi=hi)

            q05 = sanitize_float(row.get("q0.05"))
            q50 = sanitize_float(row.get("q0.5"))
            q95 = sanitize_float(row.get("q0.95"))
            quantiles = None
            if q05 is not None and q50 is not None and q95 is not None and q05 <= q50 <= q95:
                quantiles = QuantileForecast(q0_05=q05, q0_5=q50, q0_95=q95)

            row_issue = str(row["issue_start"])[:10] if pd.notna(row.get("issue_start")) else issue_start
            raw_h = row.get("horizon_weeks") if "horizon_weeks" in row else row.get("horizon")
            horizon_weeks = sanitize_optional_int(raw_h)

            records.append(
                ForecastRecord(
                    rdhs=rdhs_name,
                    issue_start=row_issue,
                    horizon_weeks=horizon_weeks,
                    predicted_value=sanitize_float(row.get("mu")),
                    interval=interval,
                    quantiles=quantiles,
                    pE=sanitize_float(row.get("pE")),
                    pH=sanitize_float(row.get("pH")),
                    tier=str(row.get("tier", "Watch")),
                    data_quality_status=str(row.get("data_quality_status", "UNVERIFIED")),
                    staging_status="EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED",
                )
            )

        return ForecastListResponse(
            issue_start=issue_start,
            count=len(records),
            records=records,
        )

    def get_forecast_detail(self, rdhs_id: str) -> ForecastDetailResponse:
        """Forecast detail for a specific RDHS."""
        df = data_loader.forecasts
        row = self._find_rdhs_row(df, rdhs_id)
        if row is None:
            raise HTTPException(status_code=404, detail=f"RDHS '{rdhs_id}' not found.")

        rdhs_name = str(row["rdhs"])
        issue_start = str(row["issue_start"])[:10] if pd.notna(row.get("issue_start")) else None

        lo = sanitize_float(row.get("lo"))
        hi = sanitize_float(row.get("hi"))
        interval = None
        if lo is not None and hi is not None and lo <= hi:
            interval = PredictionInterval(lo=lo, hi=hi)

        q05 = sanitize_float(row.get("q0.05"))
        q50 = sanitize_float(row.get("q0.5"))
        q95 = sanitize_float(row.get("q0.95"))
        quantiles = None
        if q05 is not None and q50 is not None and q95 is not None and q05 <= q50 <= q95:
            quantiles = QuantileForecast(q0_05=q05, q0_5=q50, q0_95=q95)

        age_days = sanitize_optional_int(row.get("cases_age_days"))
        raw_h = row.get("horizon_weeks") if "horizon_weeks" in row else row.get("horizon")
        horizon_weeks = sanitize_optional_int(raw_h)

        return ForecastDetailResponse(
            rdhs=rdhs_name,
            issue_start=issue_start,
            horizon_weeks=horizon_weeks,
            predicted_value=sanitize_float(row.get("mu")),
            interval=interval,
            quantiles=quantiles,
            pE=sanitize_float(row.get("pE")),
            pH=sanitize_float(row.get("pH")),
            tier=str(row.get("tier", "Watch")),
            data_quality_status=str(row.get("data_quality_status", "UNVERIFIED")),
            staging_status="EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED",
            operational_approval=False,
            cases_age_days=age_days,
            freshness_policy_limit=56,
            reasons=str(row["reasons"]) if pd.notna(row.get("reasons")) else None,
        )

    def get_alerts_latest(self) -> AlertListResponse:
        """All 26 provisional alert classifications with nullable flags."""
        df = data_loader.forecasts
        records: List[AlertRecord] = []
        issue_start = (
            str(df["issue_start"].iloc[0])[:10]
            if "issue_start" in df and not df.empty and pd.notna(df["issue_start"].iloc[0])
            else None
        )

        for _, row in df.iterrows():
            rdhs_name = str(row["rdhs"])
            records.append(
                AlertRecord(
                    rdhs=rdhs_name,
                    tier=str(row.get("tier", "Watch")),
                    verification_status=str(row.get("data_quality_status", "UNVERIFIED")),
                    pE=sanitize_float(row.get("pE")),
                    pH=sanitize_float(row.get("pH")),
                    rule=str(row["rule"]) if pd.notna(row.get("rule")) else None,
                    reasons=str(row["reasons"]) if pd.notna(row.get("reasons")) else None,
                    failures=str(row["failures"]) if pd.notna(row.get("failures")) else None,
                    C_fire=sanitize_optional_int(row.get("C_fire")),
                    D_fire=sanitize_optional_int(row.get("D_fire")),
                    unverified=sanitize_optional_bool(row.get("unverified")),
                )
            )

        return AlertListResponse(
            issue_start=issue_start,
            count=len(records),
            records=records,
        )

    def get_environment(self, rdhs_id: str) -> EnvironmentDetailResponse:
        """Environmental intelligence profile with issue-time check and district proxy labelling."""
        df = data_loader.forecasts
        row = self._find_rdhs_row(df, rdhs_id)
        if row is None:
            raise HTTPException(status_code=404, detail=f"RDHS '{rdhs_id}' not found.")

        rdhs_name = str(row["rdhs"])
        district = RDHS_DISTRICT_MAP.get(rdhs_name, rdhs_name)

        # Fix 4: District-level proxy labelling (especially for Kalmunai)
        is_district_proxy = True
        proxy_notes: Optional[str] = None
        if rdhs_name.casefold() == "kalmunai":
            proxy_notes = (
                "Ampara district data is a whole-district proxy; "
                "it is not an area-specific observation for Kalmunai RDHS."
            )
        else:
            proxy_notes = (
                f"{district} district data reflects administrative district aggregations, "
                "not point-sensor observations."
            )

        # Check model inputs as-of the forecast issue date
        # In features.parquet, match rdhs at t=1035 (issue_start 2026-11-02)
        lag_features: Dict[str, Optional[float]] = {}
        model_inputs_status = "UNAVAILABLE_AT_ISSUE_TIME"

        if data_loader.features is not None:
            f_df = data_loader.features
            # Issue date in staging corresponds to t=1035
            rdhs_feat = f_df[
                (f_df["rdhs"].astype(str).str.casefold() == rdhs_name.casefold())
                & (f_df["t"] == 1035)
            ]
            if not rdhs_feat.empty:
                feat_row = rdhs_feat.iloc[0]
                target_lags = (
                    [f"rain_l{i}" for i in range(12)]
                    + [f"soil_l{i}" for i in range(8)]
                    + [f"pflood_l{i}" for i in range(5)]
                )
                any_non_null = False
                for col in target_lags:
                    if col in feat_row:
                        val = sanitize_float(feat_row[col])
                        lag_features[col] = val
                        if val is not None:
                            any_non_null = True

                # Do not claim AVAILABLE_AT_ISSUE_TIME merely because a feature row exists.
                # In staging, all lag features at t=1035 are NaN and issue-time delivery
                # has not been operationally verified.
                if any_non_null:
                    model_inputs_status = "UNVERIFIED_ISSUE_TIME_PROVENANCE"
                else:
                    model_inputs_status = "UNAVAILABLE_AT_ISSUE_TIME"
            else:
                model_inputs_status = "NO_RECORD_AT_ISSUE_DATE"

        # Historical context series
        rain_series: List[RainfallSeriesItem] = []
        if data_loader.rain_2023 is not None:
            r_df = data_loader.rain_2023
            match_dist = r_df[r_df["ADM2_NAME"].astype(str).str.casefold() == district.casefold()]
            if not match_dist.empty:
                row_r = match_dist.iloc[0]
                week_cols = [c for c in r_df.columns if c.startswith("w_2023")]
                for wc in sorted(week_cols):
                    date_part = wc.replace("w_", "")
                    date_fmt = f"{date_part[:4]}-{date_part[4:6]}-{date_part[6:]}"
                    val = sanitize_float(row_r[wc])
                    if val is not None:
                        rain_series.append(RainfallSeriesItem(week_start=date_fmt, rainfall_mm=val))

        soil_series: List[SoilMoistureSeriesItem] = []
        if data_loader.soil_2023 is not None:
            s_df = data_loader.soil_2023
            match_dist = s_df[s_df["ADM2_NAME"].astype(str).str.casefold() == district.casefold()]
            if not match_dist.empty:
                row_s = match_dist.iloc[0]
                week_cols = [c for c in s_df.columns if c.startswith("w_2023")]
                for wc in sorted(week_cols):
                    date_part = wc.replace("w_", "")
                    date_fmt = f"{date_part[:4]}-{date_part[4:6]}-{date_part[6:]}"
                    val = sanitize_float(row_s[wc])
                    if val is not None:
                        soil_series.append(SoilMoistureSeriesItem(week_start=date_fmt, volumetric_fraction=val))

        flood_summary: Optional[Dict[str, Any]] = None
        if data_loader.flood is not None:
            fl_df = data_loader.flood
            match_fl = fl_df[fl_df["district"].astype(str).str.casefold() == district.casefold()]
            if not match_fl.empty:
                latest_fl = match_fl.sort_values("date").iloc[-1]
                flood_summary = {
                    "latest_date": str(latest_fl.get("date")),
                    "season": str(latest_fl.get("season")),
                    "paddy_obs": sanitize_float(latest_fl.get("paddy_obs")),
                    "land_obs": sanitize_float(latest_fl.get("land_obs")),
                    "rule": str(latest_fl.get("rule", "LFR v1.0")),
                }

        return EnvironmentDetailResponse(
            rdhs=rdhs_name,
            district=district,
            is_district_proxy=is_district_proxy,
            proxy_notes=proxy_notes,
            issue_time_availability_verified=False,
            model_inputs_as_of_status=model_inputs_status,
            latest_lag_features=lag_features,
            rainfall_series_2023=rain_series,
            soil_moisture_series_2023=soil_series,
            flood_summary=flood_summary,
        )

    def get_history(
        self,
        rdhs_id: str,
        start_year: Optional[int] = None,
        end_year: Optional[int] = None,
        limit: Optional[int] = None,
    ) -> HistoryResponse:
        """Historical surveillance series for an RDHS area, strictly preserving nulls."""
        cases_df = data_loader.cases
        match = cases_df[cases_df["rdhs"].astype(str).str.casefold() == str(rdhs_id).strip().casefold()]
        if match.empty:
            raise HTTPException(status_code=404, detail=f"RDHS '{rdhs_id}' not found in case database.")

        rdhs_name = str(match["rdhs"].iloc[0])
        district = RDHS_DISTRICT_MAP.get(rdhs_name, rdhs_name)

        filtered = match.copy()
        if start_year is not None:
            filtered = filtered[filtered["year"] >= start_year]
        if end_year is not None:
            filtered = filtered[filtered["year"] <= end_year]

        filtered = filtered.sort_values("t")
        if limit is not None and limit > 0:
            filtered = filtered.iloc[-limit:]

        total_weeks = len(match)
        accepted_count = int((match["status"].astype(str).str.strip().str.lower() == "ok").sum())
        unaccepted_count = total_weeks - accepted_count

        ok_rows = match[match["status"].astype(str).str.strip().str.lower() == "ok"]
        latest_ok = (
            str(ok_rows["week_start"].max())[:10]
            if not ok_rows.empty and pd.notna(ok_rows["week_start"].max())
            else None
        )
        latest_panel = (
            str(match["week_start"].max())[:10]
            if not match.empty and pd.notna(match["week_start"].max())
            else None
        )

        summary = HistorySummary(
            total_weeks=total_weeks,
            accepted_weeks_count=accepted_count,
            unaccepted_weeks_count=unaccepted_count,
            latest_accepted_week=latest_ok,
            latest_panel_week=latest_panel,
        )

        records: List[HistoryRecord] = []
        for _, r in filtered.iterrows():
            st = str(r["status"]).strip().lower()
            if st not in [CaseStatus.OK, CaseStatus.NONREPORTING, CaseStatus.NO_ACCEPTED_REPORT]:
                st = CaseStatus.NO_ACCEPTED_REPORT

            # STRICT SAFETY RULE: Null cases are preserved when status != ok
            # Never convert unaccepted reports into zero!
            cases_val = sanitize_float(r["cases"]) if st == CaseStatus.OK else None

            records.append(
                HistoryRecord(
                    week_start=str(r["week_start"])[:10],
                    year=int(r["year"]),
                    week=int(r["week"]),
                    t=int(r["t"]),
                    cases=cases_val,
                    cases_ytd=sanitize_float(r.get("cases_ytd")),
                    status=CaseStatus(st),
                )
            )

        return HistoryResponse(
            rdhs=rdhs_name,
            district=district,
            summary=summary,
            records=records,
        )

    def get_model_performance(self) -> ModelPerformanceResponse:
        """Verified historical validation metrics from source reports only; no invented R2."""
        if data_loader.metrics is None or data_loader.metrics.empty:
            return ModelPerformanceResponse(
                models=[],
                evaluation_scope="UNAVAILABLE_SOURCE_METRICS_MISSING",
                locked_test_status="NOT_EVALUATED_SOURCE_METRICS_MISSING",
            )

        models: List[ModelMetric] = []
        df = data_loader.metrics
        title_map = {
            "oof_B0.parquet": ("Baseline B0 (naive seasonal)", "B0", 6),
            "oof_B1.parquet": ("Baseline B1 (autoregressive)", "B1", 5),
            "oof_B2.parquet": ("Baseline B2 (trend + seasonal)", "B2", 4),
            "oof_A.parquet": ("Detector A (LightGBM)", "Detector A", 2),
            "oof_B.parquet": ("Detector B (Negative Binomial)", "Detector B", 3),
            "oof_blend.parquet": ("Ensemble Blend (Primary Model)", "Blend", 1),
        }

        for _, r in df.iterrows():
            fname = str(r["file"])
            name, code, rank = title_map.get(fname, (fname, fname, 99))

            # Fix 3: Source-backed metrics only. If R2 column is not in source, return None!
            r2_val = None
            r2_status = "NOT_REPORTED_IN_VERIFIED_OOF_REPORT"
            for r2_col in ["r2", "R2", "r_squared"]:
                if r2_col in r and pd.notna(r[r2_col]):
                    r2_val = float(r[r2_col])
                    r2_status = "VERIFIED_SOURCE"
                    break

            models.append(
                ModelMetric(
                    model_name=name,
                    code=code,
                    file=fname,
                    n_samples=int(r["n"]),
                    mae=round(float(r["MAE"]), 3),
                    rmse=round(float(r["RMSE"]), 3),
                    r2=r2_val,
                    r2_status=r2_status,
                    wape=round(float(r["WAPE"]), 3) if "WAPE" in r and pd.notna(r["WAPE"]) else None,
                    bias=round(float(r["bias_prediction_minus_actual"]), 3) if "bias_prediction_minus_actual" in r and pd.notna(r["bias_prediction_minus_actual"]) else None,
                    rank=rank,
                    source_dataset="data/staging/model_experiments/oof_performance_reliability_scorecard/overall_metrics_staging.csv",
                )
            )
        models.sort(key=lambda m: m.rank)

        return ModelPerformanceResponse(models=models)

    def get_data_quality(self) -> DataQualityResponse:
        """Surveillance data quality and completeness audit using dynamic freshness."""
        cases_df = data_loader.cases

        total_reports = len(cases_df)
        ok_mask = cases_df["status"].astype(str).str.strip().str.lower() == "ok"
        ok_count = int(ok_mask.sum())
        missing_count = int((cases_df["status"].astype(str).str.strip().str.lower() == "no_accepted_report").sum())
        nonreporting_count = int((cases_df["status"].astype(str).str.strip().str.lower() == "nonreporting").sum())
        accepted_pct = round((ok_count / total_reports * 100), 2) if total_reports > 0 else 0.0

        latest_ok = get_latest_accepted_case_date(cases_df)
        freshness_dict = compute_freshness(latest_ok)
        freshness_info = FreshnessInfo(**freshness_dict)

        national_summary = DataQualitySummary(
            total_reports=total_reports,
            accepted_reports=ok_count,
            missing_reports=missing_count,
            nonreporting_reports=nonreporting_count,
            accepted_percentage=accepted_pct,
            freshness=freshness_info,
            operational_status="BLOCKED_STALE_ACCEPTED_CASE_DATA",
            unaccepted_reports_rule="Unaccepted reports are preserved as null. They are never filled with zero.",
        )

        rdhs_items: List[RDHSQualityItem] = []
        grouped = cases_df.groupby("rdhs")
        for rdhs_name, grp in grouped:
            grp_total = len(grp)
            grp_ok = int((grp["status"].astype(str).str.strip().str.lower() == "ok").sum())
            grp_missing = int((grp["status"].astype(str).str.strip().str.lower() == "no_accepted_report").sum())
            grp_nonrep = int((grp["status"].astype(str).str.strip().str.lower() == "nonreporting").sum())
            grp_pct = round((grp_ok / grp_total * 100), 2) if grp_total > 0 else 0.0
            latest_rdhs_ok = get_latest_accepted_case_date(grp)

            rdhs_items.append(
                RDHSQualityItem(
                    rdhs=str(rdhs_name),
                    total_weeks=grp_total,
                    accepted_weeks=grp_ok,
                    missing_weeks=grp_missing,
                    nonreporting_weeks=grp_nonrep,
                    completeness_pct=grp_pct,
                    latest_accepted_week=latest_rdhs_ok,
                    current_status="UNVERIFIED",
                )
            )

        rdhs_items.sort(key=lambda x: x.rdhs)

        return DataQualityResponse(
            national_summary=national_summary,
            rdhs_breakdown=rdhs_items,
        )


staging_service = StagingService()
