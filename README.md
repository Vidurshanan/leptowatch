# LeptoWatch — Sri Lanka Leptospirosis Surveillance and Early Warning Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.4-black.svg)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-teal.svg)](https://fastapi.tiangolo.com/)
[![Status](https://img.shields.io/badge/Status-EXPERIMENTAL__STAGING-amber.svg)](#operational-safeguards)

LeptoWatch is an automated early-warning and epidemiological surveillance platform designed to forecast leptospirosis surges across Sri Lanka's **26 Regional Directorates of Health Services (RDHS)** 3–5 weeks ahead. The platform couples weekly epidemiological returns with high-resolution satellite radar wetness indicators (Sentinel-1), satellite precipitation (CHIRPS), soil moisture reanalysis (ERA5-Land), and automated outbreak detection algorithms.

> [!IMPORTANT]
> **Operational Staging Notice**:
> The models, alert thresholds, and risk tiers displayed on this platform operate in **EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED** mode. Staging classifications demonstrate reproducible pipeline capabilities and must **not** be used as validated public-health directives or clinical alerts without explicit authorization from the Ministry of Health Epidemiology Unit.

---

## 1. Platform Architecture

LeptoWatch is organized as a decoupled monorepo:

```
leptowatch/
├── apps/
│   ├── web/                    # Next.js 16 (Turbopack) Dark-Themed Web Application
│   │   ├── src/app/(platform)/ # 9 Interactive Surveillance Modules
│   │   ├── src/components/     # Accessible Radix UI + Leaflet Map Components
│   │   └── src/lib/            # Typed API Client & Utilities
│   └── api/                    # FastAPI Read-Only Backend Service
│       ├── app/routers/        # 10 Staging Endpoints
│       ├── app/schemas/        # Pydantic Strict Validation Models
│       └── app/services/       # In-Memory Geometry & Data Loader Layer
├── packages/
│   └── leptowatch/             # Core Research & Modeling Python Package
│       └── src/leptowatch/     # Feature Engineering, GLM-NB, Blend & Evaluation
├── notebooks/                  # Sanitized Research & Evaluation Notebooks (00–12)
└── docs/                       # Technical Handover Documentation
    ├── ARCHITECTURE.md         # Full Technical Architecture & Dataflow
    ├── SETUP.md                # Local Developer Installation Guide
    ├── DATA_SOURCES.md         # Surveillance & Environmental Data Provenance
    ├── MODEL_STATUS.md         # Pre-2025 Scorecard & Locked-Test Protocols
    ├── SAFETY_AND_LIMITATIONS.md # Core Epidemiological Safeguards
    └── DEVELOPER_HANDOVER.md   # Handover Guide for Engineering Continuity
```

---

## 2. Nine Application Modules

The web frontend provides nine dedicated surveillance modules:

1. **National Overview (`/`)**: National coverage summary across all 26 RDHS areas, alert tier distribution, reporting freshness latency gate, operational status, and demonstration timeline.
2. **Geographic Intelligence (`/geographic`)**: Interactive Sri Lanka choropleth map powered by Leaflet, displaying 26 dissolved RDHS boundary polygons with dynamic alert-tier styling and inspection drawer.
3. **RDHS Profiles (`/rdhs`)**: Individual health-area profiles, predictive indicators ($\mu$, $p_E$, $p_H$), whole-district proxy notices (e.g. Kalmunai proxying Ampara district features), and 52-week historical case table strictly preserving unaccepted reports as nulls.
4. **Forecasting Centre (`/forecasting`)**: 3–5 week point estimates ($\mu$), empirical prediction intervals (80% / 95%), quantile spreads ($q_{0.05}, q_{0.5}, q_{0.95}$), and locked test partition boundaries.
5. **Environmental Intelligence (`/environment`)**: Satellite radar flood proxy series, CHIRPS rainfall, ERA5-Land volumetric soil moisture, 2023 weekly series, and 96-lag feature vectors.
6. **Alert Management (`/alerts`)**: 26-RDHS alert decision matrix, synthetic staging threshold rules ($\tau_{\text{watch}}=0.40, \tau_{\text{advisory}}=0.60, \tau_{\text{warning}}=0.70$), detector failure diagnostics, and non-negative assertion safety policies.
7. **Data Quality (`/data-quality`)**: Audit of 26,936 epidemiological reports, accepted report percentages, zero-fill prohibition policies, and 56-day reporting freshness gate.
8. **Model Architecture (`/model`)**: Pre-2025 out-of-fold cross-validation reliability scorecard ($n=13,329$), model candidate comparison (B0, B1, B2, Detector A, Detector B, Blend), and probability calibration summary.
9. **System Telemetry (`/system`)**: FastAPI backend service status, dataset readiness inventory, memory caching telemetry, and operational safety guardrails.

---

## 3. Backend API Endpoints

The read-only FastAPI backend serves staging records under `/api`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Backend service telemetry, dataset readiness, operational mode |
| `GET` | `/api/dashboard/summary` | National tier counts, quality counts, and freshness metrics |
| `GET` | `/api/geo/rdhs` | GeoJSON FeatureCollection of 26 RDHS health boundaries |
| `GET` | `/api/rdhs` | List all 26 RDHS health area summaries |
| `GET` | `/api/rdhs/{id}` | Detailed forecast, interval, and indicator vector for an RDHS |
| `GET` | `/api/forecasts/latest` | National forecast records for current staging issue week |
| `GET` | `/api/alerts/latest` | Alert evaluation matrix, detector flags ($C_{\text{fire}}, D_{\text{fire}}$) |
| `GET` | `/api/environment/{id}` | Environmental lags, 2023 historical series, and flood summaries |
| `GET` | `/api/history/{id}` | Historical case records strictly preserving nonreporting nulls |
| `GET` | `/api/model/performance` | Pre-2025 out-of-fold reliability scorecard and calibration stats |
| `GET` | `/api/data-quality` | National reporting completeness and RDHS weekly breakdown |

---

## 4. Quickstart Guide

### Prerequisites
- Node.js 20.x or 22.x + npm
- Python 3.10+ (Python 3.11–3.13 supported)

### 1. Backend Setup
```bash
# Navigate to API root
cd apps/api

# Install dependencies
pip install fastapi uvicorn pydantic pandas pyarrow pytest httpx

# Start the read-only FastAPI backend (port 8000)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Setup
```bash
# Navigate to Web root
cd apps/web

# Install frontend dependencies
npm install

# Start Next.js development server (port 3000)
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Testing and Verification

```bash
# Backend pytest suite (from repository root)
py -m pytest apps/api/tests/ -v

# Frontend TypeScript check
cd apps/web
npx tsc --noEmit

# Frontend ESLint static analysis
npm run lint

# Frontend Production Build
npm run build
```

---

## 6. Excluded Datasets & Authorized Configuration

In accordance with public repository safety standards and Ministry of Health research governance, raw health-surveillance microdata, large reanalysis arrays, and model bundle binaries are **intentionally excluded** from this public repository:
- `data/raw/`, `data/processed/`, `data/staging/`
- Large CSV tables, `*.parquet`, `*.pkl`, `*.joblib`, `*.gpkg`

Authorized collaborators who have received the encrypted development archive (`LeptoWatch_Private_Development_Handover.zip`) can configure local datasets:
1. Extract the private archive to a local folder (e.g. `C:\LeptoWatch_Data`).
2. Set `LEPTOWATCH_ROOT` in `apps/api/.env`:
   ```bash
   LEPTOWATCH_ROOT="C:/LeptoWatch_Data"
   ```
3. Restart the backend service.

---

## 7. Core Epidemiological Safeguards

- **26 RDHS Areas**: Kalmunai is maintained as an independent 26th health area inside Ampara administrative district.
- **Null Preservation**: Missing reports (`no_accepted_report`, `nonreporting`) are strictly preserved as null; zero-filling missing surveillance reports is strictly prohibited.
- **56-Day Freshness Gate**: An internal project latency threshold (not an official epidemiological reporting delay standard).
- **Locked Test Isolation**: Data from `2025-01-01` onwards is locked and has never been evaluated.
- **Optical Reference Attribution**: The pixel $F_1 \approx 0.19$ metric applies strictly to Sentinel-2 optical reference experiments and must **never** be attributed to Sentinel-1 radar backscatter.
