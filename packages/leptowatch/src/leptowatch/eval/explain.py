"""Plain-language reasons from fixed templates (never free text from a language model).

Detector B: exact TreeSHAP values from LightGBM (pred_contrib). Detector A: term contributions.
The top three drivers that push risk UP are turned into sentences.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

TEMPLATES = {
    'pflood': 'paddy land is unusually wet on the latest radar passes ({v})',
    'lflood': 'more land than usual is under water on recent radar passes ({v})',
    'rain': 'rainfall over recent weeks is above the usual level for this time of year ({v})',
    'soil': 'soils are wetter than usual for this time of year ({v})',
    'river': 'nearby river flow is above its usual level ({v})',
    'rain_fcst': 'heavy rain is forecast for the coming week ({v})',
    'c_': 'reported cases are rising compared with recent weeks ({v})',
    'b0': 'the same weeks last year had many cases ({v})',
    'b1': 'these weeks are usually a high season in this district ({v})',
    'nowcast': 'recent weeks not yet published are estimated to be high ({v})',
    'nb_': 'neighbouring districts show rising risk ({v})',
    'season': 'this is the usual season for rising cases',
    'scale': 'this district has a high usual case load',
    'district': 'this district has a high usual case load',
}
VALUE_FMT = {'pflood_max4w_ratio': '{:.1f} times the usual level', 'pflood_max2w_ratio': '{:.1f} times the usual level',
             'rain_4w_anom': '{:+.0f} mm over 4 weeks', 'rain_12w_anom': '{:+.0f} mm over 12 weeks',
             'soil_4w_anom': '{:+.2f} m3/m3', 'c_last4': '{:.0f} cases in the last 4 published weeks',
             'rain_fcst_7d': '{:.0f} mm forecast', 'b0_same_window_last_year': '{:.0f} cases',
             'nowcast_last3': 'about {:.0f} cases'}


def _fmt(feature, raw):
    if feature in VALUE_FMT:
        return VALUE_FMT[feature].format(raw)
    if feature.startswith(('nowcast', 'c_', 'b0', 'b1', 'scale')):
        return f'about {raw:.0f} cases'
    return f'{raw:.0f}' if abs(raw) >= 10 else f'{raw:.2f}'


def _key(feature):
    if feature.startswith(('sin', 'cos', 'cultivation')):
        return 'season'
    for k in ['pflood', 'lflood', 'rain_fcst', 'rain', 'soil', 'river', 'nowcast', 'nb_', 'b0', 'b1', 'scale',
              'district', 'c_']:
        if feature.startswith(k) or feature == k:
            return k
    return None


def reasons(contrib: pd.DataFrame, values: pd.DataFrame, top=3) -> list[list[str]]:
    """contrib: rows x features (positive = pushes risk up). values: same rows with raw feature values."""
    out = []
    for i in contrib.index:
        c = contrib.loc[i].sort_values(ascending=False)
        seen, lines = set(), []
        for f, v in c.items():
            if v <= 0 or len(lines) >= top:
                break
            k = _key(f)
            if k is None or k in seen:
                continue
            seen.add(k)
            raw = values.loc[i, f] if f in values.columns else np.nan
            vtxt = _fmt(f, float(raw)) if pd.notna(raw) and isinstance(raw, (int, float, np.integer, np.floating)) else ''
            lines.append(TEMPLATES[k].format(v=vtxt).replace(' ()', ''))
        out.append(lines or ['no single driver stands out; risk follows the usual seasonal pattern'])
    return out
