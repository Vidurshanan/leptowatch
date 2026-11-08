"""API router registrations."""

from app.routers.health import router as health_router
from app.routers.dashboard import router as dashboard_router
from app.routers.rdhs import router as rdhs_router
from app.routers.forecasts import router as forecasts_router
from app.routers.alerts import router as alerts_router
from app.routers.environment import router as environment_router
from app.routers.history import router as history_router
from app.routers.model import router as model_router
from app.routers.data_quality import router as data_quality_router
from app.routers.geo import geo_router
from app.routers.historical_validation import router as historical_validation_router

__all__ = [
    "health_router",
    "dashboard_router",
    "rdhs_router",
    "forecasts_router",
    "alerts_router",
    "environment_router",
    "history_router",
    "model_router",
    "data_quality_router",
    "geo_router",
]
