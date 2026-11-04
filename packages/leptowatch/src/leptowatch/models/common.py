"""Shared pieces: the prediction format every model returns, and negative-binomial helpers.

Every model's .predict(df) returns a DataFrame with the same index as df and columns
  mu                 expected 3-week total (weeks t+3..t+5)
  q0.025 ... q0.975  predictive quantiles (config models.quantiles)
  pE, pH             probability that the total exceeds the Elevated / High level
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

from leptowatch.config import load_config


def quantile_levels():
    return load_config()['models']['quantiles']


def qcol(q):
    return f'q{q:g}'


def nb_dispersion(y, mu):
    """Method-of-moments NB2 dispersion alpha: Var = mu + alpha mu^2 (floored at 1e-3)."""
    y, mu = np.asarray(y, float), np.asarray(mu, float)
    ok = np.isfinite(y) & np.isfinite(mu) & (mu > 0)
    if ok.sum() < 10:
        return 0.5
    num = ((y[ok] - mu[ok]) ** 2 - mu[ok]).sum()
    den = (mu[ok] ** 2).sum()
    return float(np.clip(num / den, 1e-3, 20))


def nb_frame(mu, alpha, thrE, thrH, index):
    """Predictive frame from NB2(mu, alpha)."""
    mu = np.clip(np.asarray(mu, float), 1e-6, None)
    r = 1.0 / alpha
    p = r / (r + mu)
    out = pd.DataFrame({'mu': mu}, index=index)
    for q in quantile_levels():
        out[qcol(q)] = stats.nbinom.ppf(q, r, p)
    for name, thr in (('pE', thrE), ('pH', thrH)):
        thr = np.asarray(thr, float)
        v = stats.nbinom.sf(np.floor(np.nan_to_num(thr, nan=0.0)), r, p)
        out[name] = np.where(np.isnan(thr), np.nan, v)
    return out


def sort_quantiles(pred):
    """Make quantile columns non-decreasing row by row (quantile heads can cross)."""
    cols = [qcol(q) for q in quantile_levels() if qcol(q) in pred]
    if cols:
        pred[cols] = np.sort(pred[cols].values, axis=1)
    return pred
