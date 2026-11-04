"""Telegram and email alerts. Secrets come from environment variables, never from files.

    LW_TELEGRAM_TOKEN   bot token from @BotFather
    LW_SMTP_HOST, LW_SMTP_PORT, LW_SMTP_USER, LW_SMTP_PASS   (Gmail: an App Password)
Recipients are listed in config notify.telegram_chat_ids / notify.email_to.
Set LW_DRY_RUN=1 to print messages instead of sending them.
"""
from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage

import pandas as pd

from leptowatch.config import load_config

ICON = {'Warning': '🔴', 'Advisory': '🟠', 'Watch': '🟡', 'None': '🟢'}


def message(pub: pd.DataFrame, issue: str) -> str:
    lines = [f'LeptoWatch – week starting {issue}', 'Leptospirosis outlook for weeks +3 to +5', '']
    order = {'Warning': 0, 'Advisory': 1, 'Watch': 2, 'None': 3}
    for _, r in pub.sort_values('tier', key=lambda s: s.map(order)).iterrows():
        if r.tier == 'None':
            continue
        tag = ' (Unverified)' if r.get('unverified') else ''
        lines.append(f"{ICON[r.tier]} {r.rdhs}: {r.tier}{tag} – expected {r.mu:.0f} cases "
                     f"(80%: {r.lo:.0f}–{r.hi:.0f}); {r.rule}")
        if isinstance(r.get('reasons'), str) and r.reasons:
            lines.append(f'   why: {r.reasons}')
    quiet = (pub.tier == 'None').sum()
    lines += ['', f'{quiet} areas without an alert.', 'Forecasts are committed to the public ledger before outcomes are known.']
    return '\n'.join(lines)


def send_telegram(text: str):
    tok = os.environ.get('LW_TELEGRAM_TOKEN')
    ids = load_config()['notify']['telegram_chat_ids']
    if os.environ.get('LW_DRY_RUN') or not tok or not ids:
        print('[telegram dry-run]\n' + text)
        return
    import requests
    for cid in ids:
        requests.post(f'https://api.telegram.org/bot{tok}/sendMessage', json={'chat_id': cid, 'text': text[:4000]},
                      timeout=30).raise_for_status()


def send_email(subject: str, text: str, attachment=None):
    to = load_config()['notify']['email_to']
    host = os.environ.get('LW_SMTP_HOST')
    if os.environ.get('LW_DRY_RUN') or not host or not to:
        print(f'[email dry-run] {subject}')
        return
    msg = EmailMessage()
    msg['Subject'], msg['From'], msg['To'] = subject, os.environ['LW_SMTP_USER'], ', '.join(to)
    msg.set_content(text)
    if attachment:
        with open(attachment, 'rb') as fh:
            msg.add_attachment(fh.read(), maintype='application', subtype='pdf', filename=os.path.basename(attachment))
    with smtplib.SMTP_SSL(host, int(os.environ.get('LW_SMTP_PORT', 465))) as s:
        s.login(os.environ['LW_SMTP_USER'], os.environ['LW_SMTP_PASS'])
        s.send_message(msg)


def send_week(pub, issue, pdf=None):
    text = message(pub, issue)
    send_telegram(text)
    send_email(f'LeptoWatch outlook – week of {issue}', text, pdf)
