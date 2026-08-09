import datetime
import json
import os

from flask import Flask, Response, jsonify, request, send_file, send_from_directory
from flask_cors import CORS
from sqlalchemy import inspect, text

from calculations import EXTRA_FIELDS, calculate_attendance_stipend, calculate_total_stipend
from excel import build_avrech_report_xlsx, build_month_report_xlsx
from holidays import month_calendar
from models import Avrech, DayExclusion, MonthHours, MonthlyRecord, db
from pdf import build_avrech_report_pdf, build_month_report_pdf, build_record_pdf

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIST = os.path.join(BASE_DIR, "..", "frontend", "dist")

# Flask/Werkzeug guess static-file content types via Python's mimetypes module,
# which on Windows reads the registry - some machines have ".js" mapped to
# text/plain there, which makes browsers refuse to run <script type="module">.
# Serving the frontend build ourselves with an explicit table sidesteps that.
STATIC_MIME_TYPES = {
    ".js": "application/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".json": "application/json",
    ".png": "image/png",
    ".ico": "image/vnd.microsoft.icon",
}

app = Flask(__name__, static_folder=None)
CORS(app)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(BASE_DIR, "milgot.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)


def _ensure_columns():
    """Add columns introduced after the DB file already existed (SQLite ADD COLUMN)."""
    inspector = inspect(db.engine)
    avrech_cols = {c["name"] for c in inspector.get_columns("avreichim")}
    record_cols = {c["name"] for c in inspector.get_columns("monthly_records")}

    with db.engine.begin() as conn:
        if "children_count" not in avrech_cols:
            conn.execute(text("ALTER TABLE avreichim ADD COLUMN children_count INTEGER NOT NULL DEFAULT 0"))
        if "archived" not in avrech_cols:
            conn.execute(text("ALTER TABLE avreichim ADD COLUMN archived BOOLEAN NOT NULL DEFAULT 0"))
        for col in ("emuna", "tanach", "review_test", "enrichment", "reserve_duty", "regular_service"):
            if col not in record_cols:
                conn.execute(text(f"ALTER TABLE monthly_records ADD COLUMN {col} BOOLEAN NOT NULL DEFAULT 0"))
        for col in (
            "special_arrangement_amount",
            "bonus_amount",
            "manual_adjustment_amount",
        ):
            if col not in record_cols:
                conn.execute(text(f"ALTER TABLE monthly_records ADD COLUMN {col} FLOAT"))
        for col in (
            "special_arrangement_note",
            "bonus_note",
            "manual_adjustment_note",
            "notes",
        ):
            if col not in record_cols:
                conn.execute(text(f"ALTER TABLE monthly_records ADD COLUMN {col} TEXT"))


with app.app_context():
    db.create_all()
    _ensure_columns()


# ---------- Frontend (built React app, if present) ----------

@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIST, "index.html")


@app.get("/<path:filename>")
def frontend_asset(filename):
    ext = os.path.splitext(filename)[1]
    return send_from_directory(FRONTEND_DIST, filename, mimetype=STATIC_MIME_TYPES.get(ext))


# ---------- Avreichim (students) ----------

@app.get("/api/avreichim")
def list_avreichim():
    avreichim = Avrech.query.filter_by(archived=False).order_by(Avrech.name).all()
    return jsonify([a.to_dict() for a in avreichim])


@app.get("/api/avreichim/archived")
def list_archived_avreichim():
    avreichim = Avrech.query.filter_by(archived=True).order_by(Avrech.name).all()
    return jsonify([a.to_dict() for a in avreichim])


@app.post("/api/avreichim")
def create_avrech():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    children_count = int(data.get("children_count") or 0)
    avrech = Avrech(name=name, children_count=children_count)
    db.session.add(avrech)
    db.session.commit()
    return jsonify(avrech.to_dict()), 201


@app.put("/api/avreichim/<int:avrech_id>")
def update_avrech(avrech_id):
    avrech = Avrech.query.get_or_404(avrech_id)
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    avrech.name = name
    avrech.children_count = int(data.get("children_count") or 0)
    db.session.commit()
    return jsonify(avrech.to_dict())


@app.post("/api/avreichim/<int:avrech_id>/archive")
def archive_avrech(avrech_id):
    avrech = Avrech.query.get_or_404(avrech_id)
    avrech.archived = True
    db.session.commit()
    return jsonify(avrech.to_dict())


@app.post("/api/avreichim/<int:avrech_id>/unarchive")
def unarchive_avrech(avrech_id):
    avrech = Avrech.query.get_or_404(avrech_id)
    avrech.archived = False
    db.session.commit()
    return jsonify(avrech.to_dict())


