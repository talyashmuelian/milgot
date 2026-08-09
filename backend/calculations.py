"""Scholarship calculation logic, kept isolated from routing/persistence.

Attendance stipend: a step function of attendance percentage
(study_hours / (expected_hours - excluded_hours)). An avrech with 3+
children gets the top two thresholds lowered by 5 points. Below the
lowest threshold, the stipend is 0.

Extras: each checked item adds a fixed amount on top of the attendance
stipend.

Regular military service (שירות צבאי סדיר): overrides everything -
total is 0, no exceptions (not even the bonus/arrangement/adjustment
below).

Reserve duty (מילואים): overrides the attendance+extras calculation
with a flat amount, but the special-arrangement/bonus/manual-adjustment
line items below still stack on top of it.

Special arrangement / bonus / manual adjustment: three independent
optional line items that add on top of whatever base applies (normal
attendance+extras, or the flat reserve-duty amount). Only the manual
adjustment is expected to ever be negative.
"""

ATTENDANCE_TIERS = [
    (0.80, 4300.0),
    (0.70, 3900.0),
    (0.60, 3100.0),
    (0.50, 2500.0),
]

ATTENDANCE_TIERS_MANY_CHILDREN = [
    (0.75, 4300.0),
    (0.65, 3900.0),
    (0.60, 3100.0),
    (0.50, 2500.0),
]

MANY_CHILDREN_THRESHOLD = 3

EXTRA_AMOUNTS = {
    "enrichment": 500.0,
    "emuna": 100.0,
    "tanach": 100.0,
    "review_test": 100.0,
    "ktiva": 100.0,
    "gemara_bekiut": 100.0,
    "with_american": 100.0,
}
EXTRA_FIELDS = list(EXTRA_AMOUNTS.keys())

RESERVE_DUTY_AMOUNT = 500.0


def calculate_attendance_stipend(study_hours, excluded_hours, expected_hours, children_count):
    if not expected_hours:
        return 0.0
    denominator = expected_hours - (excluded_hours or 0)
    if denominator <= 0:
        return 0.0

    percentage = (study_hours or 0) / denominator
    tiers = (
        ATTENDANCE_TIERS_MANY_CHILDREN
        if (children_count or 0) >= MANY_CHILDREN_THRESHOLD
        else ATTENDANCE_TIERS
    )
    for threshold, amount in tiers:
        if percentage >= threshold:
            return amount
    return 0.0


def calculate_total_stipend(
    attendance_amount,
    extras,
    reserve_duty,
    regular_service,
    special_arrangement_amount,
    bonus_amount,
    manual_adjustment_amount,
):
    if regular_service:
        return 0.0

    if reserve_duty:
        base = RESERVE_DUTY_AMOUNT
    else:
        extras_total = sum(EXTRA_AMOUNTS[key] for key, checked in extras.items() if checked)
        base = (attendance_amount or 0.0) + extras_total

    return (
        base
        + (special_arrangement_amount or 0.0)
        + (bonus_amount or 0.0)
        + (manual_adjustment_amount or 0.0)
    )
