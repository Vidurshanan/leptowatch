# LeptoWatch Developer Handover Guide

This guide provides technical handover instructions for engineers continuing development on the LeptoWatch codebase.

---

## 1. Project Handover Summary

- **Repository Root:** `leptowatch/`
- **Frontend Application:** `apps/web/` (Next.js 16, React 19, Tailwind CSS v4, Radix UI, Leaflet)
- **Backend API:** `apps/api/` (FastAPI 0.115+, Pydantic v2, in-memory data cache, pure-Python GeoPackage parser)
- **Core Research Package:** `packages/leptowatch/` (Python analytical pipeline, feature engineering, Negative Binomial GLMs, ensemble blend)
- **Research Notebooks:** `notebooks/` (Tutorial and model development notebooks `00` through `12`, outputs cleared, relative paths configured)
- **Documentation Suite:** `docs/` (`ARCHITECTURE.md`, `SETUP.md`, `DATA_SOURCES.md`, `MODEL_STATUS.md`, `SAFETY_AND_LIMITATIONS.md`, `DEVELOPER_HANDOVER.md`)

---

## 2. Completed Milestones

1. **Frontend Modernization & Accessibility**:
   - Built 9 dedicated platform modules with responsive mobile drawer navigation.
   - Migrated custom UI components to WAI-ARIA accessible Radix primitives (`DropdownMenuPrimitive`, `TooltipPrimitive`).
   - Integrated dark Leaflet choropleth using Esri Dark Gray tiles, dynamic tier badges, and safe DOM construction.
   - Centralized metadata polling in `StagingProvider` with `AbortController` cancellation.
   - Zero fabricated fallbacks: all fields derive from live API payloads or display explicit `Unavailable` states.
2. **Read-Only Staging Backend**:
   - 10 operational staging endpoints with strict Pydantic schemas.
   - Sub-10ms response caching and pure-Python GeoPackage WKB parser.
   - Automated test suite with 21 passing test cases.
3. **Model Development Archive Isolation**:
   - Partitioned pre-2025 development datasets (`< 2025-01-01`).
   - Encrypted private development archive (`LeptoWatch_Private_Development_Handover.zip`) with AES-256 outside repository.

---

## 3. Routine Verification Commands

Before creating any pull requests or committing new features, run the full verification matrix:

```bash
# 1. Backend Automated Tests (21 tests)
py -m pytest apps/api/tests/ -v

# 2. Frontend Strict TypeScript Typecheck
cd apps/web
npx tsc --noEmit

# 3. Frontend ESLint Static Analysis
npm run lint

# 4. Next.js Production Build
npm run build
```

---

## 4. Next Development Steps & Open Workstreams

### Workstream A: Official Administrative RDHS Boundary Ingestion
- Current status: 26 RDHS boundaries are provisional dissolved polygons derived from MOH administrative areas.
- Next step: Obtain officially surveyed and gazetted RDHS boundary shapefiles/GeoPackages from the Survey Department / Ministry of Health to resolve spatial overlap warnings.

### Workstream B: Upstream Environmental Issue-Time Latency Audits
- Current status: Reanalysis datasets (ERA5-Land and CHIRPS) are assumed retrospective.
- Next step: Establish automated timestamp logging on satellite ingestion pipelines to verify exact real-time availability dates for forecast issue times.

### Workstream C: Operational Authorization Protocol
- Current status: Models operate in `EXPERIMENTAL_STAGING_NOT_PRODUCTION_APPROVED` mode.
- Next step: Establish clinical and epidemiological evaluation protocols with the Epidemiology Unit to define criteria for prospective live deployment.
