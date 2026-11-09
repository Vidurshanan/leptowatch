"""Environmental intelligence schemas."""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class RainfallSeriesItem(BaseModel):
    """Weekly rainfall data point."""
    week_start: str
    rainfall_mm: float


class SoilMoistureSeriesItem(BaseModel):
    """Weekly soil moisture data point."""
    week_start: str
    volumetric_fraction: float


class EnvironmentSourceStatus(BaseModel):
    """Freshness status for a single environmental data source."""
    latest_date: Optional[str] = None
    freshness_status: str  # FRESH | DELAYED | STALE | UNAVAILABLE
    source: str
    coverage_rdhs: int = 0        # RDHS areas with valid observations
    total_rdhs: int = 26          # Total RDHS areas monitored by LeptoWatch
    districts_in_csv: int = 0     # Raw CSV district row count (may differ from RDHS count)
    data_vintage: str = "2023 historical"


class EnvironmentOverviewResponse(BaseModel):
    """National-level environmental data overview (freshness and coverage)."""
    rainfall: EnvironmentSourceStatus
    soil_moisture: EnvironmentSourceStatus
    flood: EnvironmentSourceStatus
    as_of: str


class RDHSEnvironmentSummaryItem(BaseModel):
    """Per-RDHS environmental summary for map layer / comparison view."""
    rdhs: str
    district: str
    latest_rainfall_mm: Optional[float] = None
    latest_soil_moisture: Optional[float] = None
    total_rainfall_2023_mm: Optional[float] = None
    mean_soil_moisture_2023: Optional[float] = None
    has_rain_data: bool = False
    has_soil_data: bool = False


class EnvironmentSummaryResponse(BaseModel):
    """National environmental summary across all RDHS areas."""
    rdhs_count: int
    data_vintage: str = "2023 historical"
    items: List[RDHSEnvironmentSummaryItem]


class EnvironmentDetailResponse(BaseModel):
    """Environmental intelligence profile for an RDHS area."""
    rdhs: str
    district: str
    is_district_proxy: bool = Field(
        default=True,
        description="Whether environmental series are aggregated at administrative district level rather than RDHS-specific"
    )
    proxy_notes: Optional[str] = Field(
        default=None,
        description="District proxy caveats (e.g. Ampara data represents whole district, not an area-specific Kalmunai measurement)"
    )
    data_sources: List[str] = Field(
        default=[
            "CHIRPS daily rainfall (UCSB-CHG/CHIRPS/DAILY)",
            "ERA5-Land daily root-zone soil moisture (ECMWF/ERA5_LAND/DAILY_AGGR)",
            "Sentinel-1 SAR surface water flood proxy (LFR v1.0)",
        ]
    )
    issue_time_availability_verified: bool = Field(
        default=False,
        description="Whether operational issue-time delivery was verified for all predictors"
    )
    model_inputs_as_of_status: str = Field(
        default="UNAVAILABLE_AT_ISSUE_TIME",
        description="Availability status of model lag features at the forecast issue date"
    )
    flood_proxy_notice: str = Field(
        default="Experimental SAR flood proxy (Sentinel-2 pixel F1 ~0.19). "
        "Flood alone must never trigger Warning. Not a validated field-level flood observation."
    )
    reanalysis_notice: str = Field(
        default="ERA5-Land is a climate reanalysis dataset, not a real-time operational sensor telemetry feed."
    )
    latest_lag_features: Dict[str, Optional[float]] = Field(
        default_factory=dict,
        description="Model lag feature values for rainfall (rain_l0..rain_l11), soil (soil_l0..soil_l7), and flood (pflood_l0..pflood_l4)"
    )
    rainfall_series_2023: List[RainfallSeriesItem] = Field(
        default_factory=list,
        description="Available historical CHIRPS rainfall weekly series"
    )
    soil_moisture_series_2023: List[SoilMoistureSeriesItem] = Field(
        default_factory=list,
        description="Available historical ERA5-Land soil moisture weekly series"
    )
    flood_summary: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Available Sentinel-1 SAR flood observation summary"
    )
