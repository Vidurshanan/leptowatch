"""Build the clean weekly case panel: one row per RDHS area per reporting week.

Rules (proposal Section 5.4):
  * only reports in an accepted category are used;
  * reports claiming the same week, or an impossible week 53, are EXCLUDED until reconciled
    (add a fix to config/week_fixes.csv after checking the PDF);
  * rows whose year-to-date count falls to zero after a positive value are non-reporting -> MISSING;
  * corrections from the hand check go in config/manual_overrides.csv and are applied last;
  * Kalmunai is its own RDHS area; its counts are never moved into Ampara.

Run:  python -m leptowatch.data.cases <interim_dir> <out_csv>
"""
from __future__ import annotations

import datetime as dt
import os
import sys

import numpy as np
import pandas as pd

from leptowatch import epicalendar
from pathlib import Path

from leptowatch.config import CONFIG_DIR, data_root, rdhs_list
from leptowatch.data.wer_audit import ACCEPTED


def _apply_week_fixes(rep):
    f = CONFIG_DIR / 'week_fixes.csv'
    if not f.exists():
        return rep, set()
    fx = pd.read_csv(f)
    fixed = set()
    for _, x in fx.iterrows():
        m = rep.pdf == x.pdf
        if m.any():
            rep.loc[m, 'year'] = int(x.year)
            rep.loc[m, 'epi_week'] = int(x.epi_week)
            rep.loc[m, 'week_start'] = str(epicalendar.week_start(int(x.year), int(x.epi_week)))
            rep.loc[m, ['week_anomaly', 'duplicate_week']] = False
            fixed.add(x.pdf)
    return rep, fixed


def build_cases(interim_dir, out_csv=None, last_date=None):
    rep = pd.read_csv(os.path.join(interim_dir, 'wer_reports_audited.csv'))
    rows = pd.read_csv(os.path.join(interim_dir, 'wer_rows.csv'))
    rep, fixed = _apply_week_fixes(rep)
    use = rep[rep.category.isin(ACCEPTED) & ~rep.week_anomaly.astype(bool) & ~rep.duplicate_week.astype(bool)]
    # a fixed week may still collide with another report: drop both until resolved
    dup = use.groupby('week_start').pdf.transform('count') > 1
    use = use[~dup]
    r = rows[~rows.rdhs.str.startswith('SRI')].copy()
    r = r.drop(columns=['week_start', 'year', 'epi_week']).merge(
        rep[['pdf', 'year', 'epi_week', 'week_start', 'category']], on='pdf', how='left')

    # non-reporting rows (computed on all rows, because the previous week may sit in another report)
    r = r.sort_values(['rdhs', 'year', 'epi_week'])
    prev_max = r.groupby(['rdhs', 'year']).cases_ytd.transform(lambda v: v.shift().cummax())
    r['nonreporting'] = (r.cases_ytd == 0) & (prev_max > 0)

    # manual corrections from the hand check
    mo = CONFIG_DIR / 'manual_overrides.csv'
    if mo.exists():
        ov = pd.read_csv(mo)
        for _, x in ov.iterrows():
            m = (r.pdf == x.pdf) & (r.rdhs == x.rdhs)
            if m.any() and x.field in ('cases_week', 'cases_ytd'):
                r.loc[m, x.field] = float(x.value)

    r = r[r.pdf.isin(use.pdf)].copy()
    r['week_start'] = pd.to_datetime(r.week_start)
    r['cases'] = r.cases_week.astype(float)
    r.loc[r.nonreporting, 'cases'] = np.nan

    cal = epicalendar.weeks_table(2007, last_date or dt.date.today())
    panel = pd.MultiIndex.from_product([cal.start, rdhs_list()], names=['week_start', 'rdhs']).to_frame(index=False)
    panel = panel.merge(cal.rename(columns={'start': 'week_start'}), on='week_start')
    panel = panel.merge(r[['week_start', 'rdhs', 'cases', 'cases_ytd', 'pdf', 'nonreporting']],
                        on=['week_start', 'rdhs'], how='left')
    status = np.where(panel.pdf.isna(), 'no_accepted_report',
                      np.where(panel.nonreporting.fillna(False).astype(bool), 'nonreporting', 'ok'))
    panel['status'] = status
    panel = panel.drop(columns=['nonreporting']).sort_values(['rdhs', 'week_start']).reset_index(drop=True)
    if out_csv:
        data_root()                                   # makes sure the data folder tree exists
        Path(out_csv).parent.mkdir(parents=True, exist_ok=True)
        panel.to_csv(out_csv, index=False)
        n_ok = (panel.status == 'ok').mean()
        print(f'cases panel: {len(panel):,} rows, {panel.week_start.nunique()} weeks x {panel.rdhs.nunique()} areas; '
              f'{n_ok:.1%} with a usable value; week fixes applied: {len(fixed)}')
    return panel


if __name__ == '__main__':
    build_cases(sys.argv[1], sys.argv[2])
