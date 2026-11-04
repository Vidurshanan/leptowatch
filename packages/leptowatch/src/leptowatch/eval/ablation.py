"""H1, the core claim: does the radar flood signal improve forecasts beyond rainfall and cases?

Detectors A and B are each trained with and without the flood inputs, on exactly the same rows
and weeks (the satellite era), through the same rolling-origin backtest. The difference in error,
with a 95% confidence interval from resampling whole seasons, is the test of H1. Further rows
test soil moisture, river flow and forecast rainfall the same way.

Run:  python -m leptowatch.eval.ablation
Out:  reports/ablation.json, reports/figures/ablation.png
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd

from leptowatch import io
from leptowatch.config import load_config, path
from leptowatch.eval import metrics as M
from leptowatch.eval.backtest import run_backtest
from leptowatch.features.build import feature_groups
from leptowatch.models import detectors as D


def variants(df, tuned=None):
    tuned = tuned or {}
    g = feature_groups(df)
    sat_from = f"{load_config()['evaluation']['satellite_first_year']}-01-01"
    pa = tuned.get('A', {})
    pb = tuned.get('B')
    return {
        'A_full': lambda: D.DetectorA(train_from=sat_from, **pa),
        'A_no_flood': lambda: D.DetectorA(train_from=sat_from, use_flood=False, **pa),
        'A_no_soil': lambda: D.DetectorA(train_from=sat_from, use_soil=False, **pa),
        'B_full': lambda: D.DetectorB(params=pb, heads=('count', 'clf')),
        'B_no_flood': lambda: D.DetectorB(params=pb, heads=('count', 'clf'), drop=g['flood']),
        'B_no_soil': lambda: D.DetectorB(params=pb, heads=('count', 'clf'), drop=g['soil']),
        'B_no_river_fcst': lambda: D.DetectorB(params=pb, heads=('count', 'clf'), drop=g['river'] + g['rain_fcst']),
    }


def run(df=None):
    df = df if df is not None else io.load(path('processed', 'features.parquet'))
    tp = path('models', 'tuned_params.json')
    tuned = json.loads(tp.read_text()) if tp.exists() else {}
    first = load_config()['evaluation']['satellite_eval_from']
    if df.pflood_max4w.notna().sum() == 0:
        raise SystemExit('No flood data in the feature table: export the flood series first (notebook 04).')
    preds, _ = run_backtest(df, variants(df, tuned), first_year=first, refit_every=26)
    res = {}
    for fam in ('A', 'B'):
        full = preds[f'{fam}_full']
        full = full[full.y35.notna()]
        for name in [k for k in preds if k.startswith(fam + '_') and k != f'{fam}_full']:
            alt = preds[name]
            alt = alt[alt.y35.notna()]
            mae_d = M.season_bootstrap_diff(alt, full, 'year', lambda x: M.mae(x.y35, x.mu))
            e1, e2 = full[full.surgeE.notna()], alt[alt.surgeE.notna()]

            def prauc(x):
                return M.prob_scores(x.surgeE, x.pE).get('pr_auc', np.nan)
            pr_d = M.season_bootstrap_diff(e1, e2, 'year', prauc)
            res[f'{fam}: full vs {name.split("_", 1)[1]}'] = {
                'MAE_without_minus_with': mae_d, 'PRAUC_with_minus_without': pr_d,
                'interpretation': ('inputs help' if mae_d['ci95'][0] > 0 else
                                   'no clear gain' if mae_d['ci95'][1] >= 0 else 'inputs hurt')}
    path('reports', 'ablation.json').write_text(json.dumps(res, indent=1))
    plot(res)
    print(json.dumps(res, indent=1))
    return res


def plot(res):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    names = list(res)
    est = [res[n]['MAE_without_minus_with']['estimate'] for n in names]
    lo = [res[n]['MAE_without_minus_with']['ci95'][0] for n in names]
    hi = [res[n]['MAE_without_minus_with']['ci95'][1] for n in names]
    fig, ax = plt.subplots(figsize=(7, 0.6 * len(names) + 1.2))
    y = np.arange(len(names))
    ax.errorbar(est, y, xerr=[np.subtract(est, lo), np.subtract(hi, est)], fmt='o', capsize=4)
    ax.axvline(0, c='grey', ls='--')
    ax.set_yticks(y)
    ax.set_yticklabels(names)
    ax.set_xlabel('MAE without the input minus MAE with it (cases; > 0 means the input helps)')
    fig.tight_layout()
    fig.savefig(path('reports', 'figures', 'ablation.png'), dpi=130)
    plt.close(fig)


if __name__ == '__main__':
    run()
