"""Public forecast ledger: every weekly forecast is appended to a hash chain.

Each line of ledger/forecasts.jsonl holds one week's forecasts plus the SHA-256 of the previous
line. Commit the file to GitHub every week: anyone can later verify that a forecast existed before
the outcome was known, and that no past line was edited (verify() recomputes the chain).
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json

import pandas as pd

from leptowatch.config import path

GENESIS = '0' * 64


def _file():
    return path('ledger', 'forecasts.jsonl')


def _digest(obj) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def append(issue_date: str, forecasts: pd.DataFrame, model_version: str) -> str:
    f = _file()
    prev = GENESIS
    if f.exists() and f.read_text().strip():
        prev = json.loads(f.read_text().strip().splitlines()[-1])['hash']
    body = {'issue_date': issue_date, 'committed_utc': dt.datetime.utcnow().isoformat(timespec='seconds'),
            'model_version': model_version, 'prev_hash': prev,
            'forecasts': json.loads(forecasts.to_json(orient='records', date_format='iso'))}
    body['hash'] = _digest({k: v for k, v in body.items() if k != 'hash'})
    with open(f, 'a') as fh:
        fh.write(json.dumps(body) + '\n')
    return body['hash']


def verify() -> dict:
    f = _file()
    if not f.exists():
        return {'ok': True, 'entries': 0}
    prev = GENESIS
    for i, line in enumerate(f.read_text().strip().splitlines(), 1):
        b = json.loads(line)
        if b['prev_hash'] != prev or _digest({k: v for k, v in b.items() if k != 'hash'}) != b['hash']:
            return {'ok': False, 'broken_at_entry': i}
        prev = b['hash']
    return {'ok': True, 'entries': i, 'last_hash': prev}
