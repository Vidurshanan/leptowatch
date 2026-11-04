# LeptoWatch Safety Safeguards and Project Limitations

This document codifies the non-negotiable scientific, epidemiological, and software safety invariants governing the LeptoWatch project.

---

## 1. Non-Negotiable Scientific Invariants

### 1. 26 RDHS Health Areas & Entity Separation
Surveillance and prediction operate across **26 Regional Directorates of Health Services (RDHS)**.
- **Kalmunai Separation:** In administrative geography, Kalmunai is located within Ampara District. However, in epidemiological public-health governance, Kalmunai operates as an independent health area with its own RDHS directorate.
- **Proxy Invariant:** For environmental covariates derived at district granularity, Kalmunai proxies Ampara District features. This proxy relationship must always remain explicit and labeled in user interfaces (`is_district_proxy: true`).

### 2. Surveillance Report Classification & Zero-Fill Prohibition
Case surveillance records are partitioned into three mutually exclusive categories:
- `ok`: Formally verified and accepted weekly case return.
- `no_accepted_report`: Report delayed, under audit, or not accepted.
- `nonreporting`: Reporting unit did not transmit weekly bulletin.
> [!CAUTION]
> **Strict Prohibition on Zero-Filling**:
> Unaccepted returns (`no_accepted_report`, `nonreporting`) and missing observation weeks must strictly remain `null` / `Unavailable`. Substituting numerical zero for missing surveillance data is strictly prohibited, as it falsely indicates disease absence in high-incidence outbreak zones.

### 3. Decoupling of Data Freshness and Operational Approval
- The application mode is strictly `EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED`.
- The 56-day case freshness policy is an **internal project latency threshold**, not an official Ministry of Health reporting-delay standard.
- Fresh data **does not** confer operational approval. Operational authorization requires formal clinical and epidemiological signoff from public health authorities.

### 4. Locked-Test Period Boundary (`2025-01-01`)
- Data from `2025-01-01` onwards constitutes the locked prospective test partition.
- In strict adherence to scientific research protocols, this boundary must **never** be accessed, evaluated, tuned against, or evaluated without explicit public-health authorization.

### 5. Restricted Pipeline Executions
Automated scripts, developers, and web services must **never** execute:
- Production pipeline functions: `weekly()`, `prepare()`, `train_final()`.
- Production ledger writes: `data/ledger/`.
- Unsupervised model retraining or recalibration.
- Automated email or SMS notifications to public authorities.

### 6. Provisional Geographic Boundaries
- Geographic polygons for the 26 RDHS areas are produced by dissolving 344 Medical Officer of Health (MOH) administrative boundaries.
- Because legally gazetted RDHS polygons have not been issued by the Survey Department of Sri Lanka, these polygons are classified as **PROVISIONAL** with status `UNRESOLVED_SPATIAL_OVERLAPS`.
- They must not be presented as authoritative administrative boundaries.

### 7. Satellite Flood Proxy Constraints & Metric Provenance
- Sentinel-1 SAR flood masks serve as agricultural wetness proxies, not ground-truth inundation maps.
- **Warning Constraint:** High flood proxy readings alone must **never** trigger a Warning alert tier without corroborating epidemiological surge evidence.
- **Optical Metric Attribution:** The pixel $F_1 \approx 0.19$ metric establishes optical reference performance (Sentinel-2 clear-sky evaluation) and must **never** be attributed to Sentinel-1 radar backscatter.

### 8. Environmental Issue-Time Availability
- Historical reanalysis datasets (such as ERA5-Land and CHIRPS archive) are published with operational release latencies.
- The existence of a historical feature row in retrospective datasets does **not** prove that the feature was operationally available at the historical forecast issue time.
- All environmental inputs carry the status: `issue_time_availability_verified = false`.

---

## 2. Software Safety Safeguards

| Safeguard | Implementation | Enforcement |
|---|---|---|
| **Read-Only API** | FastAPI mounts only `GET` routes | Write methods return HTTP 405 Method Not Allowed |
| **Workspace Isolation** | Upstream repository (`G:\My Drive\LeptoWatch`) detached | Local execution strictly confined to local copy |
| **Network Resilience** | `AbortController` cancellation in all frontend hooks | Cancels orphaned in-flight requests on unmount |
| **DOM Security** | Programmatic DOM construction (`document.createElement`) | Prevents XSS via Leaflet HTML string injection |
| **Graceful Degradation** | In-memory data loader returns `404` for missing files | Prevents server crashes if optional data is unmounted |
