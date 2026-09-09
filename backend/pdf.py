"""PDF report generation.

Hebrew has no letter-shaping (unlike Arabic) but still needs the Unicode
bidi algorithm applied before handing text to reportlab, which only draws
characters left-to-right in the order given. `bidi.get_display` reorders
each string into its correct visual order; plain numbers are left alone
since they render correctly without reordering.
"""

import io
import os
import textwrap

from bidi import get_display
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from months import MONTH_NAMES

FONT_NAME = "Hebrew"
_font_registered = False

_FONT_CANDIDATES = [
    r"C:\Windows\Fonts\arial.ttf",
    # NotoSansHebrew-Regular.ttf on PythonAnywhere is a Hebrew-only subset with
    # NO digit glyphs (confirmed via fontTools) - numbers render as blank space.
    # DejaVu Sans has full coverage (digits, Hebrew, ₪, ״) - use it instead.
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
]


def _ensure_font():
    global _font_registered
    if _font_registered:
        return
    for path in _FONT_CANDIDATES:
        if os.path.exists(path):
            pdfmetrics.registerFont(TTFont(FONT_NAME, path))
            _font_registered = True
            return
    raise RuntimeError(
        "No Hebrew-capable TTF font found on this machine. "
        "Add a font path to _FONT_CANDIDATES in backend/pdf.py."
    )


def he(text):
    """Reorder a pure-Hebrew string into visual order for drawing."""
    return get_display(text)


def _hours(value):
    return "-" if value is None else f"{value:g}"


def _amount(value):
    return "-" if value is None else he(f'{value:g} ש"ח')


def _yesno(value):
    return he("כן") if value else he("לא")


def _percentage(value):
    return "-" if value is None else f"{value:g}%"


_NOTE_LABEL_STYLE = ParagraphStyle(
    "note-label", fontName=FONT_NAME, fontSize=10, alignment=TA_RIGHT, spaceAfter=2
)
_NOTE_TEXT_STYLE = ParagraphStyle(
    "note-text", fontName=FONT_NAME, fontSize=10, alignment=TA_RIGHT, leading=14
)


def _note_flowables(label, text):
    """A bold label followed by the note text, each line pre-wrapped and
    bidi-reordered individually so multi-line notes stay in the right order
    (wrapping the already-reordered text as one block would flip line order)."""
    lines = textwrap.wrap(str(text), width=60) or [""]
    html = "<br/>".join(he(line) for line in lines)
    return [
        Paragraph(f"<b>{he(label)}:</b>", _NOTE_LABEL_STYLE),
        Paragraph(html, _NOTE_TEXT_STYLE),
    ]


def _title_table(text, width=17 * cm):
    table = Table([[he(text)]], colWidths=[width])
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
                ("FONTSIZE", (0, 0), (-1, -1), 16),
                ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    return table


