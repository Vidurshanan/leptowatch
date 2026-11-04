"""Scores used in the evaluation plan (proposal Section 9)."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score

from leptowatch.models.common import qcol, quantile_levels


def mae(y, mu):
    return float(np.mean(np.abs(np.asarray(y) - np.asarray(mu))))


def wis(df, qs=None):
    """Weighted interval score from symmetric quantile pairs + median (Bracher et al. 2021). Lower is better."""
    qs = qs or quantile_levels()
    y = df.y35.values
    lower = [q for q in qs if q < 0.5]
    total = 0.5 * np.abs(y - df[qcol(0.5)].values)
    for ql in lower:
        a = 2 * ql
        lo, hi = df[qcol(ql)].values, df[qcol(1 - ql)].values
        isc = (hi - lo) + (2 / a) * (lo - y) * (y < lo) + (2 / a) * (y - hi) * (y > hi)
        total = total + (a / 2) * isc
    return float(np.mean(total / (len(lower) + 0.5)))


def coverage(df, level=0.8):
    lo, hi = qcol(round((1 - level) / 2, 4)), qcol(round(1 - (1 - level) / 2, 4))
    lo_c = df['lo'] if 'lo' in df else df[lo]
    hi_c = df['hi'] if 'hi' in df else df[hi]
    return float(np.mean((df.y35 >= lo_c) & (df.y35 <= hi_c)))


def ece(y, p, bins=10):
    """Expected calibration error with equal-count bins."""
    y, p = np.asarray(y, float), np.asarray(p, float)
    order = np.argsort(p)
    e = 0.0
    for chunk in np.array_split(order, bins):
        if len(chunk):
            e += len(chunk) / len(p) * abs(y[chunk].mean() - p[chunk].mean())
    return float(e)


def reliability(y, p, bins=10):
    y, p = np.asarray(y, float), np.asarray(p, float)
    order = np.argsort(p)
    rows = []
    for chunk in np.array_split(order, bins):
        if len(chunk):
            rows.append((p[chunk].mean(), y[chunk].mean(), len(chunk)))
    return pd.DataFrame(rows, columns=['p_mean', 'observed', 'n'])


def prob_scores(y, p):
    y, p = np.asarray(y, float), np.clip(np.asarray(p, float), 1e-6, 1 - 1e-6)
    ok = ~np.isnan(y) & ~np.isnan(p)
    y, p = y[ok], p[ok]
    if len(np.unique(y)) < 2:
        return {}
    base = y.mean()
    return {'n': int(len(y)), 'base_rate': round(float(base), 3),
            'brier': round(float(brier_score_loss(y, p)), 4),
            'brier_skill_vs_climatology': round(float(1 - brier_score_loss(y, p) / (base * (1 - base))), 3),
            'roc_auc': round(float(roc_auc_score(y, p)), 3),
            'pr_auc': round(float(average_precision_score(y, p)), 3),
            'pr_auc_lift': round(float(average_precision_score(y, p) / base), 2),
            'ece': round(ece(y, p), 3)}


def threshold_table(y, p, grid=None, beta=2.0):
    """Precision, recall, F1, F-beta and alert rate at each probability threshold."""
    y, p = np.asarray(y, float), np.asarray(p, float)
    ok = ~np.isnan(y) & ~np.isnan(p)
    y, p = y[ok], p[ok]
    grid = grid if grid is not None else np.round(np.arange(0.02, 0.99, 0.01), 2)
    rows = []
    for t in grid:
        a = p >= t
        tp, fp, fn = (a & (y == 1)).sum(), (a & (y == 0)).sum(), (~a & (y == 1)).sum()
        prec = tp / (tp + fp) if tp + fp else np.nan
        rec = tp / (tp + fn) if tp + fn else np.nan
        f1 = 2 * prec * rec / (prec + rec) if prec and rec else 0.0
        fb = (1 + beta ** 2) * prec * rec / (beta ** 2 * prec + rec) if prec and rec else 0.0
        rows.append((t, prec, rec, f1, fb, a.mean()))
    return pd.DataFrame(rows, columns=['threshold', 'precision', 'recall', 'f1', f'f{beta:g}', 'alert_rate'])


def count_scores(df):
    out = {'n': int(len(df)), 'mae': round(mae(df.y35, df.mu), 3)}
    if qcol(0.5) in df:
        out['wis'] = round(wis(df), 3)
        out['coverage80'] = round(coverage(df), 3)
    return out


def season_bootstrap_diff(a, b, by, stat, reps=1000, seed=0):
    """Difference stat(a) - stat(b) with a 95% CI from resampling whole seasons (years)."""
    rng = np.random.default_rng(seed)
    groups = a[by].unique()
    est = stat(a) - stat(b)
    diffs = []
    for _ in range(reps):
        g = rng.choice(groups, len(groups), replace=True)
        aa = pd.concat([a[a[by] == x] for x in g])
        bb = pd.concat([b[b[by] == x] for x in g])
        diffs.append(stat(aa) - stat(bb))
    lo, hi = np.percentile(diffs, [2.5, 97.5])
    return {'estimate': round(float(est), 4), 'ci95': [round(float(lo), 4), round(float(hi), 4)]}
