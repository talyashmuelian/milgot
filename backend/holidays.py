"""Business-day calculation for a Gregorian month, Israeli-kollel style:
Fridays, Saturdays, Yom Tov days and their eves don't count.

Chol Hamoed, fasts and minor holidays (Purim, Chanukah, Tu B'Shvat, ...)
are deliberately NOT excluded here - the suggested value is a starting
point and the user edits the hours field by hand for anything else.
"""

import calendar
import datetime

from pyluach.dates import GregorianDate

FRIDAY = 4
SATURDAY = 5

# (hebrew_month, hebrew_day) -> Hebrew label, for the true Yom Tov days
# (pyluach month numbers: Nissan=1 ... Elul=6, Tishrei=7 ... Adar=12/13)
YOM_TOV_DATES = {
    (7, 1): "ראש השנה",
    (7, 2): "ראש השנה",
    (7, 10): "יום כיפור",
    (7, 15): "סוכות",
    (7, 22): "שמחת תורה",
    (1, 15): "פסח",
    (1, 21): "שביעי של פסח",
    (3, 6): "שבועות",
}


def _hebrew_key(date):
    h = GregorianDate(date.year, date.month, date.day).to_heb()
    return (h.month, h.day)


def month_calendar(year, month):
    """Returns per-day info plus a suggested-hours total for the month."""
    days_in_month = calendar.monthrange(year, month)[1]

    days = []
    business_days = 0

    for day_num in range(1, days_in_month + 1):
        date = datetime.date(year, month, day_num)
        next_date = date + datetime.timedelta(days=1)

        weekday = date.weekday()  # Monday=0 ... Sunday=6
        is_weekend = weekday in (FRIDAY, SATURDAY)

        yomtov_label = YOM_TOV_DATES.get(_hebrew_key(date))
        is_yomtov = yomtov_label is not None

        is_erev = _hebrew_key(next_date) in YOM_TOV_DATES and not is_yomtov

        other_label = None
        if not is_yomtov:
            other_label = GregorianDate(year, month, day_num).to_heb().holiday(
                israel=True, hebrew=True
            )

        is_business_day = not (is_weekend or is_yomtov or is_erev)
        if is_business_day:
            business_days += 1

        days.append(
            {
                "date": date.isoformat(),
                "weekday": weekday,
                "is_weekend": is_weekend,
                "is_yomtov": is_yomtov,
                "is_erev": is_erev,
                "label": yomtov_label or other_label,
            }
        )

    return {
        "days": days,
        "business_days": business_days,
        "suggested_hours": business_days * 8,
    }