@app.delete("/api/avreichim/<int:avrech_id>")
def delete_avrech(avrech_id):
    """Permanent delete - only reachable from the archive in the UI."""
    avrech = Avrech.query.get_or_404(avrech_id)
    MonthlyRecord.query.filter_by(avrech_id=avrech_id).delete()
    db.session.delete(avrech)
    db.session.commit()
    return "", 204


# ---------- Monthly records ----------

def _get_or_create_record(avrech_id, year, month):
    record = MonthlyRecord.query.filter_by(avrech_id=avrech_id, year=year, month=month).first()
    if record is None:
        record = MonthlyRecord(avrech_id=avrech_id, year=year, month=month)
        db.session.add(record)
    return record


def _empty_record(avrech_id, year, month):
    return {
        "avrech_id": avrech_id,
        "year": year,
        "month": month,
        "study_hours": None,
        "excluded_hours": None,
        "attendance_amount": None,
        "with_american": False,
        "emuna": False,
        "tanach": False,
        "ktiva": False,
        "gemara_bekiut": False,
        "review_test": False,
        "enrichment": False,
        "reserve_duty": False,
        "regular_service": False,
        "special_arrangement_amount": None,
        "special_arrangement_note": None,
        "bonus_amount": None,
        "bonus_note": None,
        "manual_adjustment_amount": None,
        "manual_adjustment_note": None,
        "notes": None,
        "total_amount": None,
    }


@app.get("/api/records/<int:avrech_id>/<int:year>/<int:month>")
def get_record(avrech_id, year, month):
    record = MonthlyRecord.query.filter_by(avrech_id=avrech_id, year=year, month=month).first()
    if record is None:
        return jsonify(_empty_record(avrech_id, year, month))
    return jsonify(record.to_dict())


def _month_calendar_with_exclusions(year, month):
    """month_calendar() plus manual per-day exclusions folded into each
    day's info and into a recalculated suggested_hours total."""
    data = month_calendar(year, month)
    dates = [datetime.date.fromisoformat(d["date"]) for d in data["days"]]
    exclusion_rows = DayExclusion.query.filter(DayExclusion.date.in_(dates)).all()
    exclusions = {e.date.isoformat(): e.excluded_hours for e in exclusion_rows}

    total = 0.0
    for day in data["days"]:
        is_business = not (day["is_weekend"] or day["is_yomtov"] or day["is_erev"])
        base = 8 if is_business else 0
        excl = exclusions.get(day["date"])
        day["excluded_hours"] = excl
        total += max(0, base - (excl or 0))

    data["suggested_hours"] = total
    return data


def _expected_hours(year, month):
    override = MonthHours.query.filter_by(year=year, month=month).first()
    if override:
        return override.hours
    return _month_calendar_with_exclusions(year, month)["suggested_hours"]


@app.post("/api/records/<int:avrech_id>/<int:year>/<int:month>/attendance")
def calculate_attendance(avrech_id, year, month):
    avrech = Avrech.query.get_or_404(avrech_id)
    data = request.get_json(force=True)
    study_hours = data.get("study_hours")
    excluded_hours = data.get("excluded_hours")

    record = _get_or_create_record(avrech_id, year, month)
    record.study_hours = study_hours
    record.excluded_hours = excluded_hours
    record.attendance_amount = calculate_attendance_stipend(
        study_hours, excluded_hours, _expected_hours(year, month), avrech.children_count
    )
    db.session.commit()
    return jsonify(record.to_dict())


@app.post("/api/records/<int:avrech_id>/<int:year>/<int:month>/total")
def calculate_total(avrech_id, year, month):
    Avrech.query.get_or_404(avrech_id)
    data = request.get_json(force=True)

    record = _get_or_create_record(avrech_id, year, month)
    for field in EXTRA_FIELDS:
        setattr(record, field, bool(data.get(field)))
    record.reserve_duty = bool(data.get("reserve_duty"))
    record.regular_service = bool(data.get("regular_service"))
    record.special_arrangement_amount = data.get("special_arrangement_amount")
    record.special_arrangement_note = data.get("special_arrangement_note")
    record.bonus_amount = data.get("bonus_amount")
    record.bonus_note = data.get("bonus_note")
    record.manual_adjustment_amount = data.get("manual_adjustment_amount")
    record.manual_adjustment_note = data.get("manual_adjustment_note")
    record.notes = data.get("notes")

    extras = {field: getattr(record, field) for field in EXTRA_FIELDS}
    record.total_amount = calculate_total_stipend(
        record.attendance_amount,
        extras,
        record.reserve_duty,
        record.regular_service,
        record.special_arrangement_amount,
        record.bonus_amount,
        record.manual_adjustment_amount,
    )
    db.session.commit()
    return jsonify(record.to_dict())


