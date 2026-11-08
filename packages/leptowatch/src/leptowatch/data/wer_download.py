"""Get the Weekly Epidemiological Report PDFs.

Two routes, use both:
  1. archive  - clone the public archive copy (1,014 PDFs, 2007 to Vol 53 No 25) in one step:
                python -m leptowatch.data.wer_download archive
  2. update   - crawl the official listing and download every English PDF not yet on disk:
                python -m leptowatch.data.wer_download update

Politeness: identifies itself, checks robots.txt, waits between requests, never re-downloads.
Every file is recorded in raw/wer_pdfs/manifest.csv with its URL, SHA-256 and download time.
"""
from __future__ import annotations

import csv
import datetime as dt
import hashlib
import os
import re
import shutil
import subprocess
import sys
import time
from urllib.parse import urljoin
from urllib import robotparser

from leptowatch.config import load_config, path

WEEK_RE = re.compile(r"Week\s+(\d+)", re.I)
VOL_RE = re.compile(r"Vol[._\s]*(\d{2})[._\s]*no[._\s]*(\d{1,2})", re.I)


def _manifest_path():
    return path('raw', 'wer_pdfs', 'manifest.csv')


def _append_manifest(rows):
    mp = _manifest_path()
    new = not mp.exists()
    with open(mp, 'a', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=['file', 'url', 'sha256', 'downloaded_utc', 'source'])
        if new:
            w.writeheader()
        w.writerows(rows)


def archive():
    """Clone the public archive copy and copy its PDFs into raw/wer_pdfs."""
    cfg = load_config()
    tmp = path('raw', '_archive_clone')
    if not tmp.exists():
        subprocess.run(['git', 'clone', '--depth', '1', cfg['wer']['archive_repo'], str(tmp)], check=True)
    src = tmp / 'lepto_scraper' / 'pdfs'
    dst = path('raw', 'wer_pdfs', 'x').parent
    rows, n = [], 0
    for f in sorted(os.listdir(src)):
        if not f.lower().endswith('.pdf') or (dst / f).exists():
            continue
        shutil.copy2(src / f, dst / f)
        rows.append({'file': f, 'url': cfg['wer']['archive_repo'], 'sha256': hashlib.sha256((dst / f).read_bytes()).hexdigest(),
                     'downloaded_utc': dt.datetime.utcnow().isoformat(timespec='seconds'), 'source': 'archive'})
        n += 1
    _append_manifest(rows)
    print(f'copied {n} PDFs into {dst} ({len(os.listdir(dst)) - 1} files now)')


def _have_volumes(dst):
    have = set()
    for f in os.listdir(dst):
        m = VOL_RE.search(f)
        if m:
            have.add((int(m.group(1)), int(m.group(2))))
    return have


def update(max_pages=60, dry_run=False):
    """Crawl the listing pages and download English PDFs we do not have yet."""
    import requests
    from bs4 import BeautifulSoup

    cfg = load_config()['wer']
    base, ua, delay = cfg['listing_url'], cfg['user_agent'], cfg['polite_delay_seconds']
    rp = robotparser.RobotFileParser(urljoin(base, '/robots.txt'))
    try:
        rp.read()
    except Exception:  # noqa: BLE001
        pass
    s = requests.Session()
    s.headers['User-Agent'] = ua
    dst = path('raw', 'wer_pdfs', 'x').parent
    have = _have_volumes(dst)
    seen, links, queue = set(), [], [base]
    while queue and len(seen) < max_pages:
        url = queue.pop(0)
        if url in seen or (rp.default_entry and not rp.can_fetch(ua, url)):
            continue
        seen.add(url)
        html = s.get(url, timeout=30).text
        soup = BeautifulSoup(html, 'html.parser')
        for a in soup.find_all('a', href=True):
            href = urljoin(url, a['href'])
            if href.lower().endswith('.pdf') and 'english' in href.lower():
                links.append(href)
            elif re.search(r'[?&]page=\d+', href) and href.startswith(base) and href not in seen:
                queue.append(href)
        time.sleep(delay)
    todo = []
    for href in dict.fromkeys(links):
        m = VOL_RE.search(href)
        if m and (int(m.group(1)), int(m.group(2))) not in have:
            todo.append(href)
    print(f'listing pages read: {len(seen)}; English PDFs listed: {len(set(links))}; new: {len(todo)}')
    if dry_run:
        print(*todo[:20], sep='\n')
        return todo
    rows = []
    for href in todo:
        m = VOL_RE.search(href)
        fname = f"{int(m.group(1)) + 1973}_vol_{int(m.group(1))}_no_{int(m.group(2)):02d}_{href.split('/')[-1]}"
        r = s.get(href, timeout=60)
        if r.status_code == 200 and r.content[:4] == b'%PDF':
            (dst / fname).write_bytes(r.content)
            rows.append({'file': fname, 'url': href, 'sha256': hashlib.sha256(r.content).hexdigest(),
                         'downloaded_utc': dt.datetime.utcnow().isoformat(timespec='seconds'), 'source': 'epid.gov.lk'})
            print('  saved', fname)
        else:
            print('  FAILED', href, r.status_code)
        time.sleep(delay)
    _append_manifest(rows)
    return todo


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'update'
    if cmd == 'archive':
        archive()
    elif cmd == 'update':
        update(dry_run='--dry-run' in sys.argv)
    else:
        sys.exit('usage: python -m leptowatch.data.wer_download [archive|update] [--dry-run]')
