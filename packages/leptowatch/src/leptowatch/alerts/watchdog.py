"""Data-quality watchdog for the live weekly run.

For each RDHS area it checks how old each input is against config alerts.max_age_days and
whether the newest values are plausible. Any failure marks the area Unverified (never "safe"),
and a system alert lists what is wrong.
"""
from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd

from leptowatch.config import load_config, rdhs_list


def check_inputs(latest: dict[str, pd.DataFrame], today: dt.date | None = None) -> pd.DataFrame:
    """latest: {'cases': df(rdhs, date), 'rain': ..., 'soil': ..., 'radar': ...} with the newest
    observation date per area. Returns one row per area with ages, failures and data_ok."""
    today = pd.Timestamp(today or dt.date.today())
    max_age = load_config()['alerts']['max_age_days']
    rows = []
    for a in rdhs_list():
        r = {'rdhs': a, 'failures': []}
        for src, lim in max_age.items():
            df = latest.get(src)
            if df is None or a not in set(df.rdhs):
                r[f'{src}_age_days'] = np.nan
                r['failures'].append(f'{src}: no data')
                continue
            d = pd.to_datetime(df.loc[df.rdhs == a, 'date']).max()
            age = (today - d).days
            r[f'{src}_age_days'] = age
            if age > lim:
                r['failures'].append(f'{src}: {age} days old (limit {lim})')
        r['data_ok'] = not r['failures']
        r['failures'] = '; '.join(r['failures'])
        rows.append(r)
    return pd.DataFrame(rows)


def plausibility(df: pd.DataFrame) -> list[str]:
    """Quick range checks on the newest weekly inputs."""
    issues = []
    if 'rain_mm' in df and (df.rain_mm > 1500).any():
        issues.append('weekly rainfall above 1500 mm')
    if 'soil_m3m3' in df and ((df.soil_m3m3 < 0) | (df.soil_m3m3 > 0.8)).any():
        issues.append('soil moisture out of range')
    if 'paddy_flood' in df and ((df.paddy_flood < 0) | (df.paddy_flood > 1)).any():
        issues.append('flooded share outside 0-1')
    return issues
