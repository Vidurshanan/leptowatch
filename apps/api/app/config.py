"""Configuration settings for LeptoWatch Staging API."""

import os
from pathlib import Path
from typing import List


class Settings:
    """Application settings with environment variable overrides."""

    def __init__(self):
        # Default root is Leptowatch_Development (3 levels up from apps/api/app/config.py)
        default_root = Path(__file__).resolve().parents[3]
        env_root = os.getenv("LEPTOWATCH_ROOT")
        if env_root:
            candidate = Path(env_root)
            if not candidate.is_absolute():
                candidate = (default_root / candidate).resolve()
            self.leptowatch_root = candidate
        else:
            self.leptowatch_root = default_root

        # Host and Port
        self.host = os.getenv("LEPTOWATCH_HOST", "0.0.0.0")
        self.port = int(os.getenv("LEPTOWATCH_PORT", "8000"))

        # CORS Origins
        raw_origins = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001",
        )
        self.cors_origins: List[str] = [
            origin.strip() for origin in raw_origins.split(",") if origin.strip()
        ]

        # Policy parameters
        self.freshness_policy_days = int(os.getenv("FRESHNESS_POLICY_DAYS", "56"))

        # Dataset paths relative to leptowatch_root
        self.manifest_path = (
            self.leptowatch_root
            / "data"
            / "staging"
            / "notebook_40_final_demo"
            / "demonstration_manifest.json"
        )
        self.forecast_staging_path = (
            self.leptowatch_root
            / "data"
            / "staging"
            / "notebook_38_demo_data"
            / "dashboard_forecast_staging.parquet"
        )
        self.forecast_source_snapshot_path = (
            self.leptowatch_root
            / "data"
            / "staging"
            / "notebook_38_demo_data"
            / "forecast_source_snapshot_staging.parquet"
        )
        self.cases_snapshot_path = (
            self.leptowatch_root
            / "data"
            / "staging"
            / "notebook_38_demo_data"
            / "cases_source_snapshot_unmodified.csv"
        )
        self.cases_processed_path = (
            self.leptowatch_root / "data" / "processed" / "cases_weekly.csv"
        )
        self.features_path = (
            self.leptowatch_root / "data" / "processed" / "features.parquet"
        )
        self.metrics_path = (
            self.leptowatch_root
            / "data"
            / "staging"
            / "model_experiments"
            / "oof_performance_reliability_scorecard"
            / "overall_metrics_staging.csv"
        )
        self.rainfall_2023_path = (
            self.leptowatch_root / "LeptoWatch_E3_rainfall_2023.csv"
        )
        self.soil_moisture_2023_path = (
            self.leptowatch_root / "LeptoWatch_E3_soil_moisture_2023.csv"
        )
        self.flood_series_path = (
            self.leptowatch_root / "LeptoWatch_E2_flood_series.csv"
        )
        self.rdhs_candidate_gpkg_path = (
            self.leptowatch_root
            / "data"
            / "staging"
            / "model_readiness"
            / "rdhs_boundaries_candidate_staging.gpkg"
        )
        self.historical_oof_path = (
            self.leptowatch_root
            / "data"
            / "staging"
            / "website_demo_package_v1"
            / "historical_oof_for_website.csv"
        )


settings = Settings()
