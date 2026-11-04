"""Domain service for loading and serving RDHS geographic boundary GeoJSON."""

import os
import sqlite3
import struct
from typing import Any, Dict, List, Optional, Tuple

from app.config import settings
from app.schemas.geo import (
    GeoGeometry,
    GeoRDHSFeature,
    GeoRDHSProperties,
    GeoRDHSResponse,
)
from app.services.data_loader import (
    RDHS_DISTRICT_MAP,
    data_loader,
    sanitize_float,
)


class GeoService:
    """Read-only geographic boundary service with binary WKB validation."""

    def __init__(self):
        self._cached_response: Optional[GeoRDHSResponse] = None

    @staticmethod
    def _parse_wkb_ring(
        data: bytes, offset: int, endian: str
    ) -> Tuple[List[List[float]], int]:
        """Parse and validate a linear ring from WKB bytes."""
        if offset + 4 > len(data):
            raise ValueError("Unexpected EOF reading ring point count")
        num_points = struct.unpack(endian + "I", data[offset : offset + 4])[0]
        offset += 4

        if num_points < 4:
            raise ValueError(f"Linear ring must contain at least 4 points, got {num_points}")

        if offset + (num_points * 16) > len(data):
            raise ValueError("Unexpected EOF reading ring coordinates")

        points: List[List[float]] = []
        for _ in range(num_points):
            x, y = struct.unpack(endian + "dd", data[offset : offset + 16])
            # Coordinate order validation: WGS84 EPSG:4326 longitude [79, 83], latitude [5, 11]
            if not (78.0 <= x <= 84.0 and 5.0 <= y <= 11.0):
                raise ValueError(
                    f"Coordinate out of expected Sri Lanka WGS84 bounds: lon={x}, lat={y}"
                )
            points.append([round(x, 6), round(y, 6)])
            offset += 16

        # Validate closed ring
        if points[0] != points[-1]:
            points.append(points[0])

        return points, offset

    @classmethod
    def _parse_wkb_polygon(
        cls, data: bytes, offset: int
    ) -> Tuple[List[List[List[float]]], int]:
        """Parse a polygon (outer ring + holes) from WKB bytes."""
        if offset + 9 > len(data):
            raise ValueError("Unexpected EOF reading polygon header")
        endian = "<" if data[offset] == 1 else ">"
        geom_type = struct.unpack(endian + "I", data[offset + 1 : offset + 5])[0]
        offset += 5

        base_type = geom_type % 1000
        if base_type != 3:
            raise ValueError(f"Expected Polygon type (3), got {geom_type}")

        num_rings = struct.unpack(endian + "I", data[offset : offset + 4])[0]
        offset += 4

        if num_rings < 1:
            raise ValueError(f"Polygon must have at least 1 ring, got {num_rings}")

        rings: List[List[List[float]]] = []
        for _ in range(num_rings):
            ring, offset = cls._parse_wkb_ring(data, offset, endian)
            rings.append(ring)

        return rings, offset

    @classmethod
    def _parse_wkb_multipolygon(
        cls, data: bytes, offset: int
    ) -> Tuple[List[List[List[List[float]]]], int]:
        """Parse a MultiPolygon from WKB bytes."""
        if offset + 9 > len(data):
            raise ValueError("Unexpected EOF reading multipolygon header")
        endian = "<" if data[offset] == 1 else ">"
        geom_type = struct.unpack(endian + "I", data[offset + 1 : offset + 5])[0]
        offset += 5

        base_type = geom_type % 1000
        if base_type != 6:
            raise ValueError(f"Expected MultiPolygon type (6), got {geom_type}")

        num_polys = struct.unpack(endian + "I", data[offset : offset + 4])[0]
        offset += 4

        if num_polys < 1:
            raise ValueError(f"MultiPolygon must have at least 1 polygon part, got {num_polys}")

        polys: List[List[List[List[float]]]] = []
        for _ in range(num_polys):
            poly, offset = cls._parse_wkb_polygon(data, offset)
            polys.append(poly)

        return polys, offset

    @classmethod
    def parse_gpkg_geometry(cls, geom_bytes: bytes) -> GeoGeometry:
        """Parse GeoPackage standard binary geometry blob into GeoGeometry."""
        if not geom_bytes or len(geom_bytes) < 8:
            raise ValueError("Empty or truncated GeoPackage geometry header")

        magic = geom_bytes[:2]
        if magic != b"GP":
            raise ValueError(f"Invalid GeoPackage magic header: {magic!r}")

        version = geom_bytes[2]
        if version != 0:
            raise ValueError(f"Unsupported GeoPackage binary header version: {version}")

        flags = geom_bytes[3]
        envelope_indicator = (flags & (0x07 << 1)) >> 1
        envelope_lens = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}
        if envelope_indicator not in envelope_lens:
            raise ValueError(f"Invalid envelope indicator in flags: {envelope_indicator}")

        env_len = envelope_lens[envelope_indicator]
        wkb_offset = 8 + env_len

        if len(geom_bytes) < wkb_offset + 5:
            raise ValueError("Geometry blob truncated before WKB payload")

        wkb = geom_bytes[wkb_offset:]
        endian = "<" if wkb[0] == 1 else ">"
        geom_type = struct.unpack(endian + "I", wkb[1:5])[0]
        base_type = geom_type % 1000

        if base_type == 3:
            rings, _ = cls._parse_wkb_polygon(wkb, 0)
            return GeoGeometry(type="Polygon", coordinates=rings)
        elif base_type == 6:
            polys, _ = cls._parse_wkb_multipolygon(wkb, 0)
            return GeoGeometry(type="MultiPolygon", coordinates=polys)
        else:
            raise ValueError(f"Unsupported geometry type in WKB: {geom_type} (base {base_type})")

    def get_rdhs_boundaries(self) -> GeoRDHSResponse:
        """Retrieve all 26 RDHS boundaries with actual staging attributes."""
        if self._cached_response is not None:
            return self._cached_response

        gpkg_path = settings.rdhs_candidate_gpkg_path
        if not gpkg_path.exists():
            raise FileNotFoundError(
                f"Candidate RDHS boundaries GeoPackage missing at {gpkg_path}"
            )

        features: List[GeoRDHSFeature] = []
        unparseable: List[str] = []

        # Load forecasts for attribute enrichment from actual staging records
        staging_forecasts_map: Dict[str, Any] = {}
        try:
            fc_df = data_loader.forecasts
            for _, row in fc_df.iterrows():
                rdhs_name = str(row["rdhs"])
                staging_forecasts_map[rdhs_name.casefold()] = row
        except Exception:
            pass

        conn = sqlite3.connect(str(gpkg_path))
        cur = conn.cursor()
        try:
            cur.execute(
                "SELECT fid, rdhs, geom, geometry_valid, area_km2 FROM rdhs_candidate ORDER BY rdhs"
            )
            rows = cur.fetchall()
        finally:
            conn.close()

        for fid, rdhs_name_raw, geom_bytes, geom_valid, area_km2 in rows:
            rdhs_name = str(rdhs_name_raw).strip()
            district = RDHS_DISTRICT_MAP.get(rdhs_name, rdhs_name)

            # Strict parsing with explicit error tracking
            try:
                geometry = self.parse_gpkg_geometry(geom_bytes)
            except Exception as e:
                unparseable.append(f"{rdhs_name}: {e}")
                continue

            # Kalmunai whole-district proxy note
            is_proxy = False
            proxy_notes: Optional[str] = None
            if rdhs_name.casefold() == "kalmunai":
                is_proxy = True
                proxy_notes = (
                    "Ampara district data is a whole-district proxy; "
                    "it is not an area-specific observation for Kalmunai RDHS."
                )

            # Derive attributes strictly from actual staging forecast records (no hardcoding)
            tier: Optional[str] = None
            data_quality: Optional[str] = None
            pE: Optional[float] = None
            pH: Optional[float] = None
            mu: Optional[float] = None

            fc_row = staging_forecasts_map.get(rdhs_name.casefold())
            if fc_row is not None:
                raw_tier = fc_row.get("tier")
                tier = str(raw_tier) if (raw_tier is not None and str(raw_tier).strip()) else None

                raw_dq = fc_row.get("data_quality_status")
                data_quality = str(raw_dq) if (raw_dq is not None and str(raw_dq).strip()) else None

                pE = sanitize_float(fc_row.get("pE"))
                pH = sanitize_float(fc_row.get("pH"))
                mu = sanitize_float(fc_row.get("mu"))

            properties = GeoRDHSProperties(
                rdhs=rdhs_name,
                district=district,
                is_district_proxy=is_proxy,
                proxy_notes=proxy_notes,
                tier=tier,
                data_quality_status=data_quality,
                pE=pE,
                pH=pH,
                mu=mu,
                area_km2=sanitize_float(area_km2),
                geometry_valid=bool(geom_valid),
            )

            features.append(
                GeoRDHSFeature(
                    type="Feature",
                    id=rdhs_name,
                    properties=properties,
                    geometry=geometry,
                )
            )

        response = GeoRDHSResponse(
            type="FeatureCollection",
            count=len(features),
            crs="EPSG:4326",
            geographic_source=str(gpkg_path.relative_to(settings.leptowatch_root)).replace("\\", "/"),
            boundary_validation_status="UNRESOLVED_SPATIAL_OVERLAPS",
            provisional_warning="PROVISIONAL RDHS BOUNDARY VISUALIZATION — Unverified boundaries must not be claimed as officially validated.",
            staging_classification_notice=(
                "Provisional staging alert tiers are experimental research classifications "
                "and must never be interpreted as validated official public-health epidemiological warnings."
            ),
            unparseable_geometries=unparseable,
            features=features,
        )

        self._cached_response = response
        return response


geo_service = GeoService()
