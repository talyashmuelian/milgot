"""PDF report generation.

Hebrew has no letter-shaping (unlike Arabic) but still needs the Unicode
bidi algorithm applied before handing text to reportlab, which only draws
characters left-to-right in the order given. `bidi.get_display` reorders
each string into its correct visual order; plain numbers are left alone
since they render correctly without reordering.
"""

import io
import os

from bidi import get_display
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Spacer

from months import MONTH_NAMES

FONT_NAME = "Hebrew"
_font_registered = False

_FONT_CANDIDATES = [
    r"C:\Windows\Fonts\arial.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansHebrew-Regular.ttf",  # PythonAnywhere
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


def build_record_pdf(avrech_name, year, month, record):
    _ensure_font()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=1.5 * cm, leftMargin=1.5 * cm)

    month_name = MONTH_NAMES[month - 1]
    title = f"פרטי מלגה - {avrech_name} - {month_name} {year}"

    header = [he("שדה"), he("ערך")]
    labels = [he("שם אברך")] + [he(h) for h in FIELD_HEADERS]
    values = [he(avrech_name)] + _record_fields(record)
    rows = [[label, value] for label, value in zip(labels, values)]

    story = [
        _title_table(title),
        Spacer(1, 0.5 * cm),
        _data_table(header, rows, [5 * cm, 8 * cm]),
    ]
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
