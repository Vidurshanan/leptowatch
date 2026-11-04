"""Data loader and in-memory cache service for LeptoWatch staging files."""

import datetime
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

from app.config import settings


# Canonical list of 26 RDHS areas and district mappings
RDHS_DISTRICT_MAP = {
    "Ampara": "Ampara",
    "Anuradhapura": "Anuradhapura",
    "Badulla": "Badulla",
    "Batticaloa": "Batticaloa",
    "Colombo": "Colombo",
    "Galle": "Galle",
    "Gampaha": "Gampaha",
    "Hambantota": "Hambantota",
    "Jaffna": "Jaffna",
    "Kalmunai": "Ampara",  # Kalmunai is a separate RDHS within Ampara district
    "Kalutara": "Kalutara",
    "Kandy": "Kandy",
    "Kegalle": "Kegalle",
    "Kilinochchi": "Kilinochchi",
    "Kurunegala": "Kurunegala",
    "Mannar": "Mannar",
    "Matale": "Matale",
    "Matara": "Matara",
    "Monaragala": "Monaragala",
    "Mullaitivu": "Mullaitivu",
    "Nuwara Eliya": "Nuwara Eliya",
    "Polonnaruwa": "Polonnaruwa",
    "Puttalam": "Puttalam",
    "Ratnapura": "Ratnapura",
    "Trincomalee": "Trincomalee",
    "Vavuniya": "Vavuniya",
}


def sanitize_val(val: Any) -> Any:
    """Safely convert pandas / numpy NaN to None."""
    if val is None:
        return None
    if isinstance(val, (float, np.floating)) and (np.isnan(val) or np.isinf(val)):
        return None
    if pd.isna(val):
        return None
    return val


def sanitize_float(val: Any) -> Optional[float]:
    """Safely convert value to float or None."""
    clean = sanitize_val(val)
    if clean is None:
        return None
    try:
        f = float(clean)
        return None if np.isnan(f) or np.isinf(f) else f
    except (ValueError, TypeError):
        return None


def sanitize_optional_int(val: Any) -> Optional[int]:
    """Safely convert flag or count to integer, preserving missing/NaN as None."""
    clean = sanitize_val(val)
    if clean is None:
        return None
    try:
        f = float(clean)
        if np.isnan(f) or np.isinf(f):
            return None
        return int(f)
    except (ValueError, TypeError):
        return None


def sanitize_optional_bool(val: Any) -> Optional[bool]:
    """Safely convert value to bool, never interpreting NaN/None as True or False."""
    clean = sanitize_val(val)
    if clean is None:
        return None
    if isinstance(clean, (bool, np.bool_)):
        return bool(clean)
    if isinstance(clean, (int, float, np.integer, np.floating)):
        if clean == 1:
            return True
        if clean == 0:
            return False
        return None
    if isinstance(clean, str):
        lowered = clean.strip().lower()
        if lowered in ["true", "1", "yes"]:
            return True
        if lowered in ["false", "0", "no"]:
            return False
    return None


def get_latest_accepted_case_date(cases_df: Optional[pd.DataFrame]) -> Optional[str]:
    """Dynamically derive the latest accepted (status=ok) case date from loaded records."""
    if cases_df is None or cases_df.empty:
        return None
    if "status" not in cases_df.columns or "week_start" not in cases_df.columns:
        return None
    ok_cases = cases_df[cases_df["status"].astype(str).str.strip().str.lower() == "ok"]
    if ok_cases.empty:
        return None
    latest = ok_cases["week_start"].max()
    return str(latest)[:10] if pd.notna(latest) else None


def compute_freshness(
    latest_accepted_date_str: Optional[str],
    as_of: Optional[datetime.date] = None,
) -> Dict[str, Any]:
    """Dynamically compute case reporting freshness against the 56-day gate."""
    if as_of is None:
        as_of = datetime.date.today()

    if latest_accepted_date_str is None:
        return {
            "latest_accepted_date": None,
            "as_of_date": as_of.isoformat(),
            "age_days": None,
            "policy_threshold_days": settings.freshness_policy_days,
            "is_fresh_under_policy": None,
            "status": "UNAVAILABLE_NO_ACCEPTED_REPORTS",
            "policy_caveat": (
                "The 56-day gate is an internal project safety policy, not an official reporting-delay standard."
            ),
        }

    try:
        latest_dt = datetime.datetime.strptime(latest_accepted_date_str, "%Y-%m-%d").date()
        age_days = (as_of - latest_dt).days
        policy_limit = settings.freshness_policy_days
        is_fresh = age_days <= policy_limit
        return {
            "latest_accepted_date": latest_accepted_date_str,
            "as_of_date": as_of.isoformat(),
            "age_days": age_days,
            "policy_threshold_days": policy_limit,
            "is_fresh_under_policy": is_fresh,
            "status": "CALCULATED",
            "policy_caveat": (
                "The 56-day gate is an internal project safety policy, not an official reporting-delay standard."
            ),
        }
    except Exception as e:
        return {
            "latest_accepted_date": latest_accepted_date_str,
            "as_of_date": as_of.isoformat(),
            "age_days": None,
            "policy_threshold_days": settings.freshness_policy_days,
            "is_fresh_under_policy": None,
            "status": f"ERROR_PARSING_DATE: {e}",
            "policy_caveat": (
                "The 56-day gate is an internal project safety policy, not an official reporting-delay standard."
            ),
        }


