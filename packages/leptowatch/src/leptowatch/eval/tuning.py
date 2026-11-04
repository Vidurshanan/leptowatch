"""Hyperparameter tuning with leave-one-season-out cross-validation (with a buffer).

Folds: each pre-test year Y in turn is the validation season. Training uses all other pre-test
rows except those within `tuning_gap_weeks` of Y (so neighbouring weeks cannot leak). This is
used ONLY to choose hyperparameters; reported performance always comes from the rolling-origin
backtest, which never trains on the future.

  detector B (LightGBM)  Optuna TPE search (pip install optuna) - or a built-in random search
                         with the same budget if Optuna is missing. Objective = mean over folds of
                         (Poisson deviance / B1 deviance) + (log loss / climatology log loss).
  detector A (NB GLM)    small grid over ridge x lag_df, objective = mean validation deviance.

Run:  python -m leptowatch.eval.tuning --folds 6 --trials 40
Out:  models/tuned_params.json, reports/tuning_history_B.csv, reports/figures/tuning_B.png
"""
from __future__ import annotations

import argparse
import json
import time

import numpy as np
import pandas as pd

from leptowatch import io
from leptowatch.config import load_config, path
from leptowatch.eval.doctor import _dev, _logloss
from leptowatch.models import detectors as D


def folds(df, n_folds=6):
    cfg = load_config()
    lock = pd.Timestamp(cfg['evaluation']['locked_test_from'])
    gap = cfg['evaluation']['tuning_gap_weeks']
    pre = df[(df.issue_start < lock) & (df.year < lock.year) & df.y35.notna() & (df.year >= cfg['evaluation']['first_eval_year'] - 3)]
    years = sorted(pre.year.unique())[-n_folds:]
    out = []
    for y in years:
        va = pre[pre.year == y]
        lo, hi = va.t.min() - gap - 5, va.t.max() + gap
        tr = pre[(pre.t < lo) | (pre.t > hi)]
        out.append((y, tr, va))
    return out


def _score_B(params, fl):
    scores = []
    for y, tr, va in fl:
        m = D.DetectorB(params=params, heads=('count', 'clf')).fit(tr)
        p = m.predict(va)
        b1 = D.B1().fit(tr).predict(va)
        dev = _dev(va.y35, p.mu) / max(_dev(va.y35, b1.mu), 1e-9)
        e = va.surgeE.notna()
        base = va.loc[e, 'surgeE'].mean()
        ll = _logloss(va.loc[e, 'surgeE'], p.loc[e, 'pE']) / max(_logloss(va.loc[e, 'surgeE'], np.full(e.sum(), base)), 1e-9)
        scores.append(dev + ll)
    return float(np.mean(scores))


SPACE = {
    'num_leaves': ('int', 4, 63), 'min_child_samples': ('int', 10, 200), 'learning_rate': ('logfloat', 0.01, 0.15),
    'feature_fraction': ('float', 0.5, 1.0), 'bagging_fraction': ('float', 0.5, 1.0),
    'lambda_l2': ('logfloat', 1e-3, 30.0), 'max_depth': ('int', 3, 10),
}


