"""Non-destructive validation of printed WER end dates."""

from datetime import date
import re


def validate_printed_end(title_end, stored_week_end, report_year=None):
    """Return match, mismatch, or unverified for a printed day/month.

    title_end must be in day/month form, such as '26/8'.
    stored_week_end must be a date or ISO date string.
    This validates only the end date, not the full printed range.
    """
    if title_end is None or stored_week_end is None:
        return "unverified"

    raw = str(title_end).strip()
    match = re.fullmatch(r"(\d{1,2})/(\d{1,2})", raw)
    if not match:
        return "unverified"

    try:
        day, month = map(int, match.groups())

        if isinstance(stored_week_end, date):
            stored_end = stored_week_end
        else:
            stored_end = date.fromisoformat(str(stored_week_end)[:10])

        # The year is not stored in title_end. Use the stored calendar
        # year as the comparison year, and mark ambiguous year boundaries
        # as unverified rather than guessing.
        if month == 12 and stored_end.month == 1:
            return "unverified"
        if month == 1 and stored_end.month == 12:
            return "unverified"

        printed_end = date(stored_end.year, month, day)
    except (ValueError, TypeError, OverflowError):
        return "unverified"

    return "match" if printed_end == stored_end else "mismatch"
