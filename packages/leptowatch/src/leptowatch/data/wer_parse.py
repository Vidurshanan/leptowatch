"""LeptoWatch WER parser v0.3.

Reads Table 1 ("Selected notifiable diseases reported by Medical Officers of Health") of each
Weekly Epidemiological Report PDF and extracts, for every RDHS area and the national row, the
leptospirosis columns: A = cases this week, B = cases this year so far.

What is new in v0.3 (v0.2 was used for the proposal):
  * the reported week's YEAR comes from the volume number (Vol. N = year N + 1973), because
    table titles contain year typos (e.g. "28th Dec - 03rd Jan 2024" for week 1 of 2025);
  * the printed end date of the week is checked against the epidemiological calendar;
  * PDFs are parsed in parallel and the raw text line of every row is kept for audit.

Needs the `pdftotext` and `pdfinfo` programs (Colab: apt-get install -y poppler-utils).

Run:  python -m leptowatch.data.wer_parse <pdf_dir> <out_dir> [--workers 4]
Out:  wer_rows.csv     one row per report x area (+ national row), with raw line
      wer_reports.csv  one row per PDF with the checks
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import os
import re
import subprocess
from collections import Counter
from concurrent.futures import ProcessPoolExecutor

from leptowatch import epicalendar

# RDHS names as regex prefixes, because many reports truncate names ("Anuradhapur", "Polonnaruw")
RDHS = [
    ('Colombo', r'Colom\w*'), ('Gampaha', r'Gampa\w*|Gam-?\s*paha|paha'), ('Kalutara', r'Kalut\w*'),
    ('Kandy', r'Kandy'), ('Matale', r'Matal\w*'), ('Nuwara Eliya', r'Nuwara\s*Eliy?a?\w*|Nuwara|N\.?\s*Eliya'),
    ('Galle', r'Galle'), ('Hambantota', r'Hamban\w*'), ('Matara', r'Matar\w*'),
    ('Jaffna', r'Jaffn\w*'), ('Kilinochchi', r'Kili[\w-]*'), ('Mannar', r'Manna\w*'),
    ('Vavuniya', r'Vavun\w*'), ('Mullaitivu', r'Mulla\w*'),
    ('Batticaloa', r'Battic\w*'), ('Ampara', r'Ampar\w*'), ('Trincomalee', r'Trinc\w*'),
    ('Kurunegala', r'Kurun\w*'), ('Puttalam', r'Putt\w*'), ('Anuradhapura', r'Anura\w*'),
    ('Polonnaruwa', r'Polon\w*'), ('Badulla', r'Badul\w*'), ('Monaragala', r'Mon[ae]rag\w*'),
    ('Ratnapura', r'Rat?h?nap\w*'), ('Kegalle', r'Kegal\w*'), ('Kalmunai', r'Kalmun\w*'),
]
NATIONAL = r'SRI\s*LANKA'
NUM = re.compile(r'^\d+$')
WEEK = re.compile(r'\((\d{1,2})\s*(?:st|nd|rd|th)?\s*[Ww]eek\)')
VOL = re.compile(r'Vol\.?\s*(\d{2})\s*No\.?\s*(\d{1,2})', re.I)
MONTHS = {m: i for i, m in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug',
                                       'sep', 'oct', 'nov', 'dec'], start=1)}
TITLE_END = re.compile(r'[–-]\s*(\d{1,2})\s*(?:st|nd|rd|th)?\s*([A-Za-z]{3,9})\.?\s*,?\s*(?:20\d\d)?\s*\(\s*(\d{1,2})',
                       re.I)


def _run(args):
    return subprocess.run(args, capture_output=True, text=True, timeout=120).stdout


def page_text(pdf, p):
    return _run(['pdftotext', '-layout', '-f', str(p), '-l', str(p), pdf, '-'])


def n_pages(pdf):
    m = re.search(r'Pages:\s+(\d+)', _run(['pdfinfo', pdf]))
    return int(m.group(1)) if m else 0


def _row_match(line, pat):
    return re.match(r'\s*(' + pat + r')\b', line, re.I)


def _token_method(line, m):
    toks = [t for t in line[m.end():].split() if NUM.match(t)]
    return (int(toks[10]), int(toks[11])) if len(toks) >= 12 else None


def _position_method(line, m, cols):
    """Assign each number to the nearest A/B column (character offsets under the header)."""
    if not cols or len(cols) < 12:
        return None
    gap = min((b - a for a, b in zip(cols, cols[1:]) if b > a), default=4)
    got = {}
    for t in re.finditer(r'\d+', line):
        if t.start() < m.end():
            continue
        c = (t.start() + t.end() - 1) / 2
        k = min(range(len(cols)), key=lambda i: abs(cols[i] - c))
        d = abs(cols[k] - c)
        if d <= max(gap * 0.75, 3) and (k not in got or d < got[k][1]):
            got[k] = (int(t.group()), d)
    if 10 in got and 11 in got:
        return got[10][0], got[11][0]
    if 11 in got and 10 not in got:          # blank weekly cell means zero this week
        return 0, got[11][0]
    return None


def parse_page(txt):
    """Return (rows, national, duplicates, week, title_end) for a page holding Table 1, else None.
    Leptospirosis is the 6th disease, so its A and B values are the 11th and 12th numbers."""
    lines = txt.splitlines()
    hdr = next((i for i, l in enumerate(lines) if re.search(r'Lepto', l, re.I) and re.search(r'Dengue', l, re.I)), None)
    if hdr is None:
        return None
    cols = None
    for l in lines[hdr + 1:hdr + 6]:
        ab = [mm.start() for mm in re.finditer(r'(?<![A-Za-z])[AB](?![A-Za-z])', l)]
        if len(ab) >= 12:
            cols = ab
            break
    rows, national, dupes = {}, None, []
    for l in lines[hdr + 1:]:
        mn = _row_match(l, NATIONAL)
        if mn:
            pa, tk = _position_method(l, mn, cols), _token_method(l, mn)
            if pa or tk:
                national = (pa, tk, l.strip())
                break
        for name, pat in RDHS:
            m = _row_match(l, pat)
            if m:
                pa, tk = _position_method(l, m, cols), _token_method(l, m)
                if pa or tk:
                    if name in rows:
                        dupes.append(name)
                    rows[name] = (pa, tk, l.strip())
                break
    weeks = [int(w) for w in WEEK.findall(txt)]
    week = Counter(weeks).most_common(1)[0][0] if weeks else None
    te = None
    for l in lines[:hdr + 1][::-1]:
        mt = TITLE_END.search(l)
        if mt and mt.group(2)[:3].lower() in MONTHS:
            te = (int(mt.group(1)), MONTHS[mt.group(2)[:3].lower()], int(mt.group(3)))
            break
    return rows, national, dupes, week, te


def _volume(path, first_pages_text):
    m = VOL.search(os.path.basename(path).replace('_', ' ')) or VOL.search(first_pages_text)
    return (int(m.group(1)), int(m.group(2))) if m else (None, None)


def parse_pdf(path):
    """Parse one PDF. Returns (report_dict, list_of_row_dicts)."""
    f = os.path.basename(path)
    sha = hashlib.sha256(open(path, 'rb').read()).hexdigest()[:12]
    rep = {'pdf': f, 'sha256_12': sha}
    try:
        npg = n_pages(path)
        texts = {p: page_text(path, p) for p in range(1, npg + 1)}
    except Exception as e:  # noqa: BLE001
        rep.update(status='unreadable', note=str(e)[:80])
        return rep, []
    vol, no = _volume(path, texts.get(1, ''))
    rep.update(volume=vol, issue_no=no)
    best = None
    for p, t in texts.items():
        res = parse_page(t)
        if res and len(res[0]) >= 15 and (best is None or len(res[0]) > len(best[1][0])):
            best = (p, res)
    if not best:
        rep.update(status='no_table')
        return rep, []
    p, (rows, national, dupes, week, te) = best
    # Year of the reported week: Vol N is year N+1973; issue No 1-2 can report week 52/53 of the year before
    year = (vol + 1973) if vol else None
    if year and week and no and week >= 50 and no <= 3:
        year -= 1
    ws = we = None
    date_ok = ''
    if year and week:
        try:
            ws, we = epicalendar.week_start(year, week), epicalendar.week_end(year, week)
            if te:
                date_ok = (te[0] == we.day and te[1] == we.month)
        except ValueError:
            pass
    chosen = None
    for meth, idx in (('position', 0), ('token', 1)):
        if national is None or national[idx] is None or any(v[idx] is None for v in rows.values()):
            continue
        sa = sum(v[idx][0] for v in rows.values())
        sb = sum(v[idx][1] for v in rows.values())
        res = (meth, idx, sa, sb, sa == national[idx][0], sb == national[idx][1])
        if chosen is None or (res[4] and res[5] and not (chosen[4] and chosen[5])):
            chosen = res
    rep.update(page=p, year=year, epi_week=week, week_start=ws, week_end=we,
               title_end=f'{te[0]}/{te[1]}' if te else '', date_ok=date_ok, n_rdhs=len(rows),
               missing=';'.join(n for n, _ in RDHS if n not in rows), duplicates=';'.join(dupes))
    if chosen is None:
        rep.update(status='unreadable')
        return rep, []
    meth, idx, sa, sb, ok_a, ok_b = chosen
    nat = national[idx]
    rep.update(method=meth, national_A=nat[0], national_B=nat[1], sum_A=sa, sum_B=sb,
               addup_A=ok_a, addup_B=ok_b,
               status='pass' if (ok_a and ok_b and len(rows) == 26 and not dupes) else 'check')
    out = []
    for name, v in rows.items():
        val = v[idx]
        out.append({'pdf': f, 'page': p, 'year': year, 'epi_week': week, 'week_start': ws, 'rdhs': name,
                    'cases_week': val[0], 'cases_ytd': val[1], 'method': meth, 'raw_line': v[2]})
    out.append({'pdf': f, 'page': p, 'year': year, 'epi_week': week, 'week_start': ws,
                'rdhs': 'SRI LANKA (national row)', 'cases_week': nat[0], 'cases_ytd': nat[1],
                'method': meth, 'raw_line': national[2]})
    return rep, out


REPORT_KEYS = ['pdf', 'sha256_12', 'volume', 'issue_no', 'page', 'year', 'epi_week', 'week_start', 'week_end',
               'title_end', 'date_ok', 'method', 'n_rdhs', 'missing', 'duplicates', 'national_A', 'national_B',
               'sum_A', 'sum_B', 'addup_A', 'addup_B', 'status', 'note']
ROW_KEYS = ['pdf', 'page', 'year', 'epi_week', 'week_start', 'rdhs', 'cases_week', 'cases_ytd', 'method', 'raw_line']


def parse_folder(pdf_dir, out_dir, workers=4):
    os.makedirs(out_dir, exist_ok=True)
    pdfs = sorted(os.path.join(pdf_dir, f) for f in os.listdir(pdf_dir) if f.lower().endswith('.pdf'))
    reports, rows = [], []
    with ProcessPoolExecutor(max_workers=workers) as ex:
        for i, (rep, out) in enumerate(ex.map(parse_pdf, pdfs, chunksize=4), 1):
            reports.append(rep)
            rows.extend(out)
            if i % 100 == 0:
                print(f'  parsed {i}/{len(pdfs)}')
    with open(os.path.join(out_dir, 'wer_rows.csv'), 'w', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=ROW_KEYS)
        w.writeheader()
        w.writerows(rows)
    with open(os.path.join(out_dir, 'wer_reports.csv'), 'w', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=REPORT_KEYS)
        w.writeheader()
        for r in reports:
            w.writerow({k: r.get(k, '') for k in REPORT_KEYS})
    st = Counter(r['status'] for r in reports)
    print('PDFs:', len(pdfs), dict(st))
    return reports, rows


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf_dir')
    ap.add_argument('out_dir')
    ap.add_argument('--workers', type=int, default=4)
    a = ap.parse_args()
    parse_folder(a.pdf_dir, a.out_dir, a.workers)
