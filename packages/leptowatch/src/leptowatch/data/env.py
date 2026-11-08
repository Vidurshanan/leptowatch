"""Turn the raw environmental exports into one weekly table per RDHS area.

Weeks are the WER reporting weeks (Saturday-Friday to 2025, Monday-Sunday from 2026), so every
value lines up with the case counts by week start date.

Inputs (data/raw):  ee/lw_rain_*.csv, ee/lw_soil_*.csv, ee/lw_flood_*.csv, ee/lw_gfs_*.csv (optional),
                    openmeteo/river_daily.csv (optional), openmeteo/recent_rain_daily.csv (optional)
Output:             processed/env_weekly.csv  and  reports/env_checks.json

Run:  python -m leptowatch.data.env
"""
from __future__ import annotations

import glob
import json
import os

import numpy as np
import pandas as pd

from leptowatch import epicalendar
from leptowatch.config import path, rdhs_list


def _read_many(pattern):
    files = sorted(glob.glob(str(path('raw', 'ee', 'x').parent / pattern)))
    if not files:
        return None
    return pd.concat([pd.read_csv(f) for f in files], ignore_index=True)


def day_to_week(dates: pd.Series) -> pd.Series:
    """Map dates to the start date of their reporting week (NaT for 27-28 Dec 2025)."""
    first = dates.min().year - 1
    cal = epicalendar.weeks_table(first, dates.max().date() + pd.Timedelta(days=7))
    days = pd.DataFrame({'date': pd.date_range(cal.start.min(), cal.end.max())})
    days = pd.merge_asof(days, cal[['start', 'end']], left_on='date', right_on='start')
    days.loc[days.date > days.end, 'start'] = pd.NaT
    m = dict(zip(days.date, days.start))
    return dates.map(m)


def weekly_daily_var(df, how):
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])
    df = df.drop_duplicates(['rdhs', 'date'])
    df['week_start'] = day_to_week(df['date'])
    g = df.dropna(subset=['week_start']).groupby(['rdhs', 'week_start'])
    out = g['value'].agg(how).rename('value').to_frame()
    out['n_days'] = g['value'].count()
    return out.reset_index()


def weekly_flood(fl):
    fl = fl.copy()
    fl['date'] = pd.to_datetime(fl['date'])
    fl = fl.drop_duplicates(['rdhs', 'date'])
    fl['paddy_frac'] = np.where(fl.paddy_obs_ha > 0, fl.paddy_flood_ha / fl.paddy_obs_ha, np.nan)
    fl['land_frac'] = np.where(fl.land_obs_ha > 0, fl.land_flood_ha / fl.land_obs_ha, np.nan)
    # a pass that sees less than 20% of the area's paddy is too partial to trust
    full = fl.groupby('rdhs').paddy_obs_ha.transform('max')
    fl.loc[fl.paddy_obs_ha < 0.2 * full, ['paddy_frac', 'land_frac']] = np.nan
    fl['week_start'] = day_to_week(fl['date'])
    g = fl.dropna(subset=['week_start']).groupby(['rdhs', 'week_start'])
    out = g.agg(paddy_flood=('paddy_frac', 'max'), land_flood=('land_frac', 'max'),
                radar_last_pass=('date', 'max'), radar_passes=('date', 'count')).reset_index()
    return out


def gfs_weekly(g):
    """Seven-day forecast rainfall per issue Monday. Detects whether the band is accumulated."""
    g = g.copy().sort_values(['rdhs', 'issue_date', 'h'])
    mono = (g.groupby(['rdhs', 'issue_date'])['mean'].diff().dropna() >= -1e-6).mean()
    if mono > 0.95:     # accumulated since the start of the run: 7-day total = value at 168 h
        tot = g[g.h == g.h.max()].set_index(['rdhs', 'issue_date'])['mean']
    else:               # per-step values: add them up (6-hour steps sampled daily -> scale by 4)
        tot = g.groupby(['rdhs', 'issue_date'])['mean'].sum() * 4
    out = tot.rename('rain_fcst_7d').reset_index()
    out['week_start'] = day_to_week(pd.to_datetime(out.issue_date))
    print(f'GFS: accumulated band detected = {mono > 0.95} (monotone share {mono:.2f})')
    return out.dropna(subset=['week_start'])[['rdhs', 'week_start', 'rain_fcst_7d']]


