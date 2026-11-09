"""Core tests. Run all with:  python tests/run_all.py   (or: pytest -q tests)"""
from __future__ import annotations

import datetime as dt
import os
import sys
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'src'))
sys.path.insert(0, str(HERE))
os.environ.setdefault('LW_DATA_ROOT', tempfile.mkdtemp(prefix='lw_test_'))

from leptowatch import epicalendar  # noqa: E402


# ---------------------------------------------------------------- calendar
def test_calendar_matches_report_titles():
    # dates printed in Weekly Epidemiological Report table titles
    assert epicalendar.week_start(2025, 1) == dt.date(2024, 12, 28)
    assert epicalendar.week_end(2020, 2) == dt.date(2020, 1, 10)
    assert epicalendar.week_start(2010, 1) == dt.date(2010, 1, 2)
    assert epicalendar.week_start(2009, 1) == dt.date(2008, 12, 27)
    assert epicalendar.week_start(2026, 1) == dt.date(2025, 12, 29)       # Monday weeks from 2026
    assert epicalendar.week_start(2026, 23) == dt.date(2026, 6, 1)
    assert epicalendar.week_of(dt.date(2026, 6, 3)) == (2026, 23)
    assert epicalendar.week_of(dt.date(2024, 3, 30)) == (2024, 14)
    assert epicalendar.week_of(dt.date(2025, 12, 27)) is None            # gap between the two systems


def test_weeks_table_is_contiguous():
    w = epicalendar.weeks_table(2007, dt.date(2025, 12, 26))
    gaps = w.start.diff().dt.days.dropna()
    assert (gaps == 7).all()
    assert w.t.is_monotonic_increasing


# ---------------------------------------------------------------- parser (needs pdftotext + fixtures)
def test_parser_on_fixture_reports():
    import shutil
    fx = HERE / 'fixtures'
    pdfs = sorted(fx.glob('*.pdf'))
    if not pdfs or shutil.which('pdftotext') is None:
        print('  (skipped: no fixture PDFs or pdftotext missing)')
        return
    from leptowatch.data.wer_parse import parse_pdf
    for p in pdfs:
        rep, rows = parse_pdf(str(p))
        assert rep['status'] in ('pass', 'check'), (p.name, rep)
        assert rep['n_rdhs'] == 26, (p.name, rep['n_rdhs'])
    rep, rows = parse_pdf(str(fx / 'vol_51_no_15_english.pdf'))
    nat = [r for r in rows if r['rdhs'].startswith('SRI')][0]
    assert (nat['cases_week'], nat['cases_ytd']) == (192, 3748)
    assert rep['epi_week'] == 14 and rep['year'] == 2024 and rep['status'] == 'pass'


# ---------------------------------------------------------------- features: no leakage
def test_time_travel_no_leakage():
    import synthetic
    from leptowatch.features.build import build_features, TARGET_COLS
    cases, env, adj = synthetic.make(seed=1, last_date='2021-12-31')
    full = build_features(cases, env, adj)
    fcols = [c for c in full.columns if c not in TARGET_COLS + ['rdhs']]
    for t in (600, 700, 750):
        cut = build_features(cases, env, adj, cutoff_t=t)
        a = full[full.t == t].set_index('rdhs')[fcols].select_dtypes('number')
        b = cut[cut.t == t].set_index('rdhs')[fcols].select_dtypes('number')
        same = np.isclose(a.values, b.values, equal_nan=True)
        assert same.all(), f'leak at t={t}: ' + str(list(a.columns[~same.all(0)]))


def test_targets_are_three_week_totals():
    import synthetic
    from leptowatch.features.build import build_features
    cases, env, adj = synthetic.make(seed=2, last_date='2015-12-31')
    f = build_features(cases, env, adj)
    piv = cases.pivot_table(index='t', columns='rdhs', values='cases', dropna=False)
    r = f[(f.rdhs == 'Galle') & f.y35.notna()].iloc[50]
    exp = piv.loc[r.t + 3:r.t + 5, 'Galle'].sum()
    assert abs(r.y35 - exp) < 1e-9


# ---------------------------------------------------------------- models
def test_nb_glm_recovers_truth():
    from leptowatch.models.glm_nb import NBGLM
    rng = np.random.default_rng(0)
    X = rng.normal(size=(4000, 2))
    mu = np.exp(1.0 + 0.6 * X[:, 0] - 0.4 * X[:, 1])
    y = rng.negative_binomial(2.5, 2.5 / (2.5 + mu))
    m = NBGLM(ridge=0.0).fit(X, y)
    assert np.allclose(m.coef_, [1.0, 0.6, -0.4], atol=0.06)
    assert abs(m.alpha_ - 0.4) < 0.06


def test_synthetic_flood_signal_is_found():
    """H1 machinery check: the planted flood effect must make detector A better WITH flood inputs."""
    import synthetic
    from leptowatch.features.build import build_features
    from leptowatch.models import detectors as D
    cases, env, adj = synthetic.make(seed=3, last_date='2024-12-31', flood_effect=1.5)
    f = build_features(cases, env, adj, case_lag=4)
    tr = f[(f.year.between(2017, 2021)) & f.y35.notna()]
    te = f[(f.year.between(2022, 2024)) & f.y35.notna()]
    full = D.DetectorA().fit(tr).predict(te)
    nofl = D.DetectorA(use_flood=False).fit(tr).predict(te)
    mae_full, mae_nofl = np.mean(np.abs(te.y35 - full.mu)), np.mean(np.abs(te.y35 - nofl.mu))
    print(f'  synthetic H1: MAE with flood {mae_full:.2f} vs without {mae_nofl:.2f}')
    assert mae_full < mae_nofl * 0.99


