"""The Model Doctor: diagnoses overfitting, underfitting, miscalibration and leakage.

Run after tuning and before trusting any result:
    python -m leptowatch.eval.doctor

It writes reports/doctor/doctor_report.md with a verdict per check and a prescription, plus
figures. Checks:
  1. Training curves (LightGBM): train vs validation loss by boosting round, best round, gap.
  2. Complexity sweep: num_leaves 3..63 -> where does validation stop improving?
  3. Learning curve: 2, 4, 6, 8, all years of training data -> does more data still help?
  4. Ridge path (detector A): penalty 0.01..100 -> under- or over-regularised?
  5. Calibration: reliability and expected calibration error of the OOF probabilities.
  6. Stability: skill year by year (a model that only works in one year is fragile).
  7. Leakage: the time-travel test (features rebuilt with the future deleted must be identical)
     and a scan for features suspiciously close to the target.

Verdict rules (written down before looking at results):
  OVERFITTING   validation loss / training loss > 1.25 at the chosen size, or validation gets
                worse while training keeps improving as complexity grows
  UNDERFITTING  best boosting round hits the cap, or skill over B1 < 2% with a small train/valid gap
  HEALTHY       otherwise
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd

from leptowatch import io
from leptowatch.config import load_config, path
from leptowatch.eval import metrics as M
from leptowatch.models import detectors as D


def _tuned():
    p = path('models', 'tuned_params.json')
    return json.loads(p.read_text()) if p.exists() else {}


def _split(df, val_year=None):
    cfg = load_config()
    L = cfg['forecast']['case_lag_weeks']
    lock = pd.Timestamp(cfg['evaluation']['locked_test_from'])
    pre = df[(df.issue_start < lock) & (df.year < lock.year) & df.y35.notna()]
    val_year = val_year or int(pre.year.max())
    t0 = pre.loc[pre.year == val_year, 't'].min()
    return pre[pre.t + 5 <= t0 - L], pre[pre.year == val_year], val_year


def _dev(y, mu):
    y, mu = np.asarray(y, float), np.clip(np.asarray(mu, float), 1e-6, None)
    with np.errstate(all='ignore'):
        t = np.where(y > 0, y * np.log(y / mu), 0.0) - (y - mu)
    return float(2 * np.mean(t))


def _logloss(y, p):
    y, p = np.asarray(y, float), np.clip(np.asarray(p, float), 1e-6, 1 - 1e-6)
    ok = ~np.isnan(y) & ~np.isnan(p)
    return float(-np.mean(y[ok] * np.log(p[ok]) + (1 - y[ok]) * np.log(1 - p[ok])))


def training_curves(tr, va, fig_dir):
    import matplotlib.pyplot as plt
    m = D.DetectorB(params=_tuned().get('B'), heads=('count', 'clf')).fit(pd.concat([tr, va]))
    res = {}
    fig, axes = plt.subplots(1, 2, figsize=(10, 3.6))
    for ax, head in zip(axes, ['count', 'surgeE']):
        ev = m.curves_.get(head, {})
        if not ev:
            continue
        metric = list(ev['train'].keys())[0]
        trc, vac = np.array(ev['train'][metric]), np.array(ev['valid'][metric])
        best = int(np.argmin(vac))
        cap = load_config()['models']['lgbm']['n_estimators']
        ratio = float(vac[best] / max(trc[best], 1e-9))
        res[head] = {'metric': metric, 'best_round': best + 1, 'train_at_best': round(float(trc[best]), 4),
                     'valid_at_best': round(float(vac[best]), 4), 'valid_over_train': round(ratio, 3),
                     'hit_cap': best + 1 >= cap - 1}
        ax.plot(trc, label='train')
        ax.plot(vac, label='validation')
        ax.axvline(best, ls='--', c='grey')
        ax.set_title(f'{head}: {metric}')
        ax.set_xlabel('boosting round')
        ax.legend()
    fig.tight_layout()
    fig.savefig(fig_dir / 'training_curves.png', dpi=130)
    plt.close(fig)
    return res


def complexity_sweep(tr, va, fig_dir, leaves=(3, 7, 15, 31, 63)):
    import matplotlib.pyplot as plt
    rows = []
    for nl in leaves:
        m = D.DetectorB(params={**(_tuned().get('B') or {}), 'num_leaves': nl, 'max_depth': -1}, heads=('count',)).fit(tr)
        rows.append({'num_leaves': nl, 'train_dev': _dev(tr.y35, m.models_['count'].predict(tr[m.cols_])),
                     'valid_dev': _dev(va.y35, m.models_['count'].predict(va[m.cols_]))})
    r = pd.DataFrame(rows)
    fig, ax = plt.subplots(figsize=(5, 3.4))
    ax.plot(r.num_leaves, r.train_dev, 'o-', label='train')
    ax.plot(r.num_leaves, r.valid_dev, 'o-', label='validation')
    ax.set_xscale('log', base=2)
    ax.set_xlabel('num_leaves (model complexity)')
    ax.set_ylabel('Poisson deviance')
    ax.legend()
    fig.tight_layout()
    fig.savefig(fig_dir / 'complexity_sweep.png', dpi=130)
    plt.close(fig)
    return r


def learning_curve(tr, va, fig_dir, years=(2, 4, 6, 8, 99)):
    import matplotlib.pyplot as plt
    rows = []
    last = tr.year.max()
    for k in years:
        sub = tr[tr.year > last - k]
        if sub.year.nunique() < 2:
            continue
        m = D.DetectorB(params=_tuned().get('B'), heads=('count',)).fit(sub)
        rows.append({'years': int(sub.year.nunique()), 'n': len(sub),
                     'train_dev': _dev(sub.y35, m.models_['count'].predict(sub[m.cols_])),
                     'valid_dev': _dev(va.y35, m.models_['count'].predict(va[m.cols_]))})
    r = pd.DataFrame(rows).drop_duplicates('years')
    fig, ax = plt.subplots(figsize=(5, 3.4))
    ax.plot(r.years, r.train_dev, 'o-', label='train')
    ax.plot(r.years, r.valid_dev, 'o-', label='validation')
    ax.set_xlabel('years of training data')
    ax.set_ylabel('Poisson deviance')
    ax.legend()
    fig.tight_layout()
    fig.savefig(fig_dir / 'learning_curve.png', dpi=130)
    plt.close(fig)
    return r


def ridge_path(tr, va, fig_dir, ridges=(0.1, 1, 10, 100, 1000)):
    import matplotlib.pyplot as plt
    rows = []
    for rg in ridges:
        m = D.DetectorA(**{**_tuned().get('A', {}), 'ridge': rg}).fit(tr)
        rows.append({'ridge': rg, 'train_dev': _dev(tr.y35, m.predict(tr).mu),
                     'valid_dev': _dev(va.y35, m.predict(va).mu)})
    r = pd.DataFrame(rows)
    fig, ax = plt.subplots(figsize=(5, 3.4))
    ax.plot(r.ridge, r.train_dev, 'o-', label='train')
    ax.plot(r.ridge, r.valid_dev, 'o-', label='validation')
    ax.set_xscale('log')
    ax.set_xlabel('ridge penalty (more = simpler)')
    ax.set_ylabel('Poisson deviance')
    ax.legend()
    fig.tight_layout()
    fig.savefig(fig_dir / 'ridge_path.png', dpi=130)
    plt.close(fig)
    return r


def calibration(oof, fig_dir):
    import matplotlib.pyplot as plt
    e = oof[oof.surgeE.notna() & oof.pE.notna()]
    rel = M.reliability(e.surgeE, e.pE)
    fig, ax = plt.subplots(figsize=(4, 4))
    ax.plot([0, 1], [0, 1], c='grey', ls='--')
    ax.plot(rel.p_mean, rel.observed, 'o-')
    ax.set_xlabel('forecast probability')
    ax.set_ylabel('observed frequency')
    ax.set_title('Reliability: Elevated surge')
    fig.tight_layout()
    fig.savefig(fig_dir / 'reliability.png', dpi=130)
    plt.close(fig)
    return {'ece': round(M.ece(e.surgeE, e.pE), 3), 'bins': rel.round(3).to_dict('records')}


def stability(oof, ref):
    """Yearly MAE skill of a model against a reference (e.g. B1)."""
    a = oof[oof.y35.notna()].merge(ref[['t', 'rdhs', 'mu']].rename(columns={'mu': 'mu_ref'}), on=['t', 'rdhs'])
    g = a.groupby('year').apply(lambda x: 1 - M.mae(x.y35, x.mu) / M.mae(x.y35, x.mu_ref), include_groups=False)
    return g.round(3).to_dict()


def leakage(cases, env, adj, feats, n_checks=6, seed=0):
    from leptowatch.features.build import build_features, TARGET_COLS
    rng = np.random.default_rng(seed)
    ts = feats.t[feats.year >= feats.year.min() + 6].unique()
    picks = rng.choice(ts, size=min(n_checks, len(ts)), replace=False)
    bad = {}
    fcols = [c for c in feats.columns if c not in TARGET_COLS + ['rdhs'] and not c.startswith(('thrE12', 'thrH12'))]
    for t in picks:
        cut = build_features(cases, env, adj, cutoff_t=int(t))
        a = feats[feats.t == t].set_index('rdhs')[fcols]
        b = cut[cut.t == t].set_index('rdhs')[fcols]
        num = a.select_dtypes('number').columns
        diff = (a[num] - b[num]).abs()
        both_nan = a[num].isna() & b[num].isna()
        mism = ((diff > 1e-9) | (a[num].isna() != b[num].isna())) & ~both_nan
        cols = mism.any()
        for c in cols[cols].index:
            bad.setdefault(c, []).append(int(t))
    num = feats.select_dtypes('number')
    corr = num.corrwith(feats.y35).abs().drop(labels=[c for c in TARGET_COLS if c in num], errors='ignore')
    suspicious = corr[corr > 0.97].round(3).to_dict()
    return {'time_travel_test': 'PASS' if not bad else 'FAIL', 'leaking_features': bad,
            'checked_issue_weeks': [int(x) for x in picks], 'suspiciously_close_to_target': suspicious}


def verdict(curves, sweep, lc, ridge, cal, skill):
    out, rx = [], []
    for head, c in curves.items():
        if c['hit_cap']:
            out.append(f'UNDERFITTING ({head}): best round hit the cap')
            rx.append('raise n_estimators or learning_rate; allow more leaves')
        elif c['valid_over_train'] > 1.25:
            out.append(f'OVERFITTING ({head}): validation/train loss = {c["valid_over_train"]}')
            rx.append('lower num_leaves, raise min_child_samples and lambda_l2, use feature_fraction 0.7')
    s = sweep.sort_values('num_leaves')
    best_nl = int(s.loc[s.valid_dev.idxmin(), 'num_leaves'])
    if s.valid_dev.iloc[-1] > s.valid_dev.min() * 1.02 and s.train_dev.iloc[-1] < s.train_dev.min() * 1.02:
        out.append(f'OVERFITTING beyond num_leaves={best_nl}: training keeps improving, validation does not')
        rx.append(f'keep num_leaves <= {best_nl}')
    if len(lc) >= 2 and lc.valid_dev.iloc[-1] < lc.valid_dev.iloc[-2] * 0.98:
        out.append('HIGH VARIANCE: validation still improving with more years -> more data helps')
        rx.append('use all years; pool districts; prefer simpler models')
    r = ridge.sort_values('ridge')
    best_r = float(r.loc[r.valid_dev.idxmin(), 'ridge'])
    if best_r == r.ridge.min():
        rx.append('detector A: best at the smallest ridge -> try ridge 0.001')
    if best_r == r.ridge.max():
        out.append('detector A: best at the largest ridge -> inputs add noise (possible overfitting)')
        rx.append('raise ridge further or drop weak input groups')
    if cal and cal['ece'] > 0.05:
        out.append(f'MISCALIBRATED: ECE = {cal["ece"]}')
        rx.append('calibrate on recent years only (models.calibration_years: 2-3): surge rates drift; '
                  'or use the 5-year endemic reference')
    if skill and np.nanmean(list(skill.values())) < 0.02:
        out.append('UNDERFITTING / NO SKILL: mean yearly skill over B1 below 2%')
        rx.append('add signal (environment, neighbours) rather than complexity')
    return (out or ['HEALTHY: no rule fired']), rx, best_nl, best_r


def run():
    import matplotlib
    matplotlib.use('Agg')
    fig_dir = path('reports', 'doctor', 'x').parent
    fig_dir.mkdir(parents=True, exist_ok=True)
    df = io.load(path('processed', 'features.parquet'))
    tr, va, vy = _split(df)
    print(f'doctor: train rows {len(tr):,}, validation year {vy} ({len(va):,} rows)')
    curves = training_curves(tr, va, fig_dir)
    sweep = complexity_sweep(tr, va, fig_dir)
    lc = learning_curve(tr, va, fig_dir)
    ridge = ridge_path(tr, va, fig_dir)
    cal, skill = None, None
    bp = path('processed', 'oof_blend.parquet')
    if io.exists(bp):
        oof = io.load(bp)
        cal = calibration(oof, fig_dir)
        b1 = path('processed', 'oof_B1.parquet')
        if io.exists(b1):
            skill = stability(oof, io.load(b1))
    cases = io.load(path('processed', 'cases_weekly.csv'))
    envp = path('processed', 'env_weekly.csv')
    env = io.load(envp) if envp.exists() else None
    adjp = path('raw', 'boundaries', 'rdhs_adjacency.csv')
    adj = pd.read_csv(adjp) if adjp.exists() else None
    leak = leakage(cases, env, adj, df)
    v, rx, best_nl, best_r = verdict(curves, sweep, lc, ridge, cal, skill)
    rep = {'validation_year': vy, 'training_curves': curves, 'complexity_sweep': sweep.round(4).to_dict('records'),
           'learning_curve': lc.round(4).to_dict('records'), 'ridge_path': ridge.round(4).to_dict('records'),
           'calibration': cal, 'yearly_skill_vs_B1': skill, 'leakage': leak, 'verdicts': v,
           'prescriptions': rx, 'suggested': {'num_leaves': best_nl, 'ridge': best_r}}
    (fig_dir / 'doctor_report.json').write_text(json.dumps(rep, indent=1, default=str))
    md = ['# Model Doctor report', '', f'Validation year: {vy}', '', '## Verdicts', *[f'- {x}' for x in v], '',
          '## Prescriptions', *([f'- {x}' for x in rx] or ['- none']), '',
          f"## Leakage: time-travel test {leak['time_travel_test']}", '',
          '![training curves](training_curves.png)', '![complexity](complexity_sweep.png)',
          '![learning curve](learning_curve.png)', '![ridge path](ridge_path.png)', '![reliability](reliability.png)']
    (fig_dir / 'doctor_report.md').write_text('\n'.join(md))
    print('\n'.join(md[:12]))
    return rep


if __name__ == '__main__':
    run()