# ---------- Reports (PDF / Excel / JSON) ----------

def _month_report_rows(year, month):
    """list of (avrech_name, record_dict), one per non-archived avrech, ordered by name."""
    avreichim = Avrech.query.filter_by(archived=False).order_by(Avrech.name).all()
    records_by_avrech = {
        r.avrech_id: r
        for r in MonthlyRecord.query.filter_by(year=year, month=month).all()
    }
    return [
        (
            a.name,
            records_by_avrech[a.id].to_dict()
            if a.id in records_by_avrech
            else _empty_record(a.id, year, month),
        )
        for a in avreichim
    ]


def _avrech_report_rows(avrech_id, year):
    """list of 12 record dicts for one avrech, index 0 = January."""
    records_by_month = {
        r.month: r
        for r in MonthlyRecord.query.filter_by(avrech_id=avrech_id, year=year).all()
    }
    return [
        records_by_month[m].to_dict() if m in records_by_month else _empty_record(avrech_id, year, m)
        for m in range(1, 13)
    ]


@app.get("/api/records/<int:avrech_id>/<int:year>/<int:month>/pdf")
def record_pdf(avrech_id, year, month):
    avrech = Avrech.query.get_or_404(avrech_id)
    record = MonthlyRecord.query.filter_by(avrech_id=avrech_id, year=year, month=month).first()
    record_data = record.to_dict() if record else _empty_record(avrech_id, year, month)

    buf = build_record_pdf(avrech.name, year, month, record_data)
    filename = f"avrech_{avrech_id}_{year}_{month:02d}.pdf"
    return send_file(buf, mimetype="application/pdf", as_attachment=True, download_name=filename)


@app.get("/api/reports/month/<int:year>/<int:month>")
def month_report_json(year, month):
    rows = _month_report_rows(year, month)
    return jsonify([{"name": name, **record} for name, record in rows])


@app.get("/api/reports/month/<int:year>/<int:month>/pdf")
def month_report_pdf(year, month):
    rows = _month_report_rows(year, month)
    buf = build_month_report_pdf(year, month, rows)
    filename = f"month_report_{year}_{month:02d}.pdf"
    return send_file(buf, mimetype="application/pdf", as_attachment=True, download_name=filename)


@app.get("/api/reports/month/<int:year>/<int:month>/xlsx")
def month_report_xlsx(year, month):
    rows = _month_report_rows(year, month)
    buf = build_month_report_xlsx(year, month, rows)
    filename = f"month_report_{year}_{month:02d}.xlsx"
    return send_file(
        buf,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename,
    )


@app.get("/api/reports/avrech/<int:avrech_id>/<int:year>")
def avrech_report_json(avrech_id, year):
    avrech = Avrech.query.get_or_404(avrech_id)
    rows = _avrech_report_rows(avrech_id, year)
    return jsonify({"avrech_name": avrech.name, "months": rows})


@app.get("/api/reports/avrech/<int:avrech_id>/<int:year>/pdf")
def avrech_report_pdf(avrech_id, year):
    avrech = Avrech.query.get_or_404(avrech_id)
    rows = _avrech_report_rows(avrech_id, year)
    buf = build_avrech_report_pdf(avrech.name, year, rows)
    filename = f"avrech_report_{avrech_id}_{year}.pdf"
    return send_file(buf, mimetype="application/pdf", as_attachment=True, download_name=filename)


@app.get("/api/reports/avrech/<int:avrech_id>/<int:year>/xlsx")
def avrech_report_xlsx(avrech_id, year):
    avrech = Avrech.query.get_or_404(avrech_id)
    rows = _avrech_report_rows(avrech_id, year)
    buf = build_avrech_report_xlsx(avrech.name, year, rows)
    filename = f"avrech_report_{avrech_id}_{year}.xlsx"
    return send_file(
        buf,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename,
    )


# ---------- Calendar / month hours ----------

@app.get("/api/calendar/<int:year>/<int:month>")
def get_calendar(year, month):
    data = _month_calendar_with_exclusions(year, month)
    override = MonthHours.query.filter_by(year=year, month=month).first()
    data["saved_hours"] = override.hours if override else None
    return jsonify(data)


@app.put("/api/calendar/<int:year>/<int:month>/hours")
def save_calendar_hours(year, month):
    data = request.get_json(force=True)
    hours = data.get("hours")
    if hours is None:
        return jsonify({"error": "hours is required"}), 400

    override = MonthHours.query.filter_by(year=year, month=month).first()
    if override is None:
        override = MonthHours(year=year, month=month, hours=hours)
        db.session.add(override)
    else:
        override.hours = hours
    db.session.commit()
    return jsonify({"year": year, "month": month, "hours": override.hours})