def _data_table(reading_order_header, reading_order_rows, col_widths, font_size=10):
    """Build a table where the first column in reading order ends up
    rightmost, matching how a Hebrew reader scans right-to-left."""
    header = list(reversed(reading_order_header))
    rows = [list(reversed(r)) for r in reading_order_rows]
    widths = list(reversed(col_widths))

    table = Table([header] + rows, colWidths=widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
                ("FONTSIZE", (0, 0), (-1, -1), font_size),
                ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0eefb")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def _record_fields(record):
    return [
        _hours(record.get("study_hours")),
        _hours(record.get("excluded_hours")),
        _amount(record.get("attendance_amount")),
        _yesno(record.get("with_american")),
        _yesno(record.get("emuna")),
        _yesno(record.get("tanach")),
        _yesno(record.get("ktiva")),
        _yesno(record.get("gemara_bekiut")),
        _yesno(record.get("review_test")),
        _yesno(record.get("enrichment")),
        _yesno(record.get("reserve_duty")),
        _amount(record.get("total_amount")),
    ]


FIELD_HEADERS = [
    "שעות לימוד",
    "שעות מוחרגות",
    "מלגת נוכחות",
    "עם אמריקאי",
    "אמונה",
    'תנ"ך',
    "כתיבה",
    "בקיאות",
    "מבחן חזרה",
    "העשרות",
    "מילואים",
    'סה"כ מלגה',
]

# before the row-label column; tuned to fit landscape A4 with 12 data columns
FIELD_WIDTHS = [w * cm for w in (1.8, 1.9, 2, 1.6, 1.3, 1.3, 1.3, 1.4, 1.7, 1.5, 1.5, 2)]


RECORD_MARGIN = 1.5 * cm
RECORD_CONTENT_WIDTH = A4[0] - 2 * RECORD_MARGIN
RECORD_LABEL_WIDTH = 5 * cm
RECORD_VALUE_WIDTH = RECORD_CONTENT_WIDTH - RECORD_LABEL_WIDTH


def _record_section_table(rows):
    """A 2-column key:value table for one payslip section, spanning the
    full page content width so its right edge lines up with the note
    paragraphs below it (label rightmost, value leftmost). Rows may mix
    plain (already-he'd) strings with Paragraph flowables (wrapped notes)."""
    table = Table(
        [list(reversed(r)) for r in rows], colWidths=[RECORD_VALUE_WIDTH, RECORD_LABEL_WIDTH]
    )
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


# The extras checkboxes shown on a payslip, in the same order as the
# calculator UI. Keep in sync with calculations.EXTRA_AMOUNTS ordering.
_EXTRA_SECTION_LABELS = [
    ("enrichment", "העשרות"),
    ("emuna", "אמונה"),
    ("tanach", 'תנ"ך'),
    ("review_test", "מבחן חזרה"),
    ("ktiva", "כתיבה"),
    ("gemara_bekiut", "גמרא בקיאות"),
    ("with_american", "לימוד עם אמריקאי"),
]


def build_record_pdf(avrech_name, year, month, record):
    """The per-avrech, per-month payslip ("תלוש"). Shows every part of the
    calculator - amounts, checkboxes, and any free text written in - except
    sections the user chose to hide for this specific record."""
    _ensure_font()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=RECORD_MARGIN, leftMargin=RECORD_MARGIN)

    month_name = MONTH_NAMES[month - 1]
    title = f"תלוש מלגה - {avrech_name} - {month_name} {year}"
    hidden = set(record.get("hidden_sections") or [])

    story = [_title_table(title, width=RECORD_CONTENT_WIDTH), Spacer(1, 0.4 * cm)]

    story.append(_record_section_table([[he("שם אברך"), he(avrech_name)]]))
    story.append(Spacer(1, 0.3 * cm))

    if "attendance" not in hidden:
        story.append(
            _record_section_table(
                [
                    [he("שעות לימוד"), _hours(record.get("study_hours"))],
                    [he("שעות מוחרגות"), _hours(record.get("excluded_hours"))],
                    [he("אחוז נוכחות"), _percentage(record.get("attendance_percentage"))],
                    [he("מלגת נוכחות"), _amount(record.get("attendance_amount"))],
                ]
            )
        )
        story.append(Spacer(1, 0.3 * cm))

    extras_rows = [
        [he(label), _yesno(record.get(key))]
        for key, label in _EXTRA_SECTION_LABELS
        if key not in hidden
    ]
    if extras_rows:
        story.append(_record_section_table(extras_rows))
        story.append(Spacer(1, 0.3 * cm))

    if "reserve_duty" not in hidden:
        story.append(_record_section_table([[he("מילואים"), _yesno(record.get("reserve_duty"))]]))
        story.append(Spacer(1, 0.3 * cm))

    if "regular_service" not in hidden:
        story.append(
            _record_section_table([[he("שירות צבאי סדיר"), _yesno(record.get("regular_service"))]])
        )
        story.append(Spacer(1, 0.3 * cm))

    if "special_arrangement" not in hidden:
        story.append(
            _record_section_table(
                [[he("הסדר מיוחד - סכום"), _amount(record.get("special_arrangement_amount"))]]
            )
        )
        if record.get("special_arrangement_note"):
            story.append(Spacer(1, 0.15 * cm))
            story.extend(_note_flowables("פירוט ההסדר", record["special_arrangement_note"]))
        story.append(Spacer(1, 0.3 * cm))

    if "bonus" not in hidden:
        story.append(
            _record_section_table([[he("בונוס - סכום"), _amount(record.get("bonus_amount"))]])
        )
        if record.get("bonus_note"):
            story.append(Spacer(1, 0.15 * cm))
            story.extend(_note_flowables("הערה לבונוס", record["bonus_note"]))
        story.append(Spacer(1, 0.3 * cm))

    if "manual_adjustment" not in hidden:
        story.append(
            _record_section_table(
                [[he("התאמה ידנית - סכום"), _amount(record.get("manual_adjustment_amount"))]]
            )
        )
        if record.get("manual_adjustment_note"):
            story.append(Spacer(1, 0.15 * cm))
            story.extend(_note_flowables("פירוט ההתאמה", record["manual_adjustment_note"]))
        story.append(Spacer(1, 0.3 * cm))

    if "notes" not in hidden and record.get("notes"):
        story.extend(_note_flowables("הערות חופשיות", record["notes"]))
        story.append(Spacer(1, 0.3 * cm))

    story.append(Spacer(1, 0.2 * cm))
    total_table = _record_section_table([[he('סה"כ מלגה'), _amount(record.get("total_amount"))]])
    total_table.setStyle(
        TableStyle([("FONTSIZE", (0, 0), (-1, -1), 13), ("FONTNAME", (0, 0), (-1, -1), FONT_NAME)])
    )
    story.append(total_table)

    doc.build(story)
    buf.seek(0)
    return buf


