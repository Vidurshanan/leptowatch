import datetime as dt
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "src"))

from leptowatch.data.source_date_validation import validate_printed_end


def test_matching_end_date():
    assert validate_printed_end(
        "26/9", dt.date(2008, 9, 26)
    ) == "match"


def test_month_mismatch():
    assert validate_printed_end(
        "26/8", dt.date(2008, 9, 26)
    ) == "mismatch"


def test_day_mismatch():
    assert validate_printed_end(
        "25/4", dt.date(2009, 4, 24)
    ) == "mismatch"


def test_invalid_or_missing_dates_are_unverified():
    assert validate_printed_end(
        "", dt.date(2020, 1, 3)
    ) == "unverified"

    assert validate_printed_end(
        "not-a-date", dt.date(2020, 1, 3)
    ) == "unverified"

    assert validate_printed_end(
        "3/1", None
    ) == "unverified"


def test_year_boundary_is_unverified():
    assert validate_printed_end(
        "1/1", dt.date(2025, 12, 26)
    ) == "unverified"