# ---------------------------------------------------------------- alert rules
def test_alert_rules_order():
    from leptowatch.alerts.engine import decide
    th = {'tau_watch': 0.2, 'tau_advisory': 0.5, 'tau_warning': 0.7}
    base = dict(pE=0.1, pH=0.05, C_fire=0, D_fire=0, nowcast_last3=1, thrE_now=10)
    assert decide(base, th)[0] == 'None'
    assert decide({**base, 'pE': 0.3}, th)[0] == 'Watch'
    assert decide({**base, 'pE': 0.6}, th)[0] == 'Advisory'
    assert decide({**base, 'pE': 0.6, 'pH': 0.8}, th)[0] == 'Warning'
    assert decide({**base, 'C_fire': 1}, th)[0] == 'Watch'                    # rule layer alone: Watch only
    assert decide({**base, 'D_fire': 1}, th)[0] == 'Watch'                    # flood alone never Warning
    assert decide({**base, 'D_fire': 1, 'pE': 0.55, 'nowcast_last3': 20}, th)[0] == 'Warning'
    tier, rule = decide({**base, 'pE': 0.9, 'pH': 0.9}, th, data_ok=False)
    assert tier == 'Watch' and rule.startswith('Unverified')                # stale data never looks safe


# ---------------------------------------------------------------- ledger
def test_ledger_chain_and_tamper_detection():
    from leptowatch.alerts import ledger
    f = ledger._file()
    if f.exists():
        f.unlink()
    df = pd.DataFrame({'rdhs': ['Galle'], 'tier': ['Watch'], 'pE': [0.3]})
    ledger.append('2026-10-19', df, 'test')
    ledger.append('2026-10-26', df.assign(pE=0.4), 'test')
    assert ledger.verify()['ok'] and ledger.verify()['entries'] == 2
    lines = f.read_text().splitlines()
    f.write_text(lines[0].replace('0.3', '0.9') + '\n' + lines[1] + '\n')
    assert not ledger.verify()['ok']


# ---------------------------------------------------------------- conformal
def test_aci_reaches_target_coverage():
    from leptowatch.models.blend import aci
    from leptowatch.models.common import qcol
    rng = np.random.default_rng(0)
    n_t, R = 400, 10
    t = np.repeat(np.arange(n_t), R)
    y = rng.poisson(20, size=n_t * R).astype(float)
    df = pd.DataFrame({'t': t, 'rdhs': np.tile([f'a{i}' for i in range(R)], n_t), 'y35': y,
                       qcol(0.1): 18.0, qcol(0.9): 22.0})          # far too narrow on purpose
    df['lo'], df['hi'] = df[qcol(0.1)], df[qcol(0.9)]
    out = aci(df, level=0.8, gamma=0.02, delay=13)
    late = out[out.t > 150]
    cov = ((late.y35 >= late.lo_aci) & (late.y35 <= late.hi_aci)).mean()
    assert 0.74 < cov < 0.88, cov


def test_aci_intervals_are_nonnegative_and_ordered():
    from leptowatch.models.blend import aci
    from leptowatch.models.common import qcol

    rng = np.random.default_rng(7)
    n_t, R = 180, 6
    t = np.repeat(np.arange(n_t), R)
    y = rng.poisson(2, size=n_t * R).astype(float)

    df = pd.DataFrame({
        "t": t,
        "rdhs": np.tile([f"area{i}" for i in range(R)], n_t),
        "y35": y,
        qcol(0.1): 0.0,
        qcol(0.9): 0.5,
    })

    out = aci(df, level=0.8, gamma=0.01, delay=13)

    assert (out["lo_aci"] >= 0).all()
    assert (out["hi_aci"] >= 0).all()
    assert (out["lo_aci"] <= out["hi_aci"]).all()


def test_future_environment_perturbation_does_not_change_past_features():
    """Changing strictly future environment observations must not change features at t."""
    import synthetic
    from leptowatch.features.build import build_features, TARGET_COLS

    cases, env, adj = synthetic.make(seed=19, last_date="2021-12-31")
    original = build_features(cases, env, adj)

    # Perturb environmental values strictly after the issue week.
    t = 700
    issue_date = pd.to_datetime(
        cases.loc[cases["t"] == t, "week_start"].iloc[0]
    )
    changed = env.copy()
    future = pd.to_datetime(changed["week_start"]) > issue_date

    for col in ("rain_mm", "soil_m3m3", "paddy_flood", "land_flood"):
        changed.loc[future, col] = changed.loc[future, col] * 3.0 + 7.0

    altered = build_features(cases, changed, adj)

    feature_cols = [
        c for c in original.columns
        if c not in TARGET_COLS + ["rdhs"]
    ]
    a = original.loc[original["t"] == t].set_index("rdhs")[feature_cols]
    b = altered.loc[altered["t"] == t].set_index("rdhs")[feature_cols]

    numeric_cols = a.select_dtypes(include="number").columns
    same = np.isclose(
        a[numeric_cols].to_numpy(dtype=float),
        b[numeric_cols].to_numpy(dtype=float),
        equal_nan=True,
    )
    assert same.all(), (
        "Future environmental perturbation changed features at t="
        f"{t}: {list(numeric_cols[~same.all(axis=0)])}"
    )