WIDE_PAGE_SIZE = landscape(A4)
WIDE_MARGIN = 1 * cm
WIDE_CONTENT_WIDTH = WIDE_PAGE_SIZE[0] - 2 * WIDE_MARGIN


def build_month_report_pdf(year, month, avreichim_records):
    """avreichim_records: list of (avrech_name, record_dict)"""
    _ensure_font()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=WIDE_PAGE_SIZE, rightMargin=WIDE_MARGIN, leftMargin=WIDE_MARGIN
    )

    month_name = MONTH_NAMES[month - 1]
    title = f'דוח מלגות לכל האברכים - {month_name} {year}'

    header = [he("שם אברך")] + [he(h) for h in FIELD_HEADERS]
    rows = [[he(name)] + _record_fields(record) for name, record in avreichim_records]

    story = [
        _title_table(title, width=WIDE_CONTENT_WIDTH),
        Spacer(1, 0.5 * cm),
        _data_table(header, rows, [3 * cm] + FIELD_WIDTHS, font_size=8),
    ]
    doc.build(story)
    buf.seek(0)
    return buf


def build_avrech_report_pdf(avrech_name, year, records_by_month):
    """records_by_month: list of 12 record dicts, index 0 = January"""
    _ensure_font()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=WIDE_PAGE_SIZE, rightMargin=WIDE_MARGIN, leftMargin=WIDE_MARGIN
    )

    title = f"דוח מלגות - {avrech_name} - שנת {year}"

    header = [he("חודש")] + [he(h) for h in FIELD_HEADERS]
    rows = [
        [he(MONTH_NAMES[i])] + _record_fields(records_by_month[i])
        for i in range(12)
    ]

    story = [
        _title_table(title, width=WIDE_CONTENT_WIDTH),
        Spacer(1, 0.5 * cm),
        _data_table(header, rows, [2.5 * cm] + FIELD_WIDTHS, font_size=8),
    ]
    doc.build(story)
    buf.seek(0)
    return buf
