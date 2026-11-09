import datetime as dt
import pandas as pd
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "src"))

from leptowatch import epicalendar


def test_historical_week_53_source_period_2019():
    # Explicitly printed in the 2020 WER report:
    # 28 Dec 2019 - 3 Jan 2020 (53rd Week).
    assert epicalendar.week_start(2019, 53) == dt.date(2019, 12, 28)
    assert epicalendar.week_end(2019, 53) == dt.date(2020, 1, 3)


def test_saturday_calendar_weeks_are_seven_days_apart():
    years = [2008, 2009, 2010, 2016, 2017, 2019, 2020, 2021, 2022, 2023]
    for year in years:
        n = epicalendar.weeks_in_year(year)
        for week in range(1, n):
            assert (
                epicalendar.week_start(year, week + 1)
                - epicalendar.week_start(year, week)
            ).days == 7


def test_historical_week_53_does_not_get_lost_by_week_of():
    # The reported period starts Saturday 28 Dec 2019.
    assert epicalendar.week_of(dt.date(2019, 12, 28)) == (2019, 53)


def test_2026_switches_to_iso_monday_weeks():
    assert epicalendar.week_start(2026, 1) == dt.date(2025, 12, 29)
    assert epicalendar.week_end(2026, 1) == dt.date(2026, 1, 4)


def test_weeks_table_matches_source_verified_2019_week_53():
    # The archived WER labels 28 Dec 2019-3 Jan 2020 as 2019 W53.
    calendar = epicalendar.weeks_table(
        first_year=2019,
        last_date=dt.date(2020, 1, 10),
    )

    row = calendar[calendar["start"] == pd.Timestamp("2019-12-28")]
    assert len(row) == 1
    assert int(row.iloc[0]["year"]) == 2019
    assert int(row.iloc[0]["week"]) == 53

    next_row = calendar[calendar["start"] == pd.Timestamp("2020-01-04")]
    assert len(next_row) == 1
    assert int(next_row.iloc[0]["year"]) == 2020
    assert int(next_row.iloc[0]["week"]) == 2
