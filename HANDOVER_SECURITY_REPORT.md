# LeptoWatch Handover Security and Data Protection Audit

**Repository:** `C:\Users\HAI\Documents\Model X Rootbotz\Lepto_Watch\leptowatch`  
**Date:** 2026-11-04  
**Audit Status:** PASSED (Verified Clean)  

---

## 1. Destination Repository Git History Audit

- **Commits Analyzed:**
  - Commit `534235f` ("Initial commit" by Vidurshanan, 2026-10-19)
- **Branches Analyzed:** `main`, `remotes/origin/main`
- **Tags Analyzed:** None
- **Reflog Analyzed:** Clean clone directly from `https://github.com/Vidurshanan/leptowatch.git`
- **Findings:** Zero credentials, API keys, private tokens, passwords, or sensitive datasets have ever been committed to the destination repository.
- **Git History Rewrite Required:** **No.** Git history is clean.

---

## 2. Source Code & Notebook Security Audit

### A. Core Package (`code/leptowatch/src/leptowatch`)
- Scanned 39 Python files across `alerts/`, `api/`, `data/`, `eval/`, `features/`, `models/`, and root package modules.
- **Secrets / Keys Detected:** None.
- **Google Earth Engine (`gee.py`):** Uses runtime environment variables (`LW_EE_PROJECT`, `GOOGLE_APPLICATION_CREDENTIALS`), contains zero hardcoded keys.
- **OpenMeteo (`openmeteo.py`):** Uses public archive endpoints with no private API tokens.
- **Public Publication Assessment:** **APPROVED FOR PUBLIC INCLUSION**. The core package logic is clean and suitable for inclusion in `packages/leptowatch/`.

### B. Notebooks (`00` through `12`)
- Audited all 13 research and tutorial notebooks in `code/leptowatch/notebooks/`.
- **Embedded Cell Outputs:** Zero (`has_outputs: False` across all 13 notebooks; all outputs cleared).
- **Embedded Secrets / Credentials:** None detected.
- **Sanitization Applied:** Google Drive mount paths (`/content/drive/MyDrive/LeptoWatch`) replaced with relative/environment paths for public repository publication.

---

## 3. Health Surveillance Data & Locked-Test Partition Protection

- **Locked-Test Boundary Date:** `2025-01-01`
- **Surveillance Datasets Inspected:**
  1. `data/processed/cases_weekly.csv` (26,936 rows): Contains 2,496 rows from 2025-01-01 through 2026-11-02.
     - **Action:** Full file excluded from public repository. For private model development handover, partitioned to `cases_weekly_pre2025_authorized.csv` (24,440 rows strictly `< 2025-01-01`).
  2. `data/processed/features.parquet` (26,936 rows): Contains 2,496 rows from 2025-01-01 onwards.
     - **Action:** Full file excluded from public repository. For private model development handover, partitioned to `features_pre2025_authorized.parquet` (24,440 rows strictly `< 2025-01-01`).
  3. `data/processed/oof_A.parquet`, `oof_B.parquet`, `oof_blend.parquet` (17,628 rows each):
     - **Date Range:** 2011-12-31 to 2024-12-21 (t = 261 to 938).
     - **Post-2025 Rows:** Exactly **0**.
     - **Action:** Excluded from public repository. Approved for private model development handover.
  4. `data/processed/rules_CD.parquet` (26,884 rows):
     - **Action:** Sliced to pre-2025 (`t <= 938`, 24,414 rows) for private model development handover.

---

## 4. Model Bundles and Calibration Artefacts Contamination Audit

- **`leptowatch_bundle_experimental_staging.pkl` (5,229,966 bytes):**
  - Staging model candidate ensemble.
  - Evaluation scope: 2011-12-31 to 2024-12-21.
  - Locked-test rows evaluated: **0**.
  - Status: `EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED`.
  - Contamination: **None**. Approved for private model development handover.
- **`alert_thresholds.json` (250 bytes):**
  - Tuned on rows: 17,628 (pre-2025 OOF folds, 2012–2024).
  - Contamination: **None**.
- **`probability_calibration_summary.csv` (334 bytes):**
  - Pre-2025 calibration scorecard ($n=13,329$).
  - Contamination: **None**.

---

## 5. Environmental & Geographic Provenance Findings

- **Pixel $F_1 \approx 0.19$ Provenance:** Strictly confirmed to originate from Sentinel-2 optical reference comparisons (evaluation against optical clear-sky acquisitions). It is strictly **prohibited** to attribute this to Sentinel-1 radar backscatter or SAR flood masks.
- **Geographic Boundaries:** `rdhs_boundaries_candidate_staging.gpkg` carries the formal disclaimer: `PROVISIONAL RDHS CANDIDATE WITH UNRESOLVED SPATIAL OVERLAPS`. It is distinct from `official_moh_boundaries_repaired.gpkg` (344 MOH areas).

---

## 6. Archive Encryption Implementation

- **Tool:** `pyzipper` (Python Cryptographic Zip Engine).
- **Encryption Algorithm:** AES-256 (`pyzipper.WZ_AES`).
- **Key Storage:** Password generated via CSPRNG (`secrets.token_urlsafe`), reported directly to the user in the handover summary. Never saved inside repository or ZIP archive.
