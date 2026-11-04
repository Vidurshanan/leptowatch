"""Weekly PDF bulletin for district offices (ReportLab; pip install reportlab)."""
from __future__ import annotations

import pandas as pd

from leptowatch.config import path

COLOURS = {'Warning': '#C0392B', 'Advisory': '#E67E22', 'Watch': '#F1C40F', 'None': '#27AE60'}


def make(pub: pd.DataFrame, issue: str) -> str:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    out = path('outputs', f'bulletin_{issue}.pdf')
    st = getSampleStyleSheet()
    doc = SimpleDocTemplate(str(out), pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm,
                            topMargin=15 * mm, bottomMargin=15 * mm)
    story = [Paragraph('LeptoWatch weekly outlook', st['Title']),
             Paragraph(f'Issue week starting {issue}. Expected reported leptospirosis cases in weeks +3 to +5, '
                       'with 80% intervals and alert tiers. Unverified = an input was too old; treat as Elevated.',
                       st['Normal']), Spacer(1, 6)]
    order = {'Warning': 0, 'Advisory': 1, 'Watch': 2, 'None': 3}
    p = pub.sort_values(['tier', 'pE'], key=lambda s: s.map(order) if s.name == 'tier' else -s)
    data = [['RDHS area', 'Tier', 'Expected (80%)', 'P(Elevated)', 'Why']]
    for _, r in p.iterrows():
        why = '; '.join((r.reasons if isinstance(r.get('reasons'), str) else '').split(' | ')[:2])
        tier = r.tier + (' (Unverified)' if r.get('unverified') else '')
        data.append([r.rdhs, tier, f'{r.mu:.0f} ({r.lo:.0f}-{r.hi:.0f})',
                     '' if pd.isna(r.pE) else f'{r.pE:.0%}', Paragraph(why, st['BodyText'])])
    t = Table(data, colWidths=[30 * mm, 28 * mm, 30 * mm, 22 * mm, 70 * mm], repeatRows=1)
    style = [('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F4E46')), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
             ('FONTSIZE', (0, 0), (-1, -1), 8), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
             ('GRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#CCCCCC'))]
    for i, (_, r) in enumerate(p.iterrows(), start=1):
        style.append(('BACKGROUND', (1, i), (1, i), colors.HexColor(COLOURS.get(r.tier, '#FFFFFF'))))
    t.setStyle(TableStyle(style))
    story += [t, Spacer(1, 8), Paragraph('Forecasts use only data available on the issue date and are committed to a '
                                         'public hash-chained ledger before outcomes are known. LeptoWatch supports, '
                                         'and does not replace, the judgement of the Regional Epidemiologist.',
                                         st['Italic'])]
    doc.build(story)
    return str(out)
