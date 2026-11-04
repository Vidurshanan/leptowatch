"""Geographic GeoJSON schemas for RDHS health areas."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class GeoGeometry(BaseModel):
    """GeoJSON Geometry representation (Polygon or MultiPolygon)."""
    type: str = Field(..., description="Geometry type (e.g. MultiPolygon, Polygon)")
    coordinates: Any = Field(..., description="Array of coordinates in WGS84 [lng, lat]")


class GeoRDHSProperties(BaseModel):
    """Properties for an RDHS boundary feature, derived from staging datasets."""
    rdhs: str = Field(..., description="Canonical RDHS identifier")
    district: str = Field(..., description="Administrative district name")
    is_district_proxy: bool = Field(
        default=False,
        description="Whether environmental observations use a whole-district proxy (e.g. Kalmunai in Ampara)"
    )
    proxy_notes: Optional[str] = Field(
        default=None,
        description="Detailed proxy notes if applicable"
    )
    tier: Optional[str] = Field(
        default=None,
        description="Provisional staging alert tier derived from actual staging forecast records, or null if missing"
    )
    data_quality_status: Optional[str] = Field(
        default=None,
        description="Data quality status derived from actual staging records, or null if missing"
    )
    pE: Optional[float] = Field(None, description="Provisional elevated probability")
    pH: Optional[float] = Field(None, description="Provisional high probability")
    mu: Optional[float] = Field(None, description="Predicted mean case count")
    area_km2: Optional[float] = Field(None, description="Geographic area in square kilometers")
    geometry_valid: bool = Field(default=True, description="Whether the stored geometry is structurally valid")


class GeoRDHSFeature(BaseModel):
    """Single GeoJSON Feature representing an RDHS health area."""
    type: str = Field(default="Feature")
    id: str = Field(..., description="RDHS identifier matching feature ID")
    properties: GeoRDHSProperties
    geometry: GeoGeometry


class GeoRDHSResponse(BaseModel):
    """GeoJSON FeatureCollection containing all 26 RDHS areas with provisional safety notices."""
    type: str = Field(default="FeatureCollection")
    count: int = Field(default=26, description="Total number of RDHS features")
    crs: str = Field(default="EPSG:4326", description="Coordinate reference system")
    geographic_source: str = Field(
        default="data/staging/model_readiness/rdhs_boundaries_candidate_staging.gpkg",
        description="Candidate geographic dataset source"
    )
    boundary_validation_status: str = Field(
        default="UNRESOLVED_SPATIAL_OVERLAPS",
        description="Validation status of candidate geographic boundaries"
    )
    provisional_warning: str = Field(
        default="PROVISIONAL RDHS BOUNDARY VISUALIZATION — Unverified boundaries must not be claimed as officially validated.",
        description="Mandatory provisional boundary disclaimer"
    )
    staging_classification_notice: str = Field(
        default="Provisional staging alert tiers are experimental research classifications and must never be interpreted as validated official public-health epidemiological warnings.",
        description="Clear separation between experimental staging classifications and epidemiological declarations"
    )
    unparseable_geometries: List[str] = Field(
        default_factory=list,
        description="List of RDHS identifiers that failed geometry validation or parsing"
    )
    features: List[GeoRDHSFeature]
