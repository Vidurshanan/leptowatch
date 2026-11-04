"""Read-only API over the latest forecasts and the ledger.

Run:  uvicorn leptowatch.api.app:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
from __future__ import annotations

import json

from fastapi import FastAPI, HTTPException

from leptowatch.alerts import ledger
from leptowatch.config import path

app = FastAPI(title='LeptoWatch API', version='1.0.0',
              description='Leptospirosis surge outlook (weeks +3 to +5) for the 26 RDHS areas of Sri Lanka.')


def _latest():
    p = path('outputs', 'forecast_latest.json')
    if not p.exists():
        raise HTTPException(503, 'No forecast yet: run `python -m leptowatch.pipeline weekly`')
    return json.loads(p.read_text())


@app.get('/health')
def health():
    return {'ok': True, 'ledger': ledger.verify()}


@app.get('/forecast/latest')
def latest():
    return _latest()


@app.get('/forecast/{rdhs}')
def by_area(rdhs: str):
    rows = [r for r in _latest() if r['rdhs'].lower() == rdhs.lower()]
    if not rows:
        raise HTTPException(404, f'unknown RDHS area: {rdhs}')
    return rows[0]


@app.get('/ledger/verify')
def verify():
    return ledger.verify()
