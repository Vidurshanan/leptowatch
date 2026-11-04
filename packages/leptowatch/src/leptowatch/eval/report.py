"""Evaluation report: scores for every model, alert thresholds, alert performance and figures.

Run after backtest + blend:
    python -m leptowatch.eval.report            # pre-test years (tunes and freezes alert thresholds)
    python -m leptowatch.eval.report --final    # locked test (uses the frozen thresholds)
Out: reports/results[_final].json, reports/results[_final].md, reports/figures/*.png
"""
from __future__ import annotations

import argparse
import json

import numpy as np
import pandas as pd

from leptowatch import io
from leptowatch.alerts import engine
from leptowatch.config import path
from leptowatch.eval import metrics as M
from leptowatch.models.common import qcol

MODELS = ['B0', 'B1', 'B2', 'A', 'B', 'blend']


def _load(name, final):
    p = path('processed', f'oof_{name}{"_final" if final else ""}.parquet')
    return io.load(p) if p.exists() or p.with_suffix('.csv').exists() else None


def score_table(final=False):
    rows = {}
    for n in MODELS:
        o = _load(n, final)
        if o is None:
            continue
        o = o[o.y35.notna()]
        s = M.count_scores(o)
        if 'lo' in o:
            s['coverage80_conformal'] = round(float(((o.y35 >= o.lo) & (o.y35 <= o.hi)).mean()), 3)
        if 'lo_aci' in o:
            s['coverage80_aci'] = round(float(((o.y35 >= o.lo_aci) & (o.y35 <= o.hi_aci)).mean()), 3)
        for lab, col in (('surgeE', 'pE'), ('surgeH', 'pH')):
            e = o[o[lab].notna() & o[col].notna()]
            s[lab] = M.prob_scores(e[lab], e[col])
        rows[n] = s
    ref = rows.get('B0', {}).get('mae')
    for n, s in rows.items():
        if ref:
            s['mae_skill_vs_B0'] = round(1 - s['mae'] / ref, 3)
    return rows


