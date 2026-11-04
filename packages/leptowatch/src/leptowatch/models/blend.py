"""Blend detectors A and B, calibrate the probabilities and make honest intervals.

  probabilities  logistic stacking of A and B fitted on EARLIER years' out-of-fold forecasts
                 (Platt form: logit pA, logit pB; or beta form: log p and log(1-p) of each),
                 the form with the lower Brier score on an inner time split is kept;
                 equal weights when fewer than two earlier years are available.
  counts         quantiles of A and B averaged (Vincentisation), then conformalised (CQR,
                 Romano 2019) with scores from earlier years, and kept honest over time with
                 adaptive conformal inference (ACI, Gibbs & Candes 2021) using delayed feedback.

Everything is rolling: the blend applied to year Y never sees outcomes from year Y or later.

Run:  python -m leptowatch.models.blend
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

from leptowatch import io
from leptowatch.config import load_config, path
from leptowatch.models.common import qcol, quantile_levels

EPS = 1e-4


def _logit(p):
    p = np.clip(np.asarray(p, float), EPS, 1 - EPS)
    return np.log(p / (1 - p))


def _feats(pa, pb, form):
    pa, pb = np.clip(pa, EPS, 1 - EPS), np.clip(pb, EPS, 1 - EPS)
    if form == 'platt':
        return np.column_stack([_logit(pa), _logit(pb)])
    return np.column_stack([np.log(pa), -np.log(1 - pa), np.log(pb), -np.log(1 - pb)])


class Stacker:
    def fit(self, pa, pb, y, issue_weeks):
        pa = np.asarray(pa, float)
        pb = np.asarray(pb, float)
        y = np.asarray(y, float)
        issue_weeks = np.asarray(issue_weeks)
        n = len(y)

        if not (len(pa) == len(pb) == len(issue_weeks) == n):
            raise ValueError("Stacker inputs must have identical lengths.")
        if pd.isna(issue_weeks).any():
            raise ValueError("Stacker issue weeks contain missing values.")

        if n < 200 or len(np.unique(y)) < 2:
            self.form, self.lr = 'equal', None
            return self

        # Split by unique issue week so districts from one week stay together.
        unique_weeks = np.sort(pd.unique(issue_weeks))
        if len(unique_weeks) < 2:
            self.form, self.lr = 'equal', None
            return self

        cut = int(len(unique_weeks) * 0.7)
        cut = min(max(cut, 1), len(unique_weeks) - 1)
        train_mask = np.isin(issue_weeks, unique_weeks[:cut])
        valid_mask = np.isin(issue_weeks, unique_weeks[cut:])

        if not train_mask.any() or not valid_mask.any() or len(np.unique(y[train_mask])) < 2:
            self.form, self.lr = 'equal', None
            return self

        best = None
        for form in ('platt', 'beta'):
            lr = LogisticRegression(C=1.0, max_iter=1000).fit(
                _feats(pa[train_mask], pb[train_mask], form), y[train_mask]
            )
            p = lr.predict_proba(_feats(pa[valid_mask], pb[valid_mask], form))[:, 1]
            brier = np.mean((p - y[valid_mask]) ** 2)
            if best is None or brier < best[0]:
                best = (brier, form)

        self.form = best[1]
        self.lr = LogisticRegression(C=1.0, max_iter=1000).fit(
            _feats(pa, pb, self.form), y
        )
        return self

    def predict(self, pa, pb):
        if self.lr is None:
            return 1 / (1 + np.exp(-(0.5 * _logit(pa) + 0.5 * _logit(pb))))
        return self.lr.predict_proba(_feats(pa, pb, self.form))[:, 1]


def rolling_blend(oa: pd.DataFrame, ob: pd.DataFrame, case_lag=None):
    """oa, ob: OOF frames of detectors A and B (same rows). Returns the blended OOF frame."""
    cfg = load_config()
    L = cfg['forecast']['case_lag_weeks'] if case_lag is None else case_lag
    level = cfg['models']['interval_level']
    keys = ['t', 'rdhs']
    m = oa.merge(ob, on=keys, suffixes=('_A', '_B')).sort_values(['t', 'rdhs']).reset_index(drop=True)
    out = m[keys].copy()
    for c in ['issue_start', 'year', 'y35', 'surgeE', 'surgeH', 'thrE35', 'thrH35']:
        out[c] = m[f'{c}_A'].values
    qs = quantile_levels()
    for q in qs:
        out[qcol(q)] = 0.5 * (m[f'{qcol(q)}_A'] + m[f'{qcol(q)}_B'])
    out['mu'] = 0.5 * (m.mu_A + m.mu_B)
    out['pE'] = np.nan
    out['pH'] = np.nan
    out['blend_form'] = ''
    lo_q, hi_q = round((1 - level) / 2, 4), round(1 - (1 - level) / 2, 4)
    out['lo'], out['hi'] = out[qcol(lo_q)], out[qcol(hi_q)]
    years = sorted(out.year.unique())
    cal_years = cfg['models'].get('calibration_years')
    for Y in years:
        rows = out.year == Y
        t_first = out.loc[rows, 't'].min()
        known = (out.t + 5 <= t_first - L)            # outcomes published before year Y starts
        known_cal = known & (out.year >= Y - cal_years) if cal_years else known
        for lab, col in (('surgeE', 'pE'), ('surgeH', 'pH')):
            k = known_cal & m[f'{lab}_A'].notna() & m[f'{col}_A'].notna() & m[f'{col}_B'].notna()
            st = Stacker().fit(m.loc[k, f'{col}_A'].values, m.loc[k, f'{col}_B'].values, m.loc[k, f'{lab}_A'].values, m.loc[k, 't'].values)
            r = rows & m[f'{col}_A'].notna() & m[f'{col}_B'].notna()
            out.loc[r, col] = st.predict(m.loc[r, f'{col}_A'].values, m.loc[r, f'{col}_B'].values)
            if col == 'pE':
                out.loc[rows, 'blend_form'] = st.form
        # CQR: widen/narrow the central interval using scores from recent earlier years
        k = known_cal & out.y35.notna()
        if k.sum() >= 100:
            s = np.maximum(out.loc[k, qcol(lo_q)] - out.loc[k, 'y35'], out.loc[k, 'y35'] - out.loc[k, qcol(hi_q)])
            n = len(s)
            Q = float(np.quantile(s, min(1, level * (1 + 1 / n))))
            out.loc[rows, 'lo'] = (out.loc[rows, qcol(lo_q)] - Q).clip(lower=0)
            out.loc[rows, 'hi'] = out.loc[rows, qcol(hi_q)] + Q
            out.loc[rows, 'cqr_Q'] = Q
    return out


def aci(df, level=None, gamma=None, delay=None):
    """Online CQR with adaptive conformal inference (Gibbs & Candes 2021).

    Scores s = max(q_lo - y, y - q_hi) of forecasts whose outcome is already published are kept in
    a growing list. Each issue week, the interval is [q_lo - Q, q_hi + Q], Q = the (1 - a_t)
    quantile of past scores. After each published outcome, a_t moves by gamma * (target - miss):
    more misses than allowed -> a_t falls -> intervals widen. Feedback arrives `delay` weeks late
    (publication lag + horizon), exactly as it would live. Adds columns lo_aci, hi_aci, alpha_t."""
    cfg = load_config()
    level = level or cfg['models']['interval_level']
    gamma = gamma or cfg['models']['aci_gamma']
    delay = delay if delay is not None else cfg['forecast']['case_lag_weeks'] + 5
    lo_q, hi_q = qcol(round((1 - level) / 2, 4)), qcol(round(1 - (1 - level) / 2, 4))
    target = 1 - level
    cy = cfg['models'].get('calibration_years')
    window = int(cy * 52) if cy else None           # use only recent scores (rates drift over time)
    df = df.sort_values(['t', 'rdhs']).copy()
    df['lo_aci'], df['hi_aci'], df['alpha_t'] = np.nan, np.nan, np.nan
    a_t, scores, pending = target, [], []
    for t, g in df.groupby('t', sort=True):
        ready = [p for p in pending if p[0] <= t - delay]
        pending = [p for p in pending if p[0] > t - delay]
        for t_i, s_i, miss in ready:
            scores.append((t_i, s_i))
            a_t = float(np.clip(a_t + gamma * (target - miss), 0.005, 0.5))
        recent = [s_ for t_, s_ in scores if t_ >= t - window] if window else [s_ for _, s_ in scores]
        Q = max(0.0, float(np.quantile(recent, 1 - a_t))) if len(recent) >= 100 else 0.0
        lo = (g[lo_q] - Q).clip(lower=0)
        hi = g[hi_q] + Q
        df.loc[g.index, 'lo_aci'], df.loc[g.index, 'hi_aci'], df.loc[g.index, 'alpha_t'] = lo, hi, a_t
        for i in g.index[g.y35.notna()]:
            y = df.at[i, 'y35']
            s_i = max(df.at[i, lo_q] - y, y - df.at[i, hi_q])
            pending.append((t, s_i, float(y < lo[i] or y > hi[i])))
    return df


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--final', action='store_true', help='blend the locked-test forecasts (stackers learn from pre-test years)')
    a = ap.parse_args()
    oa = io.load(path('processed', 'oof_A.parquet'))
    ob = io.load(path('processed', 'oof_B.parquet'))
    if a.final:
        fa, fb = io.load(path('processed', 'oof_A_final.parquet')), io.load(path('processed', 'oof_B_final.parquet'))
        test_keys = set(zip(fa.t, fa.rdhs))
        oa, ob = pd.concat([oa, fa], ignore_index=True), pd.concat([ob, fb], ignore_index=True)
    bl = aci(rolling_blend(oa, ob))
    if a.final:
        bl = bl[[k in test_keys for k in zip(bl.t, bl.rdhs)]]
    io.save(bl, path('processed', f'oof_blend{"_final" if a.final else ""}.parquet'))
    k = bl.y35.notna()
    print(json.dumps({'rows': int(len(bl)), 'coverage80_quantiles': round(float(
        ((bl.y35 >= bl[qcol(0.1)]) & (bl.y35 <= bl[qcol(0.9)]))[k].mean()), 3),
        'coverage80_cqr': round(float(((bl.y35 >= bl.lo) & (bl.y35 <= bl.hi))[k].mean()), 3),
        'coverage80_aci': round(float(((bl.y35 >= bl.lo_aci) & (bl.y35 <= bl.hi_aci))[k].mean()), 3),
        'forms': bl.blend_form.value_counts().to_dict()}, indent=1))


if __name__ == '__main__':
    main()