def build_env(out_csv=None):
    parts = []
    rain = _read_many('lw_rain_*.csv')
    if rain is not None:
        r = weekly_daily_var(rain.rename(columns={'mean': 'value'}), 'sum').rename(
            columns={'value': 'rain_mm', 'n_days': 'rain_days'})
        parts.append(r)
    soil = _read_many('lw_soil_*.csv')
    if soil is not None:
        s = weekly_daily_var(soil.rename(columns={'mean': 'value'}), 'mean').rename(
            columns={'value': 'soil_m3m3', 'n_days': 'soil_days'})
        parts.append(s)
    fl = _read_many('lw_flood_*.csv')
    if fl is not None:
        parts.append(weekly_flood(fl))
    gf = _read_many('lw_gfs_*.csv')
    if gf is not None:
        parts.append(gfs_weekly(gf))
    rv = path('raw', 'openmeteo', 'river_daily.csv')
    if rv.exists():
        parts.append(weekly_daily_var(pd.read_csv(rv), 'max').rename(
            columns={'value': 'river_max', 'n_days': 'river_days'}))
    if not parts:
        raise FileNotFoundError('No environmental exports found in data/raw/ee - run notebook 04 first')
    env = parts[0]
    for p in parts[1:]:
        env = env.merge(p, on=['rdhs', 'week_start'], how='outer')
    env = env.sort_values(['rdhs', 'week_start']).reset_index(drop=True)
    checks = check_env(env)
    if out_csv is None:
        out_csv = path('processed', 'env_weekly.csv')
    env.to_csv(out_csv, index=False)
    path('reports', 'env_checks.json').write_text(json.dumps(checks, indent=1, default=str))
    print(f'env_weekly: {len(env):,} rows, columns: {list(env.columns)}')
    print(json.dumps(checks, indent=1, default=str))
    return env


def check_env(env):
    """Watchdog checks on the environmental table (these caught two real problems in the pilot)."""
    out = {'areas_present': sorted(env.rdhs.unique().tolist())}
    out['areas_missing'] = sorted(set(rdhs_list()) - set(out['areas_present']))
    problems = []
    for col in [c for c in ['rain_mm', 'soil_m3m3', 'paddy_flood', 'river_max'] if c in env]:
        piv = env.pivot_table(index='week_start', columns='rdhs', values=col)
        empty = [c for c in piv.columns if piv[c].notna().sum() == 0]
        if empty:
            problems.append(f'{col}: no values for {empty}')
        cols = list(piv.columns)
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                a, b = piv[cols[i]], piv[cols[j]]
                both = a.notna() & b.notna()
                if both.sum() > 20 and np.allclose(a[both], b[both]):
                    if {cols[i], cols[j]} != {'Ampara', 'Kalmunai'}:
                        problems.append(f'{col}: {cols[i]} identical to {cols[j]}')
        if (env[col] < 0).any():
            problems.append(f'{col}: negative values')
    if 'soil_m3m3' in env and ((env.soil_m3m3 > 0.8) | (env.soil_m3m3 < 0)).any():
        problems.append('soil moisture outside 0-0.8 m3/m3')
    if 'rain_mm' in env and (env.rain_mm > 1500).any():
        problems.append('weekly rainfall above 1500 mm')
    if 'rain_days' in env:
        complete = env.week_start < env.week_start.max() - pd.Timedelta(days=14)
        short = env[complete & (env.rain_days < 7)]
        if len(short):
            problems.append(f'rain: {len(short)} past weeks with fewer than 7 days')
    out['problems'] = problems
    out['passed'] = not problems
    return out


if __name__ == '__main__':
    build_env()