class DataLoader:
    """Singleton data repository that loads staging data once into memory."""

    def __init__(self):
        self._manifest: Optional[Dict[str, Any]] = None
        self._df_forecast_staging: Optional[pd.DataFrame] = None
        self._df_forecast_rich: Optional[pd.DataFrame] = None
        self._df_forecast_merged: Optional[pd.DataFrame] = None
        self._df_cases: Optional[pd.DataFrame] = None
        self._df_features: Optional[pd.DataFrame] = None
        self._df_metrics: Optional[pd.DataFrame] = None
        self._df_rain_2023: Optional[pd.DataFrame] = None
        self._df_soil_2023: Optional[pd.DataFrame] = None
        self._df_flood: Optional[pd.DataFrame] = None
        self.loading_errors: List[str] = []
        self._is_loaded = False

    def load_all(self, force_reload: bool = False):
        """Preload all available staging datasets and record any issues explicitly."""
        if self._is_loaded and not force_reload:
            return

        self.loading_errors.clear()

        # 1. Manifest
        if settings.manifest_path.exists():
            try:
                with open(settings.manifest_path, "r", encoding="utf-8") as f:
                    self._manifest = json.load(f)
            except Exception as e:
                self.loading_errors.append(f"Manifest load error: {e}")
        else:
            self.loading_errors.append(f"Manifest missing at {settings.manifest_path.name}")

        # 2. Forecast tables
        if settings.forecast_staging_path.exists():
            try:
                self._df_forecast_staging = pd.read_parquet(settings.forecast_staging_path)
            except Exception as e:
                self.loading_errors.append(f"Forecast staging parquet load error: {e}")
        else:
            self.loading_errors.append(f"Forecast staging parquet missing at {settings.forecast_staging_path.name}")

        if settings.forecast_source_snapshot_path.exists():
            try:
                self._df_forecast_rich = pd.read_parquet(settings.forecast_source_snapshot_path)
            except Exception as e:
                self.loading_errors.append(f"Forecast rich snapshot load error: {e}")

        if self._df_forecast_staging is not None:
            if self._df_forecast_rich is not None:
                rich_cols = [
                    c for c in self._df_forecast_rich.columns
                    if c not in self._df_forecast_staging.columns and c != "rdhs"
                ]
                self._df_forecast_merged = pd.merge(
                    self._df_forecast_staging,
                    self._df_forecast_rich[["rdhs"] + rich_cols],
                    on="rdhs",
                    how="left",
                )
            else:
                self._df_forecast_merged = self._df_forecast_staging.copy()

        # 3. Cases
        cases_file = (
            settings.cases_snapshot_path
            if settings.cases_snapshot_path.exists()
            else settings.cases_processed_path
        )
        if cases_file.exists():
            try:
                self._df_cases = pd.read_csv(cases_file)
            except Exception as e:
                self.loading_errors.append(f"Cases load error: {e}")
        else:
            self.loading_errors.append(f"Cases file missing at {cases_file.name}")

        # 4. Features
        if settings.features_path.exists():
            try:
                self._df_features = pd.read_parquet(settings.features_path)
            except Exception as e:
                self.loading_errors.append(f"Features load error: {e}")

        # 5. Metrics
        if settings.metrics_path.exists():
            try:
                self._df_metrics = pd.read_csv(settings.metrics_path)
            except Exception as e:
                self.loading_errors.append(f"Metrics load error: {e}")

        # 6. Environmental series
        if settings.rainfall_2023_path.exists():
            try:
                self._df_rain_2023 = pd.read_csv(settings.rainfall_2023_path)
            except Exception as e:
                self.loading_errors.append(f"Rainfall 2023 load error: {e}")

        if settings.soil_moisture_2023_path.exists():
            try:
                self._df_soil_2023 = pd.read_csv(settings.soil_moisture_2023_path)
            except Exception as e:
                self.loading_errors.append(f"Soil moisture 2023 load error: {e}")

        if settings.flood_series_path.exists():
            try:
                self._df_flood = pd.read_csv(settings.flood_series_path)
            except Exception as e:
                self.loading_errors.append(f"Flood series load error: {e}")

        self._is_loaded = True

    def get_readiness_status(self) -> str:
        """Evaluate dataset readiness: READY, DEGRADED, or UNAVAILABLE."""
        if not self._is_loaded:
            self.load_all()
        core_ready = (
            self._df_forecast_merged is not None
            and not self._df_forecast_merged.empty
            and self._df_cases is not None
            and not self._df_cases.empty
        )
        if not core_ready:
            return "UNAVAILABLE"
        if len(self.loading_errors) > 0:
            return "DEGRADED"
        return "READY"

    @property
    def manifest(self) -> Dict[str, Any]:
        if not self._is_loaded:
            self.load_all()
        return self._manifest or {}

    @property
    def forecasts(self) -> pd.DataFrame:
        if not self._is_loaded:
            self.load_all()
        if self._df_forecast_merged is None:
            raise FileNotFoundError("Forecast staging dataset not found.")
        return self._df_forecast_merged

    @property
    def cases(self) -> pd.DataFrame:
        if not self._is_loaded:
            self.load_all()
        if self._df_cases is None:
            raise FileNotFoundError("Cases dataset not found.")
        return self._df_cases

    @property
    def features(self) -> Optional[pd.DataFrame]:
        if not self._is_loaded:
            self.load_all()
        return self._df_features

    @property
    def metrics(self) -> Optional[pd.DataFrame]:
        if not self._is_loaded:
            self.load_all()
        return self._df_metrics

    @property
    def rain_2023(self) -> Optional[pd.DataFrame]:
        if not self._is_loaded:
            self.load_all()
        return self._df_rain_2023

    @property
    def soil_2023(self) -> Optional[pd.DataFrame]:
        if not self._is_loaded:
            self.load_all()
        return self._df_soil_2023

    @property
    def flood(self) -> Optional[pd.DataFrame]:
        if not self._is_loaded:
            self.load_all()
        return self._df_flood


data_loader = DataLoader()
