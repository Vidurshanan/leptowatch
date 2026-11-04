# LeptoWatch Data Sources and Provenance

This document records the provenance, characteristics, sampling frequencies, and epidemiological governance rules for all surveillance and environmental indicators utilized in the LeptoWatch platform.

---

## 1. Epidemiological Surveillance Microdata

- **Source:** Epidemiology Unit, Ministry of Health, Sri Lanka — Weekly Epidemiological Reports (WER).
- **Temporal Resolution:** Epidemiological week (ending Saturday, published following Monday/Tuesday).
- **Spatial Granularity:** 26 Regional Directorates of Health Services (RDHS).
  - *Entity Separation:* Kalmunai is tracked as an independent 26th RDHS area separate from Ampara.
- **Reporting Status Classification:**
  - `ok`: Formally accepted report with verified case counts.
  - `no_accepted_report`: Weekly return not accepted or delayed beyond validation cutoffs.
  - `nonreporting`: Reporting health office failed to transmit return.
- **Surveillance Integrity Rule:** Non-accepted reports (`no_accepted_report`, `nonreporting`) are strictly preserved as `null`. Zero is never substituted for missing reports.

---

## 2. Satellite & Environmental Indicators

### A. Satellite Precipitation (CHIRPS)
- **Dataset:** Climate Hazards Group InfraRed Precipitation with Station data (CHIRPS v2.0).
- **Resolution:** 0.05° spatial resolution (~5.3 km), daily temporal resolution aggregated to epidemiological week.
- **Operational Availability Note:** Historical archive complete across the case calendar; however, real-time issue-time availability in an operational environment remains unverified without upstream latency audits.

### B. Soil Moisture Reanalysis (ERA5-Land)
- **Dataset:** ECMWF ERA5-Land Reanalysis (volumetric soil water layer 1: 0–7 cm depth).
- **Resolution:** 0.1° spatial resolution (~11 km), daily mean aggregated across RDHS boundaries.
- **Cropland Masking Note:** Cropland-specific spatial masking was omitted because 11 km cells emptied several wet-zone health areas; unmasked regional averages are utilized.

### C. Satellite Radar Flood Proxy (Sentinel-1 SAR)
- **Dataset:** European Space Agency Copernicus Sentinel-1 C-band Synthetic Aperture Radar (SAR), Ground Range Detected (GRD) in Interferometric Wide (IW) mode (VV polarization).
- **Detection Algorithm:** LeptoWatch Flood Rule (LFR v1.0) with frozen thresholds:
  $$\text{Anomaly } z \le -1.5 \quad \text{and} \quad \text{Backscatter VV} \le -16\text{ dB}$$
- **Proxy Status:** Satellite radar flood signals serve as an agricultural wetness and flood proxy, not a validated field-level flood inundation map.
- **Triggering Constraint:** Satellite flood information alone **never** triggers an outbreak Warning tier without corroborating epidemiological surge evidence.

### D. Crucial Metric Clarification: Optical Reference ($F_1 \approx 0.19$)
> [!IMPORTANT]
> The previously reported pixel $F_1$ score of approximately **0.19** derives exclusively from **Sentinel-2 optical reference experiments** (cross-sensor evaluation against optical clear-sky acquisitions during cloud-free windows).
> It is scientifically incorrect to attribute this metric to Sentinel-1 radar backscatter or SAR flood masks. Radar backscatter penetration differs fundamentally from optical surface reflectance in tropical cloud environments.

---

## 3. Geographic Boundaries

- **MOH Area Layer:** 344 Medical Officer of Health (MOH) administrative boundaries repaired and validated from official Ministry of Health GIS data services (`official_moh_boundaries_repaired.gpkg`).
- **RDHS Area Layer:** 26 candidate RDHS polygons produced by spatial dissolving of MOH areas grouped by `parentname` (`rdhs_boundaries_candidate_staging.gpkg`).
- **Provisional Status:** Because formally gazetted legal RDHS boundary polygons have not been issued by the Survey Department, candidate boundaries are classified as **PROVISIONAL** with status `UNRESOLVED_SPATIAL_OVERLAPS`.

---

## 4. Public Repository Exclusion Policies

To comply with public health data privacy and research governance:
- **Excluded Datasets:** Full raw surveillance microdata (`data/raw/`), processed case tables with linkage keys (`data/processed/`), staging parquets (`data/staging/`), and large GeoPackages are excluded from public Git tracking.
- **Authorized Access:** Verified academic and public-health collaborators may request authorized access to the partitioned, encrypted research archive (`LeptoWatch_Private_Development_Handover.zip`).
