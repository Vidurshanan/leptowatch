"""Small helpers to save and load tables (Parquet when available, CSV otherwise)."""
from __future__ import annotations

from pathlib import Path

import pandas as pd


def _has_parquet():
    try:
        import pyarrow  # noqa: F401
        return True
    except ImportError:
        return False


def save(df: pd.DataFrame, p: Path | str) -> Path:
    p = Path(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    if p.suffix == '.parquet' and not _has_parquet():
        p = p.with_suffix('.csv')
    if p.suffix == '.parquet':
        df.to_parquet(p, index=False)
    else:
        df.to_csv(p, index=False)
    return p


def load(p: Path | str) -> pd.DataFrame:
    p = Path(p)
    if p.suffix == '.parquet' and not p.exists() and p.with_suffix('.csv').exists():
        p = p.with_suffix('.csv')
    df = pd.read_parquet(p) if p.suffix == '.parquet' else pd.read_csv(p)
    for c in df.columns:
        if c in ('week_start', 'issue_start', 'date', 'radar_last_pass', 'start', 'end') and \
                not pd.api.types.is_datetime64_any_dtype(df[c]):
            df[c] = pd.to_datetime(df[c])
    return df


def exists(p: Path | str) -> bool:
    """True if the table exists as given or as its CSV fallback."""
    p = Path(p)
    return p.exists() or (p.suffix == '.parquet' and p.with_suffix('.csv').exists())
