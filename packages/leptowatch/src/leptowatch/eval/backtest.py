"""Rolling-origin, as-of backtest.

For each block of `refit_every_weeks` issue weeks starting at t0, every model is trained ONLY on
rows whose whole target window had been published by t0 (t + 5 <= t0 - case_lag), then predicts
the block. Moving t0 forward through time gives honest out-of-sample ("out-of-fold", OOF)
forecasts for every issue week - the same situation the system faces live.

The locked test period (config evaluation.locked_test_from onwards) is excluded unless
final=True, and the final run can only happen once (a lock file records it).

Run:  python -m leptowatch.eval.backtest --models B0 B1 B2 A B
      python -m leptowatch.eval.backtest --final        # ONCE, at the very end
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import time

import numpy as np
import pandas as pd

from leptowatch import io
from leptowatch.config import load_config, path
from leptowatch.models import detectors as D


def eval_rows(df, final=False, first_year=None):
    ev = load_config()['evaluation']
    lock = pd.Timestamp(ev['locked_test_from'])
    fy = first_year or ev['first_eval_year']
    in_test = (df.issue_start >= lock) | (df.year >= lock.year)     # epi-year 2025 week 1 starts 28 Dec 2024
    if final:
        return df[in_test]
    return df[(df.year >= fy) & ~in_test]


def run_backtest(df, factories: dict, final=False, first_year=None, refit_every=None, case_lag=None,
                 verbose=True):
    """factories: {name: callable returning a fresh model}. Returns {name: OOF prediction frame}."""
    cfg = load_config()
    L = cfg['forecast']['case_lag_weeks'] if case_lag is None else case_lag
    step = refit_every or cfg['evaluation']['refit_every_weeks']
    ev = eval_rows(df, final, first_year)
    ts = np.sort(ev.t.unique())
    blocks = [ts[i:i + step] for i in range(0, len(ts), step)]
    preds = {n: [] for n in factories}
    fit_log = []
    for bi, blk in enumerate(blocks):
        t0 = blk[0]
        train = df[(df.t + 5 <= t0 - L) & df.y35.notna()]
        rows = ev[ev.t.isin(blk)]
        for name, make in factories.items():
            tic = time.time()
            m = make().fit(train)
            p = m.predict(rows)
            p.insert(0, 'model', name)
            preds[name].append(pd.concat([rows[['t', 'rdhs', 'issue_start', 'year', 'y35', 'surgeE', 'surgeH',
                                                'thrE35', 'thrH35']], p], axis=1))
            fit_log.append({'block': bi, 't0': int(t0), 'model': name, 'n_train': len(train),
                            'seconds': round(time.time() - tic, 2),
                            'best_iter': getattr(m, 'best_iter_', {}).get('count') if hasattr(m, 'best_iter_') else None})
        if verbose and (bi % 8 == 0 or bi == len(blocks) - 1):
            print(f'  block {bi + 1}/{len(blocks)}  issue {rows.issue_start.min().date()}  train rows {len(train):,}')
    out = {n: pd.concat(v, ignore_index=True) for n, v in preds.items() if v}
    return out, pd.DataFrame(fit_log)


def rule_layers(df):
    """Detectors C and D need no fitting: compute their flags for every row."""
    c = D.DetectorC().predict(df).add_prefix('C_')
    d = D.DetectorD().predict(df).add_prefix('D_')
    return pd.concat([df[['t', 'rdhs']], c, d], axis=1)


def _lock_file():
    return path('reports', 'LOCKED_TEST_DONE.json')


def default_factories(tuned=None):
    tuned = tuned or {}
    return {
        'B0': D.B0, 'B1': D.B1, 'B2': D.B2,
        'A': lambda: D.DetectorA(**tuned.get('A', {})),
        'B': lambda: D.DetectorB(params=tuned.get('B')),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--models', nargs='+', default=['B0', 'B1', 'B2', 'A', 'B'])
    ap.add_argument('--final', action='store_true', help='run the locked test (once!)')
    ap.add_argument('--case-lag', type=int, default=None)
    ap.add_argument('--tag', default='')
    a = ap.parse_args()
    if a.final and _lock_file().exists():
        raise SystemExit(f'The locked test was already run: {_lock_file().read_text()}')
    df = io.load(path('processed', 'features.parquet'))
    tp = path('models', 'tuned_params.json')
    tuned = json.loads(tp.read_text()) if tp.exists() else {}
    fac = {k: v for k, v in default_factories(tuned).items() if k in a.models}
    preds, log = run_backtest(df, fac, final=a.final, case_lag=a.case_lag)
    suffix = ('_final' if a.final else '') + (f'_{a.tag}' if a.tag else '')
    for n, p in preds.items():
        io.save(p, path('processed', f'oof_{n}{suffix}.parquet'))
    io.save(rule_layers(df), path('processed', 'rules_CD.parquet'))
    log.to_csv(path('reports', f'backtest_fit_log{suffix}.csv'), index=False)
    if a.final:
        h = hashlib.sha256(b''.join(p.to_csv().encode() for p in preds.values())).hexdigest()
        _lock_file().write_text(json.dumps({'run_at': dt.datetime.now().isoformat(timespec='seconds'),
                                            'predictions_sha256': h}, indent=1))
        print('LOCKED TEST DONE. Predictions hash:', h)
    print('saved OOF predictions for', list(preds))


if __name__ == '__main__':
    main()
