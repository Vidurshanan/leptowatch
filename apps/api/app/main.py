"""Main FastAPI application entrypoint for LeptoWatch Staging API."""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.services.data_loader import data_loader
from app.routers import (
    health_router,
    dashboard_router,
    rdhs_router,
    forecasts_router,
    alerts_router,
    environment_router,
    history_router,
    model_router,
    data_quality_router,
    geo_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: preload staging datasets into memory cache."""
    try:
        data_loader.load_all()
    except Exception as e:
        print(f"Warning during staging dataset preload: {e}")
    yield


app = FastAPI(
    title="LeptoWatch Staging API",
    description=(
        "Read-only backend API for the LeptoWatch demonstration dashboard. "
        "Serves reproducible staging demonstration datasets across 26 RDHS areas. "
        "NOT APPROVED FOR OPERATIONAL PUBLIC-HEALTH USE."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    """API root informational banner."""
    return {
        "service": "LeptoWatch Read-Only Staging API",
        "mode": "STAGING_DEMONSTRATION_NOT_OPERATIONAL",
        "operational_approval": False,
        "docs_url": "/docs",
        "banner": (
            "Staging demonstration — not approved for operational public-health use. "
            "Watch + UNVERIFIED means freshness or verification requirements were not met; "
            "it is not evidence of elevated disease activity."
        ),
    }


# Include Routers under /api
api_prefix = "/api"
app.include_router(health_router, prefix=api_prefix)
app.include_router(dashboard_router, prefix=api_prefix)
app.include_router(rdhs_router, prefix=api_prefix)
app.include_router(forecasts_router, prefix=api_prefix)
app.include_router(alerts_router, prefix=api_prefix)
app.include_router(environment_router, prefix=api_prefix)
app.include_router(history_router, prefix=api_prefix)
app.include_router(model_router, prefix=api_prefix)
app.include_router(data_quality_router, prefix=api_prefix)
app.include_router(geo_router, prefix=api_prefix)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=False)