@app.put("/api/day-exclusions/<date_str>")
def set_day_exclusion(date_str):
    try:
        date_obj = datetime.date.fromisoformat(date_str)
    except ValueError:
        return jsonify({"error": "invalid date"}), 400

    data = request.get_json(force=True)
    hours = data.get("excluded_hours")
    if hours is None:
        return jsonify({"error": "excluded_hours is required"}), 400

    exclusion = DayExclusion.query.filter_by(date=date_obj).first()
    if exclusion is None:
        exclusion = DayExclusion(date=date_obj, excluded_hours=hours)
        db.session.add(exclusion)
    else:
        exclusion.excluded_hours = hours
    db.session.commit()
    return jsonify(exclusion.to_dict())


@app.delete("/api/day-exclusions/<date_str>")
def delete_day_exclusion(date_str):
    try:
        date_obj = datetime.date.fromisoformat(date_str)
    except ValueError:
        return jsonify({"error": "invalid date"}), 400

    DayExclusion.query.filter_by(date=date_obj).delete()
    db.session.commit()
    return "", 204


# ---------- Backup / restore ----------

@app.get("/api/backup")
def backup():
    avreichim = Avrech.query.all()
    records = MonthlyRecord.query.all()
    month_hours = MonthHours.query.all()
    exclusions = DayExclusion.query.all()

    data = {
        "version": 1,
        "exported_at": datetime.datetime.utcnow().isoformat() + "Z",
        "avreichim": [
            {"id": a.id, "name": a.name, "children_count": a.children_count, "archived": a.archived}
            for a in avreichim
        ],
        "monthly_records": [r.to_dict() for r in records],
        "month_hours": [{"year": mh.year, "month": mh.month, "hours": mh.hours} for mh in month_hours],
        "day_exclusions": [e.to_dict() for e in exclusions],
    }

    payload = json.dumps(data, ensure_ascii=False, indent=2)
    filename = f"milgot_backup_{datetime.date.today().isoformat()}.json"
    return Response(
        payload,
        mimetype="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.post("/api/restore")
def restore():
    data = request.get_json(force=True)
    if not isinstance(data, dict) or "avreichim" not in data or "monthly_records" not in data:
        return jsonify({"error": "קובץ הגיבוי לא תקין"}), 400

    try:
        MonthlyRecord.query.delete()
        DayExclusion.query.delete()
        MonthHours.query.delete()
        Avrech.query.delete()

        for a in data["avreichim"]:
            db.session.add(
                Avrech(
                    id=a["id"],
                    name=a["name"],
                    children_count=a.get("children_count", 0),
                    archived=bool(a.get("archived", False)),
                )
            )

        for r in data["monthly_records"]:
            db.session.add(
                MonthlyRecord(
                    avrech_id=r["avrech_id"],
                    year=r["year"],
                    month=r["month"],
                    study_hours=r.get("study_hours"),
                    excluded_hours=r.get("excluded_hours"),
                    attendance_amount=r.get("attendance_amount"),
                    with_american=bool(r.get("with_american")),
                    emuna=bool(r.get("emuna")),
                    tanach=bool(r.get("tanach")),
                    ktiva=bool(r.get("ktiva")),
                    gemara_bekiut=bool(r.get("gemara_bekiut")),
                    review_test=bool(r.get("review_test")),
                    enrichment=bool(r.get("enrichment")),
                    reserve_duty=bool(r.get("reserve_duty")),
                    regular_service=bool(r.get("regular_service")),
                    special_arrangement_amount=r.get("special_arrangement_amount"),
                    special_arrangement_note=r.get("special_arrangement_note"),
                    bonus_amount=r.get("bonus_amount"),
                    bonus_note=r.get("bonus_note"),
                    manual_adjustment_amount=r.get("manual_adjustment_amount"),
                    manual_adjustment_note=r.get("manual_adjustment_note"),
                    notes=r.get("notes"),
                    total_amount=r.get("total_amount"),
                )
            )

        for mh in data.get("month_hours", []):
            db.session.add(MonthHours(year=mh["year"], month=mh["month"], hours=mh["hours"]))

        for e in data.get("day_exclusions", []):
            db.session.add(
                DayExclusion(date=datetime.date.fromisoformat(e["date"]), excluded_hours=e["excluded_hours"])
            )

        db.session.commit()
    except (KeyError, ValueError, TypeError) as exc:
        db.session.rollback()
        return jsonify({"error": f"קובץ הגיבוי לא תקין: {exc}"}), 400

    return jsonify(
        {
            "status": "restored",
            "avreichim": len(data["avreichim"]),
            "monthly_records": len(data["monthly_records"]),
        }
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
