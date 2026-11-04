"""Test configuration and fixtures."""

import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure apps/api is in sys.path
api_root = Path(__file__).resolve().parents[1]
if str(api_root) not in sys.path:
    sys.path.insert(0, str(api_root))

from app.main import app
from app.services.data_loader import data_loader


@pytest.fixture(scope="session", autouse=True)
def preload_data():
    """Ensure data is loaded before test run."""
    data_loader.load_all()


@pytest.fixture(scope="session")
def client():
    """Test client fixture."""
    with TestClient(app) as test_client:
        yield test_client