def figures(final=False):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from sklearn.metrics import precision_recall_curve
    sfx = '_final' if final else ''
    fig, ax = plt.subplots(figsize=(5, 4))
    for n in MODELS:
        o = _load(n, final)
        if o is None:
            continue
        e = o[o.surgeE.notna() & o.pE.notna()]
        if e.surgeE.nunique() < 2:
            continue
        p, r, _ = precision_recall_curve(e.surgeE, e.pE)
        ax.plot(r, p, label=n)
    ax.set_xlabel('recall (share of surge weeks caught)')
    ax.set_ylabel('precision')
    ax.set_title('Elevated surge, weeks +3 to +5')
    ax.legend()
    fig.tight_layout()
    fig.savefig(path('reports', 'figures', f'pr_curves{sfx}.png'), dpi=130)
    plt.close(fig)

    bl = _load('blend', final)
    if bl is None:
        return
    # F1 / F2 analysis: how precision, recall and F-scores move with the alert threshold
    e = bl[bl.surgeE.notna() & bl.pE.notna()]
    tt = M.threshold_table(e.surgeE, e.pE, beta=2.0)
    tt.to_csv(path('reports', f'threshold_table{sfx}.csv'), index=False)
    fig, ax = plt.subplots(figsize=(6.4, 3.6))
    for col, lab in (('precision', 'precision'), ('recall', 'recall'), ('f1', 'F1'), ('f2', 'F2')):
        ax.plot(tt.threshold, tt[col], label=lab)
    try:
        th = engine.load_thresholds()
        for k, c in (('tau_watch', '#d4ac0d'), ('tau_advisory', '#e67e22')):
            ax.axvline(th[k], ls='--', c=c, lw=1)
            ax.text(th[k], 1.02, k.split('_')[1], color=c, fontsize=8, ha='center')
    except Exception:  # noqa: BLE001
        pass
    ax.axhline(e.surgeE.mean(), c='grey', lw=0.8, ls=':')
    ax.set_xlabel('alert threshold on P(Elevated)')
    ax.set_ylim(0, 1.08)
    ax.legend(ncol=4, fontsize=8, loc='lower left')
    ax.set_title('F1 / F2 analysis (dotted line = base rate)')
    fig.tight_layout()
    fig.savefig(path('reports', 'figures', f'f_scores{sfx}.png'), dpi=130)
    plt.close(fig)
    for area in ['Kurunegala', 'Ratnapura']:
        g = bl[bl.rdhs == area].sort_values('issue_start')
        if g.empty:
            continue
        fig, ax = plt.subplots(figsize=(10, 3.2))
        x = g.issue_start + pd.Timedelta(weeks=3)
        ax.fill_between(x, g.lo, g.hi, alpha=0.25, label='80% interval (CQR)')
        ax.plot(x, g.mu, lw=1.2, label='forecast')
        ax.plot(x, g.y35, 'k.', ms=3, label='reported')
        ax.plot(x, g.thrE35, c='orange', lw=0.8, label='Elevated level')
        ax.set_title(f'{area}: cases in weeks +3 to +5, forecast vs reported')
        ax.legend(ncol=4, fontsize=8)
        fig.tight_layout()
        fig.savefig(path('reports', 'figures', f'fan_{area}{sfx}.png'), dpi=130)
        plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--final', action='store_true')
    a = ap.parse_args()
    res = {'scores': score_table(a.final)}
    bl = _load('blend', a.final)
    rules = path('processed', 'rules_CD.parquet')
    if bl is not None:
        if a.final:
            th = engine.load_thresholds()
        else:
            th = engine.tune_thresholds(bl[bl.year >= bl.year.min() + 2])
            engine.save_thresholds(th)
        res['alert_thresholds'] = th
        feats = io.load(path('processed', 'features.parquet'))[['t', 'rdhs', 'nowcast_last3', 'thrE_now']]
        x = bl.merge(feats, on=['t', 'rdhs'], how='left')
        if rules.exists() or rules.with_suffix('.csv').exists():
            x = x.merge(io.load(rules), on=['t', 'rdhs'], how='left')
        al = engine.apply_rules(x, th)
        io.save(al, path('processed', f'alerts_backtest{"_final" if a.final else ""}.parquet'))
        res['alert_performance'] = engine.alert_performance(al)
        e = bl[bl.surgeE.notna() & bl.pE.notna()]
        best = M.threshold_table(e.surgeE, e.pE).sort_values('f1', ascending=False).iloc[0]
        res['best_f1'] = {'threshold': float(best.threshold), 'f1': round(float(best.f1), 3),
                          'precision': round(float(best.precision), 3), 'recall': round(float(best.recall), 3)}
    figures(a.final)
    sfx = '_final' if a.final else ''
    path('reports', f'results{sfx}.json').write_text(json.dumps(res, indent=1, default=float))
    lines = ['# LeptoWatch evaluation' + (' - LOCKED TEST' if a.final else ' - backtest (pre-test years)'), '',
             '| model | MAE | WIS | 80% cover | PR-AUC (Elevated) | ROC-AUC | Brier skill |', '|---|---|---|---|---|---|---|']
    for n, s in res['scores'].items():
        e = s.get('surgeE', {})
        lines.append(f"| {n} | {s['mae']} | {s.get('wis', '')} | {s.get('coverage80_conformal', s.get('coverage80', ''))} | "
                     f"{e.get('pr_auc', '')} | {e.get('roc_auc', '')} | {e.get('brier_skill_vs_climatology', '')} |")
    if 'alert_performance' in res:
        lines += ['', '## Alerts', '```', json.dumps(res['alert_performance'], indent=1), '```']
    path('reports', f'results{sfx}.md').write_text('\n'.join(lines))
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
