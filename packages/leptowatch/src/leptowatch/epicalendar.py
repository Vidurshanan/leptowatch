"""Sri Lankan epidemiological week calendar used by the Weekly Epidemiological Report.

Verified against the report tables:
  * up to 2025: weeks run Saturday-Friday; week 1 is the Saturday-Friday week that contains 2 January
    (2025 week 1 = 28 Dec 2024 - 3 Jan 2025; 2010 week 1 = 2-8 Jan 2010; 2009 week 1 = 27 Dec 2008 -
    2 Jan 2009). Checked against the dates printed in the table titles of the archived reports.
  * from 2026: weeks run Monday-Sunday and follow ISO numbering
    (2026 week 1 = 29 Dec 2025 - 4 Jan 2026; week 23 = 1-7 June 2026).
The two days 27-28 Dec 2025 fall between the two systems; they belong to no reporting week.

Every week is identified by its START DATE, so joins never depend on week numbers.
"""
from __future__ import annotations

import datetime as dt

import pandas as pd

MONDAY_FROM = 2026


def _sat_week1(year: int) -> dt.date:
    jan2 = dt.date(year, 1, 2)
    return jan2 - dt.timedelta(days=(jan2.weekday() - 5) % 7)   # Saturday on/before 2 Jan


def week_start(year: int, week: int) -> dt.date:
    if year >= MONDAY_FROM:
        return dt.date.fromisocalendar(year, week, 1)
    return _sat_week1(year) + dt.timedelta(weeks=week - 1)


def week_end(year: int, week: int) -> dt.date:
    return week_start(year, week) + dt.timedelta(days=6)


def weeks_in_year(year: int) -> int:
    if year >= MONDAY_FROM:
        return dt.date(year, 12, 28).isocalendar()[1]

    # Source-verified WER exception: 28 Dec 2019-3 Jan 2020
    # is explicitly labelled 2019 Week 53 in the archived report.
    if year == 2019:
        return 53

    nxt = dt.date.fromisocalendar(year + 1, 1, 1) - dt.timedelta(days=2) if year + 1 >= MONDAY_FROM \
        else _sat_week1(year + 1)
    return (nxt - _sat_week1(year)).days // 7


def week_of(d: dt.date) -> tuple[int, int] | None:
    """Return the WER year/week for a date; 27-28 Dec 2025 are unassigned."""
    if isinstance(d, pd.Timestamp):
        d = d.date()

    # Explicit transition gap between the historical and ISO calendars.
    if dt.date(2025, 12, 27) <= d <= dt.date(2025, 12, 28):
        return None

    iso_start = dt.date.fromisocalendar(MONDAY_FROM, 1, 1)

    # From 2026 onward, use the ISO Monday-Sunday calendar.
    if d >= iso_start:
        y, w, _ = d.isocalendar()
        return y, w

    # Source-verified exception: the WER explicitly labels
    # 28 Dec 2019-3 Jan 2020 as 2019 Week 53.
    if dt.date(2019, 12, 28) <= d <= dt.date(2020, 1, 3):
        return 2019, 53

    # Historical WER periods run Saturday-Friday.
    # Prefer the latest year whose week start contains this date.
    for y in (d.year + 1, d.year, d.year - 1):
        if y >= MONDAY_FROM:
            continue

        start = _sat_week1(y)
        week = (d - start).days // 7 + 1
        if week < 1:
            continue

        period_start = week_start(y, week)
        period_end = week_end(y, week)

        if period_start <= d <= period_end:
            if week <= weeks_in_year(y):
                return y, week

    return None


def weeks_table(first_year: int = 2007, last_date: dt.date | None = None) -> pd.DataFrame:
    """One row per reporting week: year, week, start, end, t (global consecutive index)."""
    last_date = last_date or dt.date.today()
    rows = []
    y = first_year
    while True:
        for w in range(1, weeks_in_year(y) + 1):
            s = week_start(y, w)

            # The source-verified 2019 W53 already represents
            # 28 Dec 2019-3 Jan 2020. Do not generate an overlapping
            # 2020 W1 for the same period.
            if (y, w) == (2020, 1):
                continue

            if s > last_date:
                df = pd.DataFrame(rows, columns=["year", "week", "start", "end"])
                df["start"] = pd.to_datetime(df.start)
                df["end"] = pd.to_datetime(df.end)
                df["t"] = range(len(df))
                return df
            rows.append((y, w, s, s + dt.timedelta(days=6)))
        y += 1
