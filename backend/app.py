import os

from flask import Flask, jsonify, request, send_file, send_from_directory
from flask_cors import CORS

from calculations import calculate_attendance_stipend, calculate_total_stipend
from holidays import month_calendar
from models import Avrech, MonthHours, MonthlyRecord, db
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

with app.app_context():
    db.create_all()


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
    avreichim = Avrech.query.order_by(Avrech.name).all()
    return jsonify([a.to_dict() for a in avreichim])


@app.post("/api/avreichim")
def create_avrech():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    avrech = Avrech(name=name)
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
    db.session.commit()
    return jsonify(avrech.to_dict())


@app.delete("/api/avreichim/<int:avrech_id>")
def delete_avrech(avrech_id):
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
        "emuna_tanach": False,
        "ktiva": False,
        "gemara_bekiut": False,
        "total_amount": None,
    }


@app.get("/api/records/<int:avrech_id>/<int:year>/<int:month>")
def get_record(avrech_id, year, month):
    record = MonthlyRecord.query.filter_by(avrech_id=avrech_id, year=year, month=month).first()
    if record is None:
        return jsonify(_empty_record(avrech_id, year, month))
    return jsonify(record.to_dict())


@app.post("/api/records/<int:avrech_id>/<int:year>/<int:month>/attendance")
def calculate_attendance(avrech_id, year, month):
    Avrech.query.get_or_404(avrech_id)
    data = request.get_json(force=True)
    study_hours = data.get("study_hours")
    excluded_hours = data.get("excluded_hours")

    record = _get_or_create_record(avrech_id, year, month)
    record.study_hours = study_hours
    record.excluded_hours = excluded_hours
    record.attendance_amount = calculate_attendance_stipend(study_hours, excluded_hours)
    db.session.commit()
    return jsonify(record.to_dict())


@app.post("/api/records/<int:avrech_id>/<int:year>/<int:month>/total")
def calculate_total(avrech_id, year, month):
    Avrech.query.get_or_404(avrech_id)
    data = request.get_json(force=True)

    record = _get_or_create_record(avrech_id, year, month)
    record.with_american = bool(data.get("with_american"))
    record.emuna_tanach = bool(data.get("emuna_tanach"))
    record.ktiva = bool(data.get("ktiva"))
    record.gemara_bekiut = bool(data.get("gemara_bekiut"))
    record.total_amount = calculate_total_stipend(
        record.attendance_amount,
        record.with_american,
        record.emuna_tanach,
        record.ktiva,
        record.gemara_bekiut,
    )
    db.session.commit()
    return jsonify(record.to_dict())


# ---------- PDF reports ----------

@app.get("/api/records/<int:avrech_id>/<int:year>/<int:month>/pdf")
def record_pdf(avrech_id, year, month):
    avrech = Avrech.query.get_or_404(avrech_id)
    record = MonthlyRecord.query.filter_by(avrech_id=avrech_id, year=year, month=month).first()
    record_data = record.to_dict() if record else _empty_record(avrech_id, year, month)

    buf = build_record_pdf(avrech.name, year, month, record_data)
    filename = f"avrech_{avrech_id}_{year}_{month:02d}.pdf"
    return send_file(buf, mimetype="application/pdf", as_attachment=True, download_name=filename)


@app.get("/api/reports/month/<int:year>/<int:month>/pdf")
def month_report_pdf(year, month):
    avreichim = Avrech.query.order_by(Avrech.name).all()
    records_by_avrech = {
        r.avrech_id: r
        for r in MonthlyRecord.query.filter_by(year=year, month=month).all()
    }
    rows = [
        (
            a.name,
            records_by_avrech[a.id].to_dict()
            if a.id in records_by_avrech
            else _empty_record(a.id, year, month),
        )
        for a in avreichim
    ]

    buf = build_month_report_pdf(year, month, rows)
    filename = f"month_report_{year}_{month:02d}.pdf"
    return send_file(buf, mimetype="application/pdf", as_attachment=True, download_name=filename)


@app.get("/api/reports/avrech/<int:avrech_id>/<int:year>/pdf")
def avrech_report_pdf(avrech_id, year):
    avrech = Avrech.query.get_or_404(avrech_id)
    records_by_month = {
        r.month: r
        for r in MonthlyRecord.query.filter_by(avrech_id=avrech_id, year=year).all()
    }
    rows = [
        records_by_month[m].to_dict() if m in records_by_month else _empty_record(avrech_id, year, m)
        for m in range(1, 13)
    ]

    buf = build_avrech_report_pdf(avrech.name, year, rows)
    filename = f"avrech_report_{avrech_id}_{year}.pdf"
    return send_file(buf, mimetype="application/pdf", as_attachment=True, download_name=filename)


# ---------- Calendar / month hours ----------

@app.get("/api/calendar/<int:year>/<int:month>")
def get_calendar(year, month):
    data = month_calendar(year, month)
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


if __name__ == "__main__":
    app.run(debug=True, port=5000)
