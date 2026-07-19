import { useEffect, useState } from "react";
import { MONTH_NAMES } from "../months";
import { recordPdfUrl, getCalendarMonth } from "../api";

const CHECKBOX_FIELDS = [
  { key: "with_american", label: "לימוד עם אמריקאי" },
  { key: "emuna", label: "לימוד אמונה" },
  { key: "tanach", label: "לימוד תנ\"ך" },
  { key: "ktiva", label: "כתיבה" },
  { key: "gemara_bekiut", label: "גמרא בקיאות" },
  { key: "review_test", label: "מבחן חזרה" },
  { key: "enrichment", label: "העשרות" },
];

const EMPTY_CHECKBOXES = {
  with_american: false,
  emuna: false,
  tanach: false,
  ktiva: false,
  gemara_bekiut: false,
  review_test: false,
  enrichment: false,
};

export default function RecordPanel({
  avrechId,
  year,
  month,
  record,
  loading,
  onCalculateAttendance,
  onCalculateTotal,
}) {
  const [studyHours, setStudyHours] = useState("");
  const [excludedHours, setExcludedHours] = useState("");
  const [checkboxes, setCheckboxes] = useState(EMPTY_CHECKBOXES);
  const [reserveDuty, setReserveDuty] = useState(false);
  const [expectedHours, setExpectedHours] = useState(null);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [savingTotal, setSavingTotal] = useState(false);

  useEffect(() => {
    if (!record) return;
    setStudyHours(record.study_hours ?? "");
    setExcludedHours(record.excluded_hours ?? "");
    setCheckboxes({
      with_american: record.with_american ?? false,
      emuna: record.emuna ?? false,
      tanach: record.tanach ?? false,
      ktiva: record.ktiva ?? false,
      gemara_bekiut: record.gemara_bekiut ?? false,
      review_test: record.review_test ?? false,
      enrichment: record.enrichment ?? false,
    });
    setReserveDuty(record.reserve_duty ?? false);
  }, [record]);

  useEffect(() => {
    if (year == null || month == null) return;
    getCalendarMonth(year, month).then((data) =>
      setExpectedHours(data.saved_hours ?? data.suggested_hours)
    );
  }, [year, month]);

  if (loading) {
    return <main className="record-panel">טוען...</main>;
  }

  if (!record) {
    return (
      <main className="record-panel empty-state">
        <p>יש לבחור אברך וחודש כדי להתחיל</p>
      </main>
    );
  }

  async function handleCalculateAttendance() {
    setSavingAttendance(true);
    try {
      await onCalculateAttendance(
        studyHours === "" ? null : Number(studyHours),
        excludedHours === "" ? null : Number(excludedHours)
      );
    } finally {
      setSavingAttendance(false);
    }
  }

  async function handleCalculateTotal() {
    setSavingTotal(true);
    try {
      await onCalculateTotal({ ...checkboxes, reserve_duty: reserveDuty });
    } finally {
      setSavingTotal(false);
    }
  }

  return (
    <main className="record-panel">
      <div className="record-header">
        <h3>
          {MONTH_NAMES[month - 1]} {year}
        </h3>
        <button
          className="pdf-link"
          onClick={() => window.open(recordPdfUrl(avrechId, year, month), "_blank")}
        >
          הורד PDF
        </button>
      </div>

      <section className="attendance-section">
        <div className="field-row">
          <label>
            מספר שעות לימוד בחודש
            <input
              type="number"
              value={studyHours}
              onChange={(e) => setStudyHours(e.target.value)}
            />
          </label>
          <label>
            מספר שעות מוחרגות
            <input
              type="number"
              value={excludedHours}
              onChange={(e) => setExcludedHours(e.target.value)}
            />
          </label>
        </div>

        {expectedHours != null && (
          <p className="expected-hours-hint">מתוך {expectedHours} שעות צפויות בחודש זה</p>
        )}

        <div className="field-row calc-row">
          <button onClick={handleCalculateAttendance} disabled={savingAttendance}>
            {savingAttendance ? "מחשב..." : "חשב מלגת נוכחות"}
          </button>
          <span className="amount">
            {record.attendance_amount != null ? `₪${record.attendance_amount}` : ""}
          </span>
        </div>
      </section>

      <hr className="divider" />

      <section className="extras-section">
        <div className="checkbox-grid">
          {CHECKBOX_FIELDS.map(({ key, label }) => (
            <label key={key} className="checkbox-field">
              <input
                type="checkbox"
                checked={checkboxes[key]}
                onChange={(e) =>
                  setCheckboxes((prev) => ({ ...prev, [key]: e.target.checked }))
                }
              />
              {label}
            </label>
          ))}
        </div>

        <label className="reserve-duty-field">
          <input
            type="checkbox"
            checked={reserveDuty}
            onChange={(e) => setReserveDuty(e.target.checked)}
          />
          היה במילואים החודש (מבטל את שאר החישוב ונותן מלגה קבועה של 3,500 ₪)
        </label>

        <div className="field-row calc-row">
          <button onClick={handleCalculateTotal} disabled={savingTotal}>
            {savingTotal ? "מחשב..." : "חישוב כלל המלגה"}
          </button>
          <span className="amount">
            {record.total_amount != null ? `₪${record.total_amount}` : ""}
          </span>
        </div>
      </section>
    </main>
  );
}