def tune_B(df, n_folds=6, n_trials=40, timeout_min=30, seed=42):
    fl = folds(df, n_folds)
    hist = []
    t_end = time.time() + 60 * timeout_min
    try:
        import optuna
        optuna.logging.set_verbosity(optuna.logging.WARNING)

        def objective(trial):
            p = {}
            for k, (kind, lo, hi) in SPACE.items():
                if kind == 'int':
                    p[k] = trial.suggest_int(k, lo, hi)
                elif kind == 'logfloat':
                    p[k] = trial.suggest_float(k, lo, hi, log=True)
                else:
                    p[k] = trial.suggest_float(k, lo, hi)
            s = _score_B(p, fl)
            hist.append({**p, 'score': s})
            return s
        study = optuna.create_study(direction='minimize', sampler=optuna.samplers.TPESampler(seed=seed))
        study.enqueue_trial({k: v for k, v in load_config()['models']['lgbm'].items() if k in SPACE and v != -1}
                            | {'max_depth': 6})
        study.optimize(objective, n_trials=n_trials, timeout=60 * timeout_min)
        best, engine = study.best_params, 'optuna-TPE'
        try:
            imp = optuna.importance.get_param_importances(study)
        except Exception:  # noqa: BLE001
            imp = {}
    except ImportError:
        rng = np.random.default_rng(seed)
        engine, imp = 'random-search (install optuna for TPE)', {}
        default = {k: v for k, v in load_config()['models']['lgbm'].items() if k in SPACE and v != -1} | {'max_depth': 6}
        cands = [default]
        for _ in range(n_trials - 1):
            p = {}
            for k, (kind, lo, hi) in SPACE.items():
                if kind == 'int':
                    p[k] = int(rng.integers(lo, hi + 1))
                elif kind == 'logfloat':
                    p[k] = float(np.exp(rng.uniform(np.log(lo), np.log(hi))))
                else:
                    p[k] = float(rng.uniform(lo, hi))
            cands.append(p)
        for p in cands:
            if time.time() > t_end:
                break
            hist.append({**p, 'score': _score_B(p, fl)})
            print(f'  trial {len(hist)}: score {hist[-1]["score"]:.4f}')
        best = min(hist, key=lambda h: h['score'])
        best = {k: v for k, v in best.items() if k != 'score'}
    h = pd.DataFrame(hist)
    return best, h, engine, imp


def tune_A(df, n_folds=4, ridges=(0.3, 1, 3, 10, 30), lag_dfs=(3, 4, 5)):
    fl = folds(df, n_folds)
    rows = []
    for rg in ridges:
        for ld in lag_dfs:
            devs = [_dev(va.y35, D.DetectorA(ridge=rg, lag_df=ld).fit(tr).predict(va).mu) for _, tr, va in fl]
            rows.append({'ridge': rg, 'lag_df': ld, 'score': float(np.mean(devs))})
            print(f'  A ridge={rg} lag_df={ld}: {rows[-1]["score"]:.4f}')
    r = pd.DataFrame(rows)
    b = r.loc[r.score.idxmin()]
    return {'ridge': float(b.ridge), 'lag_df': int(b.lag_df)}, r


def plot_history(h, out):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(6, 3.4))
    ax.plot(range(1, len(h) + 1), h.score, 'o', alpha=0.5, label='trial')
    ax.plot(range(1, len(h) + 1), h.score.cummin(), '-', label='best so far')
    ax.set_xlabel('trial')
    ax.set_ylabel('CV objective (lower is better)')
    ax.legend()
    fig.tight_layout()
    fig.savefig(out, dpi=130)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--folds', type=int, default=6)
    ap.add_argument('--trials', type=int, default=load_config()['models']['tuning']['n_trials'])
    ap.add_argument('--timeout', type=int, default=load_config()['models']['tuning']['timeout_minutes'])
    ap.add_argument('--skip-A', action='store_true')
    a = ap.parse_args()
    df = io.load(path('processed', 'features.parquet'))
    best_B, hist, engine, imp = tune_B(df, a.folds, a.trials, a.timeout)
    hist.to_csv(path('reports', 'tuning_history_B.csv'), index=False)
    plot_history(hist, path('reports', 'figures', 'tuning_B.png'))
    out = {'B': best_B, 'engine': engine, 'param_importance': imp}
    if not a.skip_A:
        best_A, gridA = tune_A(df)
        gridA.to_csv(path('reports', 'tuning_grid_A.csv'), index=False)
        out['A'] = best_A
    path('models', 'tuned_params.json').write_text(json.dumps(out, indent=1, default=float))
    print(json.dumps(out, indent=1, default=float))


if __name__ == '__main__':
    main()
