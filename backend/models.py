from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Avrech(db.Model):
    __tablename__ = "avreichim"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    children_count = db.Column(db.Integer, nullable=False, default=0)
    archived = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "children_count": self.children_count,
            "archived": self.archived,
        }


class MonthlyRecord(db.Model):
    __tablename__ = "monthly_records"
    __table_args__ = (
        db.UniqueConstraint("avrech_id", "year", "month", name="uq_avrech_year_month"),
    )

    id = db.Column(db.Integer, primary_key=True)
    avrech_id = db.Column(db.Integer, db.ForeignKey("avreichim.id"), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)  # 1-12

    study_hours = db.Column(db.Float, nullable=True)
    excluded_hours = db.Column(db.Float, nullable=True)
    attendance_amount = db.Column(db.Float, nullable=True)

    with_american = db.Column(db.Boolean, nullable=False, default=False)
    emuna = db.Column(db.Boolean, nullable=False, default=False)
    tanach = db.Column(db.Boolean, nullable=False, default=False)
    ktiva = db.Column(db.Boolean, nullable=False, default=False)
    gemara_bekiut = db.Column(db.Boolean, nullable=False, default=False)
    review_test = db.Column(db.Boolean, nullable=False, default=False)
    enrichment = db.Column(db.Boolean, nullable=False, default=False)
    reserve_duty = db.Column(db.Boolean, nullable=False, default=False)
    total_amount = db.Column(db.Float, nullable=True)

    def to_dict(self):
        return {
            "avrech_id": self.avrech_id,
            "year": self.year,
            "month": self.month,
            "study_hours": self.study_hours,
            "excluded_hours": self.excluded_hours,
            "attendance_amount": self.attendance_amount,
            "with_american": self.with_american,
            "emuna": self.emuna,
            "tanach": self.tanach,
            "ktiva": self.ktiva,
            "gemara_bekiut": self.gemara_bekiut,
            "review_test": self.review_test,
            "enrichment": self.enrichment,
            "reserve_duty": self.reserve_duty,
            "total_amount": self.total_amount,
        }


class MonthHours(db.Model):
    __tablename__ = "month_hours"
    __table_args__ = (db.UniqueConstraint("year", "month", name="uq_year_month"),)

    id = db.Column(db.Integer, primary_key=True)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)  # 1-12
    hours = db.Column(db.Float, nullable=False)


class DayExclusion(db.Model):
    """A specific calendar date where N hours are manually excluded from
    that month's expected-hours total (e.g. a half day, an unplanned closure)."""

    __tablename__ = "day_exclusions"

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False, unique=True)
    excluded_hours = db.Column(db.Float, nullable=False, default=8)

    def to_dict(self):
        return {"date": self.date.isoformat(), "excluded_hours": self.excluded_hours}
