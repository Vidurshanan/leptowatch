"""Build the modelling table: one row per RDHS area per issue week, with features and targets.

THE AS-OF RULE (no leakage): a forecast issued at the start of week t may only use
  * case counts for weeks <= t - case_lag   (the WER publication lag)
  * environmental values for weeks <= t - env_lag
  * thresholds computed from EARLIER YEARS only.
tests/test_leakage.py re-builds features with all data after the cut-off deleted and checks
that every feature value is identical. Run it after any change to this file.

Targets
  y35   reported cases over weeks t+3..t+5 (main horizon)
  y12   reported cases over weeks t+1..t+2 (imminent horizon)
  thrE35/thrH35   Elevated (P75) and High (P90) levels of the seasonal endemic channel for that window
  surgeE/surgeH   y35 above those levels

Run:  python -m leptowatch.features.build
"""
from __future__ import annotations

import json
import warnings

import numpy as np
import pandas as pd

from leptowatch import io
from leptowatch.config import load_config, path, rdhs_list


# ----------------------------------------------------------------------------- helpers
def _back_index(starts: pd.Series, k: int) -> np.ndarray:
    """For every week t, index of the week starting closest to start[t] minus k years (or -1)."""
    starts = pd.to_datetime(starts)
    s = starts.to_numpy(dtype="datetime64[D]")
    tgt = (starts - pd.DateOffset(years=k)).to_numpy(dtype="datetime64[D]")
    j = np.searchsorted(s, tgt)
    j = np.clip(j, 1, len(s) - 1)
    left_closer = (tgt - s[j - 1]) < (s[j] - tgt)
    idx = np.where(left_closer, j - 1, j)
    idx[tgt < s[0] - np.timedelta64(4, "D")] = -1
    return idx


def _window_sum(X: np.ndarray, length: int) -> np.ndarray:
    """W[t] = X[t] + ... + X[t+length-1]; NaN if any week is missing or beyond the end."""
    return sum(_shift(X, -i) for i in range(length))


def _shift(X, k):
    """Y[t] = X[t-k] (k>0 looks back)."""
    Y = np.full_like(X, np.nan, dtype=float)
    if k > 0:
        Y[k:] = X[:-k]
    elif k < 0:
        Y[:k] = X[-k:]
    else:
        Y[:] = X
    return Y


