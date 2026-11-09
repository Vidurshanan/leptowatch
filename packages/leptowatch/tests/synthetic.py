"""Synthetic 'truth' data with a KNOWN flood effect, for testing the machinery only.

Never report numbers from this data. Its purpose: if the pipeline cannot find an effect that we
planted ourselves, it cannot be trusted to find (or rule out) a real one.

Planted truth: cases rise 4-8 weeks after paddy flooding during cultivation seasons, plus a weaker
rainfall effect, district differences, seasonality and a slow upward trend.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from leptowatch import epicalendar
from leptowatch.config import rdhs_list


def make(seed=0, last_date='2026-06-30', flood_effect=1.2, rain_effect=0.25, sat_from=2017):
    rng = np.random.default_rng(seed)
    cal = epicalendar.weeks_table(2007, pd.Timestamp(last_date).date())
    areas = rdhs_list()
    T, R = len(cal), len(areas)
    doy = cal.start.dt.dayofyear.values
    season = 1.0 + 0.8 * np.cos(2 * np.pi * (doy - 330) / 365) ** 2          # wet seasons
    rain = rng.gamma(2.0, 25.0, size=(T, R)) * season[:, None] * rng.uniform(0.6, 1.4, size=R)[None, :]
    soil = np.zeros_like(rain)
    for t in range(1, T):
        soil[t] = 0.7 * soil[t - 1] + 0.3 * np.clip(rain[t] / 300, 0, 0.45)
    cultiv = np.isin(cal.start.dt.month.values, [4, 5, 10, 11, 12])
    paddy_share = rng.uniform(0.05, 0.4, size=R)
    r2 = rain + np.vstack([rain[:1], rain[:-1]])
    flood = np.clip((r2 - 120) / 600, 0, None) * cultiv[:, None] * paddy_share[None, :] * 4 + \
        rng.gamma(1.0, 0.003, size=(T, R))
    flood = np.clip(flood, 0, 0.9)
    # true log-rate: flood lags 4-8 weeks, rain lags 2-6 weeks
    lagged_flood = np.zeros_like(flood)
    for k in range(4, 9):
        lagged_flood[k:] += flood[:-k] / 5
    lagged_rain = np.zeros_like(rain)
    for k in range(2, 7):
        lagged_rain[k:] += np.log1p(rain[:-k]) / 5
    base = rng.uniform(0.0, 1.8, size=R)
    trend = np.linspace(0, 0.6, T)[:, None]
    eta = base[None, :] + 0.4 * np.log(season)[:, None] + flood_effect * np.log1p(25 * lagged_flood) \
        + rain_effect * (lagged_rain - lagged_rain.mean()) + trend
    mu = np.exp(eta)
    r = 3.0
    cases = rng.negative_binomial(r, r / (r + mu)).astype(float)
    cases[rng.random(size=cases.shape) < 0.03] = np.nan            # missing reports
    panel = pd.DataFrame({'t': np.repeat(cal.t.values, R), 'week_start': np.repeat(cal.start.values, R),
                          'year': np.repeat(cal.year.values, R), 'week': np.repeat(cal.week.values, R),
                          'rdhs': np.tile(areas, T), 'cases': cases.ravel()})
    panel['status'] = np.where(panel.cases.isna(), 'no_accepted_report', 'ok')
    fl = flood.copy()
    fl[cal.start.dt.year.values < sat_from] = np.nan
    land = np.clip(fl * 0.6 + rng.gamma(1.0, 0.002, size=fl.shape), 0, 1)
    env = pd.DataFrame({'rdhs': np.tile(areas, T), 'week_start': np.repeat(cal.start.values, R),
                        'rain_mm': rain.ravel(), 'soil_m3m3': (0.1 + soil).ravel(),
                        'paddy_flood': fl.ravel(), 'land_flood': land.ravel()})
    adj = pd.DataFrame({'a': areas[:-1], 'b': areas[1:]})
    return panel, env, adj
