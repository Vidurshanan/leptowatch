"""Free Open-Meteo APIs (no key; CC BY 4.0).

  river   GloFAS river discharge (Flood API), daily, 1984 -> now + forecast.
          For each RDHS area we query 5 points (centroid and 4 offsets) and keep the largest
          discharge, i.e. the biggest river near the area. Stretch-goal feature.
  recent  last 92 days of rainfall per area centroid, for weeks CHIRPS has not published yet.

Run:  python -m leptowatch.data.openmeteo river|recent
"""
from __future__ import annotations

import json
import sys
import time

import pandas as pd

from leptowatch.config import path

FLOOD = 'https://flood-api.open-meteo.com/v1/flood'
FORECAST = 'https://api.open-meteo.com/v1/forecast'


def _centroids():
    gj = json.loads(path('raw', 'boundaries', 'rdhs_26_simplified.geojson').read_text())
    out = {}
    for f in gj['features']:
        xs, ys = [], []

        def walk(c):
            if isinstance(c[0], (int, float)):
                xs.append(c[0]); ys.append(c[1])
            else:
                for cc in c:
                    walk(cc)
        walk(f['geometry']['coordinates'])
        out[f['properties']['rdhs']] = (sum(ys) / len(ys), sum(xs) / len(xs))
    return out


def river(start='2007-01-01', end=None, delta=0.12):
    import requests
    end = end or pd.Timestamp.today().strftime('%Y-%m-%d')
    rows = []
    for rdhs, (lat, lon) in _centroids().items():
        pts = [(lat, lon), (lat + delta, lon), (lat - delta, lon), (lat, lon + delta), (lat, lon - delta)]
        series = []
        for la, lo in pts:
            r = requests.get(FLOOD, params={'latitude': la, 'longitude': lo, 'daily': 'river_discharge',
                                            'start_date': start, 'end_date': end}, timeout=120)
            if r.ok and 'daily' in r.json():
                d = r.json()['daily']
                series.append(pd.Series(d['river_discharge'], index=pd.to_datetime(d['time']), dtype=float))
            time.sleep(0.5)
        if series:
            s = pd.concat(series, axis=1).max(axis=1)
            rows.append(pd.DataFrame({'rdhs': rdhs, 'date': s.index, 'value': s.values}))
        print('  river', rdhs, 'ok' if series else 'FAILED')
    out = pd.concat(rows)
    out.to_csv(path('raw', 'openmeteo', 'river_daily.csv'), index=False)
    return out


def recent_rain(past_days=92):
    import requests
    rows = []
    for rdhs, (lat, lon) in _centroids().items():
        r = requests.get(FORECAST, params={'latitude': lat, 'longitude': lon, 'daily': 'precipitation_sum',
                                           'past_days': past_days, 'forecast_days': 14,
                                           'timezone': 'Asia/Colombo'}, timeout=60)
        r.raise_for_status()
        d = r.json()['daily']
        rows.append(pd.DataFrame({'rdhs': rdhs, 'date': pd.to_datetime(d['time']), 'value': d['precipitation_sum']}))
        time.sleep(0.3)
    out = pd.concat(rows)
    out.to_csv(path('raw', 'openmeteo', 'recent_rain_daily.csv'), index=False)
    return out


if __name__ == '__main__':
    {'river': river, 'recent': recent_rain}[sys.argv[1]]()
