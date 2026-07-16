"""Scholarship calculation logic.

Kept isolated from the request handlers so the real formulas can be
dropped in later without touching routing/persistence code.
"""


def calculate_attendance_stipend(study_hours, excluded_hours):
    # TODO: replace with the real attendance-stipend formula.
    return 100.0


def calculate_total_stipend(attendance_amount, with_american, emuna_tanach, ktiva, gemara_bekiut):
    # TODO: replace with the real per-category amounts; for now the extras add nothing.
    base = attendance_amount or 0.0
    return base
