"""Regression tests documenting historical WER date discrepancies.

These tests preserve the current calendar behavior while documenting
source dates that require review. They do not correct historical records.
"""
import datetime as dt
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "src"))

from leptowatch import epicalendar
from leptowatch.data.wer_parse import TITLE_END, MONTHS


def parse_printed_end(line):
    """Extract the printed end day, month and epidemiological week."""
    match = TITLE_END.search(line)
    if not match:
        return None

    return (
        int(match.group(1)),
        MONTHS[match.group(2)[:3].lower()],
        int(match.group(3)),
    )


def test_historical_source_dates_are_extracted_verbatim():
    cases = [
        ("20th - 26th August 2008 (39th Week)", (26, 8, 39)),
        ("18th April – 25th April 2009 (17th Week)", (25, 4, 17)),
        ("26th April – 02nd May 2009 (18th Week)", (2, 5, 18)),
        ("28th August - 03rd September 2010(34th Week)", (3, 9, 34)),
        ("12th – 19th November 2011 (46th Week)", (19, 11, 46)),
        ("12th – 18th April 2012 (20th Week)", (18, 4, 20)),
        ("06th – 12th May 2009 (24th Week)", (12, 5, 24)),
    ]

    for printed_line, expected in cases:
        assert parse_printed_end(printed_line) == expected


def test_calendar_values_remain_unchanged_pending_source_review():
    # These are the current calendar outputs, not claims that every
    # output agrees with the original PDF.
    assert epicalendar.week_start(2008, 39) == dt.date(2008, 9, 20)
    assert epicalendar.week_end(2008, 39) == dt.date(2008, 9, 26)

    assert epicalendar.week_start(2009, 17) == dt.date(2009, 4, 18)
    assert epicalendar.week_end(2009, 17) == dt.date(2009, 4, 24)

    assert epicalendar.week_start(2010, 34) == dt.date(2010, 8, 21)
    assert epicalendar.week_end(2010, 34) == dt.date(2010, 8, 27)

    assert epicalendar.week_start(2011, 46) == dt.date(2011, 11, 12)
    assert epicalendar.week_end(2011, 46) == dt.date(2011, 11, 18)

    assert epicalendar.week_start(2012, 20) == dt.date(2012, 5, 12)
    assert epicalendar.week_end(2012, 20) == dt.date(2012, 5, 18)


def test_end_date_check_does_not_validate_the_full_printed_range():
    # A printed range ending on the expected date can still have
    # an incorrect starting date. The current check only compares
    # the ending day and month.
    expected_end = dt.date(2009, 4, 24)
    printed_start = dt.date(2009, 4, 17)
    printed_end = dt.date(2009, 4, 24)

    current_date_ok = (
        printed_end.day == expected_end.day
        and printed_end.month == expected_end.month
    )

    assert current_date_ok is True
    assert printed_start != dt.date(2009, 4, 18)


def test_known_historical_discrepancies_are_documented():
    # Expected calendar dates versus the dates observed in the source PDFs.
    # These assertions document discrepancies; they do not correct records.
    cases = [
        (
            dt.date(2008, 9, 20),
            dt.date(2008, 9, 26),
            dt.date(2008, 8, 20),
            dt.date(2008, 8, 26),
        ),
        (
            dt.date(2010, 8, 21),
            dt.date(2010, 8, 27),
            dt.date(2010, 8, 28),
            dt.date(2010, 9, 3),
        ),
        (
            dt.date(2012, 5, 12),
            dt.date(2012, 5, 18),
            dt.date(2012, 4, 12),
            dt.date(2012, 4, 18),
        ),
    ]

    for stored_start, stored_end, source_start, source_end in cases:
        assert stored_start <= stored_end
        assert source_start <= source_end
        assert (stored_start, stored_end) != (source_start, source_end)
