"""The ordered alert rules (proposal Section 6). Detectors only propose; this decides.

  1. Data check first   inputs too old -> "Unverified - treat as Elevated" (shown at Watch or above),
                        and the team gets a system alert. Higher tiers need fresh inputs.
  2. Warning            P(High) >= tau_warning (tuned for precision), OR post-flood trigger active
                        while the nowcast is already above the Elevated level and P(Elevated) >= tau_advisory.
                        A flood or a rule on its own never produces a Warning.
  3. Advisory           P(Elevated) >= tau_advisory (maximises F2 among thresholds whose precision is at least
                        advisory_min_lift x the base rate, so Advisory is never just "alert everyone").
  4. Watch              P(Elevated) >= tau_watch (set to catch >= 90% of surge weeks),
                        OR detector C (rule layer) OR detector D (post-flood trigger) fires.
The first condition met, from Warning down, sets the tier. Every alert names the rule that fired.

Thresholds are tuned once on the pre-test backtest (tune_thresholds) and frozen in
models/alert_thresholds.json before the locked test.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd

from leptowatch.config import load_config, path
from leptowatch.eval.metrics import threshold_table

TIERS = ['None', 'Watch', 'Advisory', 'Warning']


def tune_thresholds(oof: pd.DataFrame) -> dict:
    """oof: blended OOF with pE, pH, surgeE, surgeH (pre-test years only!)."""
    a = load_config()['alerts']
    e = oof[oof.surgeE.notna() & oof.pE.notna()]
    h = oof[oof.surgeH.notna() & oof.pH.notna()]
    te = threshold_table(e.surgeE, e.pE, beta=a['advisory_beta'])
    th = threshold_table(h.surgeH, h.pH, beta=0.5)
    ok = te[te.recall >= a['watch_target_recall']]
    tau_watch = float(ok.threshold.max()) if len(ok) else float(te.threshold.min())
    fcol = f"f{a['advisory_beta']:g}"
    base = float(e.surgeE.mean())
    # Advisory must be clearly better than "alert everyone": precision >= lift x base rate
    cand = te[(te.precision >= a.get('advisory_min_lift', 1.2) * base) & (te.threshold > tau_watch)]
    tau_adv = float(cand.loc[cand[fcol].idxmax(), 'threshold']) if len(cand) else \
        float(te.loc[te[fcol].idxmax(), 'threshold'])
    tau_adv = max(tau_adv, tau_watch)
    okp = th[(th.precision >= a['warning_target_precision']) & (th.recall > 0)]
    tau_warn = float(okp.threshold.min()) if len(okp) else float(th.loc[th['f0.5'].idxmax(), 'threshold'])
    out = {'base_rate': round(base, 3), 'tau_watch': round(tau_watch, 3), 'tau_advisory': round(tau_adv, 3), 'tau_warning': round(tau_warn, 3),
           'tuned_on_rows': int(len(e)), 'tuned_on_years': [int(e.year.min()), int(e.year.max())],
           'watch_recall_at_tau': round(float(te.loc[te.threshold == tau_watch, 'recall'].iloc[0]), 3),
           'advisory_f2_at_tau': round(float(te.loc[te.threshold == tau_adv, fcol].iloc[0]), 3),
           'warning_precision_at_tau': round(float(th.loc[th.threshold == tau_warn, 'precision'].iloc[0]), 3)}
    return out


def save_thresholds(th: dict):
    p = path('models', 'alert_thresholds.json')
    p.write_text(json.dumps(th, indent=1))
    return p


def load_thresholds() -> dict:
    return json.loads(path('models', 'alert_thresholds.json').read_text())


def decide(row, th, data_ok=True):
    """Tier and the rule that fired for one area-week. row needs pE, pH, C_fire, D_fire,
    nowcast_last3, thrE_now."""
    pE, pH = row.get('pE', np.nan), row.get('pH', np.nan)
    c_fire, d_fire = bool(row.get('C_fire', 0)), bool(row.get('D_fire', 0))
    if not data_ok:
        return 'Watch', 'Unverified: input too old - treat as Elevated'
    now_above = (row.get('nowcast_last3', np.nan) > row.get('thrE_now', np.inf))
    if pH >= th['tau_warning']:
        return 'Warning', f'Warning: P(High surge) = {pH:.2f} >= {th["tau_warning"]}'
    if d_fire and now_above and pE >= th['tau_advisory']:
        return 'Warning', 'Warning: post-flood trigger + nowcast above Elevated + P(Elevated) high'
    if pE >= th['tau_advisory']:
        return 'Advisory', f'Advisory: P(Elevated surge) = {pE:.2f} >= {th["tau_advisory"]}'
    if pE >= th['tau_watch']:
        return 'Watch', f'Watch: P(Elevated surge) = {pE:.2f} >= {th["tau_watch"]}'
    if c_fire:
        return 'Watch', 'Watch: rule layer (cases above recent and seasonal limits)'
    if d_fire:
        return 'Watch', 'Watch: post-flood trigger (paddy wetness far above usual)'
    return 'None', ''


def apply_rules(df: pd.DataFrame, th: dict, data_ok_col: str | None = None) -> pd.DataFrame:
    out = df.copy()
    res = [decide(r, th, bool(r[data_ok_col]) if data_ok_col else True) for r in out.to_dict('records')]
    out['tier'] = [r[0] for r in res]
    out['rule'] = [r[1] for r in res]
    out['unverified'] = out.rule.str.startswith('Unverified')
    out['tier_rank'] = out.tier.map({t: i for i, t in enumerate(TIERS)})
    return out


def alert_performance(al: pd.DataFrame) -> dict:
    """Recall and burden of each tier (and of each detector alone) against Elevated surges."""
    d = al[al.surgeE.notna()].copy()
    n_area_years = d.groupby('rdhs').year.nunique().sum()
    out = {}
    for name, mask in {'Watch+': d.tier_rank >= 1, 'Advisory+': d.tier_rank >= 2, 'Warning': d.tier_rank >= 3,
                       'C alone': d.get('C_fire', 0) == 1, 'D alone': d.get('D_fire', 0) == 1}.items():
        mask = pd.Series(mask, index=d.index).astype(bool)
        tp = int((mask & (d.surgeE == 1)).sum())
        fp = int((mask & (d.surgeE == 0)).sum())
        fn = int((~mask & (d.surgeE == 1)).sum())
        out[name] = {'recall': round(tp / max(tp + fn, 1), 3), 'precision': round(tp / max(tp + fp, 1), 3),
                     'alerts_per_area_year': round(float(mask.sum()) / max(n_area_years, 1), 1)}
    # episode view: a surge episode = run of consecutive surge issue weeks in one area
    d = d.sort_values(['rdhs', 't'])
    d['start'] = (d.surgeE == 1) & (d.groupby('rdhs').surgeE.shift(fill_value=0) == 0)
    starts = d[d.start]
    caught = []
    for _, s in starts.iterrows():
        prev = d[(d.rdhs == s.rdhs) & (d.t >= s.t - 2) & (d.t <= s.t)]
        caught.append(bool((prev.tier_rank >= 1).any()))
    out['episodes'] = {'n': int(len(starts)), 'caught_at_or_before_onset': round(float(np.mean(caught)), 3) if caught else None}
    return out
