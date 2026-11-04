# LeptoWatch Platform Architecture

## 1. System Overview

The LeptoWatch platform is structured as an asynchronous, read-only analytical stack decoupling modern frontend visualization from high-performance data serving and research model pipelines.

```mermaid
graph TD
    subgraph Frontend ["Next.js 16 Web Application (apps/web)"]
        UI[9 Platform Routes]
        Provider[StagingContext Provider]
        Client[Typed API Client (lib/api.ts)]
        Map[Leaflet Dynamic Choropleth]
        Radix[Accessible Radix UI Primitives]
        UI --> Provider
        UI --> Map
        UI --> Radix
        Provider --> Client
    end

    subgraph Backend ["FastAPI Read-Only Backend (apps/api)"]
        Router[API Routers (10 Endpoints)]
        Schema[Pydantic Models]
        Loader[Data Loader & Memory Cache]
        Geo[Pure-Python GeoPackage SQLite Parser]
        Router --> Schema
        Router --> Loader
        Router --> Geo
    end

    subgraph Datasets ["Staged Research Artefacts (data/)"]
        Parquet[Staging Parquets & Forecast Snapshots]
        GeoDB[Dissolved Candidate GeoPackage]
        CSV[Surveillance & Environmental CSVs]
        Loader -.-> Parquet
        Loader -.-> CSV
        Geo -.-> GeoDB
    end

    Client -->|HTTP GET (Port 8000)| Router
```

---

## 2. Frontend Layer (`apps/web`)

### Framework & Performance
- **Next.js 16.4.4** running with Turbopack for compilation and static route prerendering.
- **Tailwind CSS v4** with a custom dark navy surveillance theme (`#050b18` dark navy background, `#0b1628` surface-raised, cyan/teal accent palette, high-contrast text).
- **Radix UI Primitives**: Standard WAI-ARIA accessible dropdown menus (`DropdownMenuPrimitive`) and tooltips (`TooltipPrimitive`) providing complete keyboard navigation (Enter, Space, Arrows, Escape), focus restoration, and click-outside dismissal.

### State & Networking
- **Centralized Staging Provider (`StagingProvider`)**: Located at `src/components/providers/staging-context.tsx`. Fetches `/api/dashboard/summary` once at application initialization, caching issue dates and operational metadata across `page-header.tsx`, `staging-banner.tsx`, and `topbar.tsx`.
- **Typed API Client (`src/lib/api.ts`)**: Strongly typed asynchronous wrappers for all backend endpoints supporting `AbortController` cancellation signals on component unmount.

### Interactive Geographic Mapping
- Dynamic client-only Leaflet integration (`src/components/maps/leaflet-map.tsx`).
- Basemap: **Esri World Dark Gray Base** (`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`), eliminating public API key watermarks and fitting the dark theme.
- Dynamic polygon styling derived from real staging alert tiers (`getTierBadgeVariant`).
- Safe DOM construction for tooltips (`document.createElement`) preventing HTML injection.

---

## 3. Backend Layer (`apps/api`)

### Service Design
- **FastAPI 0.115+** running on Uvicorn.
- **Strict Read-Only Enforcement**: Serves only `GET` endpoints. Ledger writing, database mutations, retraining jobs, and notification dispatches are strictly excluded.
- **Pydantic Validation**: All responses validated against strict schemas in `app/schemas/`.

### Memory Caching & In-Memory Data Loader
- Located at `app/services/data_loader.py`.
- Loads Parquet and CSV datasets into memory on startup, ensuring sub-10ms response latencies for dashboard queries.
- Graceful degradation: If a physical staging file is missing, the service continues running in `DEGRADED` status and returns clean `404` responses rather than crashing.

### Pure-Python GeoPackage Parser
- Located at `app/services/geo_service.py`.
- Parses GeoPackage SQLite geometry blobs natively without requiring external heavy C-libraries (GDAL/GEOS).
- Validates 8-byte GeoPackage binary headers (`0x47`, `0x50`, `0x00`, `0x01`), WKB byte order (`0x00` Big-Endian, `0x01` Little-Endian), MultiPolygon rings, closed ring topology, and EPSG:4326 coordinate ranges.
- Logs unparseable geometries into `unparseable_geometries` instead of dropping them silently.

---

## 4. Core Package (`packages/leptowatch`)

The core Python package provides the analytical algorithms used to build the pipeline:
- `leptowatch.data`: Weekly epidemiological return parsers (`wer_parse.py`, `wer_download.py`), environmental data ingestion (`gee.py`, `openmeteo.py`), and boundary dissolve algorithms.
- `leptowatch.features`: 96-lag feature vector assembly, seasonal decomposition, and autoregressive term construction.
- `leptowatch.models`: Negative Binomial GLM fits (`glm_nb.py`), outbreak probability detectors A & B (`detectors.py`), and dynamic ensemble weighting (`blend.py`).
- `leptowatch.eval`: Out-of-fold historical cross-validation (`backtest.py`), bootstrap calibration (`doctor.py`), and reliability scoring.