def _trailing(X, end_lag, n, how='sum'):
    """Aggregate of X[t-end_lag-n+1 .. t-end_lag] (nan-aware: mean * n for sums)."""
    stack = np.stack([_shift(X, end_lag + i) for i in range(n)])
    with np.errstate(all='ignore'):
        if how == 'sum':
            cnt = (~np.isnan(stack)).sum(0)
            out = np.nanmean(stack, 0) * n
            out[cnt < max(1, n // 2)] = np.nan
            return out
        if how == 'max':
            out = np.nanmax(np.where(np.isnan(stack), -np.inf, stack), 0)
            out[np.isinf(out)] = np.nan
            return out
        return np.nanmean(stack, 0)


def _climatology(W, backs, half_width=0, cutoff_ok=None, min_years=3, q=None):
    """Same-time-of-year statistic of window values W from earlier years.
    backs: list of back-index arrays (k = 1..K). Returns mean (or quantiles q) per t x area."""
    T, R = W.shape
    vals, yrs = [], []
    for k, b in enumerate(backs, start=1):
        for d in range(-half_width, half_width + 1):
            idx = b + d
            ok = (b >= 0) & (idx >= 0) & (idx < T)
            v = np.full((T, R), np.nan)
            v[ok] = W[idx[ok]]
            vals.append(v)
            yrs.append(np.full((T, R), k))
    V = np.stack(vals)                    # (n, T, R)
    Y = np.stack(yrs)
    has = ~np.isnan(V)
    n_years = np.zeros((T, R))
    for k in range(1, len(backs) + 1):
        n_years += (has & (Y == k)).any(0)
    with np.errstate(all='ignore'):
        if q is None:
            out = np.nanmean(V, 0)
            out[n_years < min_years] = np.nan
            return out, n_years
        outs = []
        for qq in q:
            o = np.nanquantile(V, qq, axis=0)
            o[n_years < min_years] = np.nan
            outs.append(o)
        return outs, n_years


# ----------------------------------------------------------------------------- main builder
def build_features(cases: pd.DataFrame, env: pd.DataFrame | None = None, adjacency: pd.DataFrame | None = None,
                   case_lag: int | None = None, env_lag: int | None = None, cutoff_t: int | None = None):
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', RuntimeWarning)
        return _build(cases, env, adjacency, case_lag, env_lag, cutoff_t)


def _build(cases, env, adjacency, case_lag, env_lag, cutoff_t):
    """Return the modelling table. If cutoff_t is given, data after the as-of cut-off of issue week
    cutoff_t are deleted first (used by the leakage test)."""
    cfg = load_config()
    fc = cfg['forecast']
    L = fc['case_lag_weeks'] if case_lag is None else case_lag
    E = fc['env_lag_weeks'] if env_lag is None else env_lag
    hw, miny = fc['endemic']['window_half_width'], fc['endemic']['min_years']
    qE, qH = fc['endemic']['elevated_q'], fc['endemic']['high_q']
    areas = rdhs_list()

    cal = cases[['t', 'week_start', 'year', 'week']].drop_duplicates('t').sort_values('t').reset_index(drop=True)
    cal['week_start'] = pd.to_datetime(cal['week_start'])
    T, R = len(cal), len(areas)
    C = cases.pivot_table(index='t', columns='rdhs', values='cases', dropna=False).reindex(
        index=range(T), columns=areas).values.astype(float)

    def env_mat(col):
        if env is None or col not in env:
            return np.full((T, R), np.nan)
        e = env[['rdhs', 'week_start', col]].merge(cal[['t', 'week_start']], on='week_start')
        return np.array(e.pivot_table(index='t', columns='rdhs', values=col).reindex(index=range(T), columns=areas).values,
                        dtype=float)

    rain, soil = env_mat('rain_mm'), env_mat('soil_m3m3')
    pfl, lfl = env_mat('paddy_flood'), env_mat('land_flood')
    fcst, river = env_mat('rain_fcst_7d'), env_mat('river_max')
    # radar passes every 6-12 days: carry a weekly value forward by at most one week
    for M in (pfl, lfl):
        orig = M.copy()
        miss = np.isnan(M[1:])
        M[1:][miss] = orig[:-1][miss]

    if cutoff_t is not None:            # leakage test: delete everything not yet available
        C[cutoff_t - L + 1:] = np.nan
        for M in (rain, soil, pfl, lfl, river):
            M[cutoff_t - E + 1:] = np.nan
        fcst[cutoff_t + 1:] = np.nan

    backs = [_back_index(cal.week_start, k) for k in range(1, 25)]
    nref = fc['endemic'].get('reference_years')
    ref_backs = backs[:nref] if nref else backs
    out = {}

    # ---- targets (never used as features)
    tot3, tot2 = _window_sum(C, 3), _window_sum(C, 2)
    out['y35'] = _shift(tot3, -3)
    out['y12'] = _shift(tot2, -1)

    # ---- endemic channel thresholds, from earlier years only
    def thresholds(W, start_off):
        (pe, ph), ny = _climatology(_shift(W, -start_off), ref_backs, hw, min_years=min(miny, len(ref_backs)),
                                    q=[qE, qH])
        return pe, ph, ny
    out['thrE35'], out['thrH35'], ny35 = thresholds(tot3, 3)
    out['thrE12'], out['thrH12'], _ = thresholds(tot2, 1)
    out['n_ref_years'] = ny35
    # level for the most recent 3 weeks (t-2..t), used with the nowcast in the Warning rule
    out['thrE_now'], _, _ = thresholds(tot3, -2)

    # ---- case history (known up to t-L)
    Cl = _shift(C, L)                                  # value of the latest published week
    out['c_last1'] = Cl
    for k in range(10):                                # weekly published counts, newest first
        out[f'c_l{k}'] = _shift(C, L + k)
    # Farrington-style upper limit for the latest published week (2/3-power transform,
    # same week +/-3 in the last 5 years); used by detector C
    C23 = np.power(np.clip(C, 0, None), 2 / 3)
    Cl23 = _shift(C23, L)
    vals = []
    for b in backs[:5]:
        for d in range(-3, 4):
            idx = b - L + d
            v = np.full((T, R), np.nan)
            okb = (b >= 0) & (idx >= 0)
            v[okb] = C23[idx[okb]]
            vals.append(v)
    V = np.stack(vals)
    with np.errstate(all='ignore'):
        mu23, sd23 = np.nanmean(V, 0), np.nanstd(V, 0)
    out['farr_upper'] = np.power(mu23 + 2.58 * np.maximum(sd23, 0.5), 1.5)
    del Cl23
    for n in (2, 4, 8, 13):
        out[f'c_last{n}'] = _trailing(C, L, n, 'sum')
    with np.errstate(all='ignore'):
        out['c_trend4'] = np.log1p(out['c_last4']) - np.log1p(_trailing(C, L + 4, 4, 'sum'))
    b0 = np.full((T, R), np.nan)
    ok = backs[0] >= 0
    b0[ok] = _shift(tot3, -3)[backs[0][ok]]
    out['b0_same_window_last_year'] = b0
    out['b1_clim_mean'], _ = _climatology(_shift(tot3, -3), backs, 0, min_years=2)
    out['scale_3y'] = _trailing(C, L, 156, 'mean') * 3          # typical 3-week total, last 3 years
    # seasonal ratio: recent level vs same weeks in previous years
    lastyear_same = np.full((T, R), np.nan)
    c4 = _trailing(C, L, 4, 'sum')
    lastyear_same[ok] = c4[backs[0][ok]]
    with np.errstate(all='ignore'):
        out['c_ratio_vs_last_year'] = np.log1p(c4) - np.log1p(lastyear_same)

    # ---- nowcast of the weeks not yet published (t-L+1 .. t): last year's same weeks x shrunk ratio
    unpub = _trailing(C, 0, max(L, 1), 'sum')                   # (only used through backs below)
    ly_unpub = np.full((T, R), np.nan)
    ly_unpub[ok] = unpub[backs[0][ok]]
    with np.errstate(all='ignore'):
        ratio = np.exp(0.5 * np.clip(out['c_ratio_vs_last_year'], -3, 3))
    out['nowcast_unpublished'] = ly_unpub * np.nan_to_num(ratio, nan=1.0)
    ly_now3 = np.full((T, R), np.nan)
    ly_now3[ok] = _trailing(C, 0, 3, 'sum')[backs[0][ok]]
    out['nowcast_last3'] = ly_now3 * np.nan_to_num(ratio, nan=1.0)

    # ---- environment (known up to t-E)
    def lags(M, n, name, transform=None):
        for k in range(n):
            v = _shift(M, E + k)
            out[f'{name}_l{k}'] = transform(v) if transform else v
    lags(rain, 12, 'rain', np.log1p)
    lags(soil, 8, 'soil')
    lags(pfl, 8, 'pflood')
    lags(lfl, 4, 'lflood')
    for n in (2, 4, 8, 12):
        out[f'rain_{n}w'] = _trailing(rain, E, n, 'sum')
    out['soil_4w'] = _trailing(soil, E, 4, 'mean')
    out['pflood_max2w'] = _trailing(pfl, E, 2, 'max')
    out['pflood_max4w'] = _trailing(pfl, E, 4, 'max')
    out['pflood_max8w'] = _trailing(pfl, E, 8, 'max')
    out['lflood_max4w'] = _trailing(lfl, E, 4, 'max')
    out['river_max4w'] = _trailing(river, E, 4, 'max')
    out['rain_fcst_7d'] = fcst
    # anomalies against the same weeks in earlier years
    for col, W in (('rain_4w', out['rain_4w']), ('rain_12w', out['rain_12w']), ('soil_4w', out['soil_4w']),
                   ('pflood_max4w', out['pflood_max4w']), ('pflood_max2w', out['pflood_max2w']),
                   ('lflood_max4w', out['lflood_max4w']), ('river_max4w', out['river_max4w'])):
        clim, _ = _climatology(W, backs, 1, min_years=2)
        with np.errstate(all='ignore'):
            if col.startswith(('pflood', 'lflood')):
                out[f'{col}_ratio'] = (W + 0.002) / (clim + 0.002)
            else:
                out[f'{col}_anom'] = W - clim

    # ---- neighbours (mean over adjacent areas)
    if adjacency is not None and len(adjacency):
        A = np.zeros((R, R))
        pos = {a: i for i, a in enumerate(areas)}
        for a, b in adjacency[['a', 'b']].itertuples(index=False):
            if a in pos and b in pos:
                A[pos[a], pos[b]] = A[pos[b], pos[a]] = 1
        deg = A.sum(1)
        deg[deg == 0] = 1
        for name in ('c_ratio_vs_last_year', 'pflood_max4w_ratio', 'rain_4w_anom'):
            M = np.nan_to_num(out[name], nan=0.0)
            out[f'nb_{name}'] = (M @ A.T) / deg

    # ---- assemble long table
    tt, rr = np.meshgrid(np.arange(T), np.arange(R), indexing='ij')
    df = pd.DataFrame({'t': tt.ravel(), 'rdhs': np.array(areas)[rr.ravel()]})
    df = df.merge(cal.rename(columns={'week_start': 'issue_start'}), on='t')
    for k, v in out.items():
        df[k] = v.ravel()
    woy = df.issue_start.dt.dayofyear / 365.25
    for h in (1, 2):
        df[f'sin{h}'] = np.sin(2 * np.pi * h * woy)
        df[f'cos{h}'] = np.cos(2 * np.pi * h * woy)
    m = df.issue_start.dt.month
    df['cultivation_window'] = m.isin([4, 5, 10, 11, 12]).astype(int)
    df['surgeE'] = np.where(df.y35.notna() & df.thrE35.notna(), (df.y35 > df.thrE35).astype(float), np.nan)
    df['surgeH'] = np.where(df.y35.notna() & df.thrH35.notna(), (df.y35 > df.thrH35).astype(float), np.nan)
    df['surgeE12'] = np.where(df.y12.notna() & df.thrE12.notna(), (df.y12 > df.thrE12).astype(float), np.nan)
    df['flood_available'] = df.pflood_max4w.notna().astype(int)
    df['rdhs_code'] = df.rdhs.map({a: i for i, a in enumerate(areas)})
    return df


TARGET_COLS = ['y35', 'y12', 'surgeE', 'surgeH', 'surgeE12']
ID_COLS = ['t', 'rdhs', 'issue_start', 'year', 'week', 'rdhs_code']


def feature_groups(df: pd.DataFrame) -> dict:
    """Named groups used by the models and the ablation."""
    cols = [c for c in df.columns if c not in TARGET_COLS + ID_COLS]
    g = {
        'case': [c for c in cols if c.startswith(('c_', 'b0_', 'b1_', 'scale_', 'nowcast_', 'nb_c_', 'farr_'))],
        'season': ['sin1', 'cos1', 'sin2', 'cos2', 'cultivation_window'],
        'rain': [c for c in cols if c.startswith(('rain_', 'nb_rain')) and c != 'rain_fcst_7d'],
        'rain_fcst': ['rain_fcst_7d'],
        'soil': [c for c in cols if c.startswith('soil')],
        'flood': [c for c in cols if c.startswith(('pflood', 'lflood', 'nb_pflood')) or c == 'flood_available'],
        'river': [c for c in cols if c.startswith('river')],
        'thresholds': ['thrE35', 'thrH35', 'n_ref_years'],
    }
    return g


def main():
    from leptowatch.data.cases import build_cases  # noqa: F401  (documentation pointer)
    cases = io.load(path('processed', 'cases_weekly.csv'))
    envp = path('processed', 'env_weekly.csv')
    env = io.load(envp) if envp.exists() else None
    adjp = path('raw', 'boundaries', 'rdhs_adjacency.csv')
    adj = pd.read_csv(adjp) if adjp.exists() else None
    df = build_features(cases, env, adj)
    p = io.save(df, path('processed', 'features.parquet'))
    info = {'rows': len(df), 'issue_weeks': int(df.t.nunique()), 'columns': len(df.columns),
            'rows_with_target': int(df.y35.notna().sum()), 'surgeE_rate': round(float(df.surgeE.mean()), 3),
            'surgeH_rate': round(float(df.surgeH.mean()), 3), 'env_used': env is not None,
            'adjacency_used': adj is not None}
    print(json.dumps(info, indent=1))
    print('saved', p)


if __name__ == '__main__':
    main()
