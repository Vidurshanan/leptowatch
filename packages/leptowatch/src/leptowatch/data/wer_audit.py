"""Audit the parsed reports and sort each into one category.

Categories (same as the proposal, Section 5.4):
  pass                        all 26 rows found and both columns add up to the national row
  pass_national_cell_cut_off  adds up once a national cell cut off in the PDF is allowed for
                              (rows sum to 102, printed national cell shows 10)
  weekly_mismatch             weekly column does not add up -> review
  weekly_ok_ytd_mismatch      weekly adds up, year-to-date does not -> review
  rows_missing                fewer than 26 RDHS rows found -> review
  unreadable / no_table       could not be read
Also flags: week_anomaly (week 53 in a 52-week year), duplicate_week (two reports claim one week).

Run:  python -m leptowatch.data.wer_audit <interim_dir>
Out:  wer_reports_audited.csv, audit_summary.json, review_queue.csv
"""
from __future__ import annotations

import json
import os
import re
import sys
import datetime as dt

import pandas as pd

from leptowatch import epicalendar

ACCEPTED = ['pass', 'pass_national_cell_cut_off']


def _truncated(national, total):
    """True if the printed national cell is the true total with its last digit cut off."""
    try:
        n, s = str(int(national)), str(int(total))
    except (TypeError, ValueError):
        return False
    return s.startswith(n) and len(s) == len(n) + 1


def categorise(x) -> str:
    if x.status in ('no_table', 'unreadable'):
        return x.status
    if pd.isna(x.n_rdhs) or x.n_rdhs < 26:
        return 'rows_missing'
    a_ok, b_ok = bool(x.addup_A), bool(x.addup_B)
    if a_ok and b_ok:
        return 'pass'
    a_cut = a_ok or _truncated(x.national_A, x.sum_A)
    b_cut = b_ok or _truncated(x.national_B, x.sum_B)
    if a_cut and b_cut:
        return 'pass_national_cell_cut_off'
    if a_ok and not b_ok:
        return 'weekly_ok_ytd_mismatch'
    return 'weekly_mismatch'


def upload_date(pdf_name):
    """Recent file names carry a PHP uniqid, whose first 8 hex digits are the upload time."""
    m = re.search(r'en_([0-9a-f]{8})[0-9a-f]{5}_', pdf_name)
    if not m:
        return pd.NaT
    return pd.Timestamp(dt.datetime.fromtimestamp(int(m.group(1), 16), dt.timezone.utc).date())


def audit(interim_dir):
    rep = pd.read_csv(os.path.join(interim_dir, 'wer_reports.csv'))
    rows = pd.read_csv(os.path.join(interim_dir, 'wer_rows.csv'))
    rep['category'] = rep.apply(categorise, axis=1)
    ok_year = rep.year.notna() & rep.epi_week.notna()
    rep['week_anomaly'] = False
    rep.loc[ok_year, 'week_anomaly'] = [w > epicalendar.weeks_in_year(int(y))
                                        for y, w in zip(rep.loc[ok_year, 'year'], rep.loc[ok_year, 'epi_week'])]
    acc = rep[rep.category.isin(ACCEPTED) & ~rep.week_anomaly]
    dcount = acc.groupby('week_start').pdf.transform('count')
    rep['duplicate_week'] = rep.pdf.isin(acc.loc[dcount > 1, 'pdf'])
    rep['upload_date'] = rep.pdf.map(upload_date)
    rep['upload_lag_weeks'] = ((rep.upload_date - pd.to_datetime(rep.week_end)).dt.days / 7).round(1)

    # Year-to-date consistency on accepted, unique weeks
    good = rep[rep.category.isin(ACCEPTED) & ~rep.week_anomaly & ~rep.duplicate_week]
    rr = rows[rows.pdf.isin(good.pdf) & ~rows.rdhs.str.startswith('SRI')].copy()
    rr = rr.sort_values(['rdhs', 'year', 'epi_week'])
    rr['dB'] = rr.groupby(['rdhs', 'year']).cases_ytd.diff()
    rr['gap'] = rr.groupby(['rdhs', 'year']).epi_week.diff()
    cons = rr[rr.gap == 1]
    late = cons.dB - cons.cases_week

    allr = rows[~rows.rdhs.str.startswith('SRI')].sort_values(['rdhs', 'year', 'epi_week']).copy()
    prev_max = allr.groupby(['rdhs', 'year']).cases_ytd.transform(lambda v: v.shift().cummax())
    nonrep = (allr.cases_ytd == 0) & (prev_max > 0)
    first = (allr.cases_ytd == 0) & (allr.groupby(['rdhs', 'year']).cases_ytd.shift() > 0)

    summary = {
        'n_pdfs': int(len(rep)),
        'categories': {k: int(v) for k, v in rep.category.value_counts().items()},
        'accepted': int(rep.category.isin(ACCEPTED).sum()),
        'held_out_for_review': int((~rep.category.isin(ACCEPTED)).sum()),
        'week_anomalies': int(rep.week_anomaly.sum()),
        'duplicate_week_reports': int(rep.duplicate_week.sum()),
        'date_check': {str(k): int(v) for k, v in rep.date_ok.value_counts(dropna=False).items()},
        'ytd_pairs': int(len(cons)),
        'ytd_exact_share': round(float((late == 0).mean()), 3) if len(cons) else None,
        'ytd_late_additions_share': round(float((late > 0).mean()), 3) if len(cons) else None,
        'nonreporting_rows': int(nonrep.sum()), 'nonreporting_runs': int(first.sum()),
        'median_upload_lag_weeks_last_2_years': float(rep.loc[rep.year >= rep.year.max() - 1,
                                                               'upload_lag_weeks'].median()),
        'latest_week_start': str(rep.week_start.dropna().max()),
    }
    rep.to_csv(os.path.join(interim_dir, 'wer_reports_audited.csv'), index=False)
    q = rep[~rep.category.isin(ACCEPTED) | rep.week_anomaly | rep.duplicate_week].copy()
    q['why'] = q.category.where(~q.category.isin(ACCEPTED), '')
    q.loc[q.week_anomaly, 'why'] = 'week_anomaly'
    q.loc[q.duplicate_week, 'why'] = 'duplicate_week'
    q[['pdf', 'volume', 'issue_no', 'year', 'epi_week', 'page', 'why', 'national_A', 'sum_A', 'national_B', 'sum_B',
       'missing']].to_csv(os.path.join(interim_dir, 'review_queue.csv'), index=False)
    with open(os.path.join(interim_dir, 'audit_summary.json'), 'w') as fh:
        json.dump(summary, fh, indent=1)
    print(json.dumps(summary, indent=1))
    return rep, summary


if __name__ == '__main__':
    audit(sys.argv[1])
