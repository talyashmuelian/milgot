import { useEffect, useState } from "react";
import { MONTH_NAMES } from "../months";
import { recordPdfUrl, getCalendarMonth } from "../api";

const CHECKBOX_FIELDS = [
  { key: "enrichment", label: "העשרות", amount: 500 },
  { key: "emuna", label: "לימוד אמונה", amount: 100 },
  { key: "tanach", label: 'לימוד תנ"ך', amount: 100 },
  { key: "review_test", label: "מבחן חזרה", amount: 100 },
  { key: "ktiva", label: "כתיבה", amount: 100 },
  { key: "gemara_bekiut", label: "גמרא בקיאות", amount: 100 },
  { key: "with_american", label: "לימוד עם אמריקאי", amount: 100 },
];

const EMPTY_CHECKBOXES = {
  enrichment: false,
  emuna: false,
  tanach: false,
  review_test: false,
  ktiva: false,
  gemara_bekiut: false,
  with_american: false,
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
  const [regularService, setRegularService] = useState(false);
  const [specialArrangementAmount, setSpecialArrangementAmount] = useState("");
  const [specialArrangementNote, setSpecialArrangementNote] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");
  const [bonusNote, setBonusNote] = useState("");
  const [notes, setNotes] = useState("");
  const [manualAdjustmentAmount, setManualAdjustmentAmount] = useState("");
  const [manualAdjustmentNote, setManualAdjustmentNote] = useState("");
  const [expectedHours, setExpectedHours] = useState(null);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [savingTotal, setSavingTotal] = useState(false);

  useEffect(() => {
    if (!record) return;
    setStudyHours(record.study_hours ?? "");
    setExcludedHours(record.excluded_hours ?? "");
    setCheckboxes({
      enrichment: record.enrichment ?? false,
      emuna: record.emuna ?? false,
      tanach: record.tanach ?? false,
      review_test: record.review_test ?? false,
      ktiva: record.ktiva ?? false,
      gemara_bekiut: record.gemara_bekiut ?? false,
      with_american: record.with_american ?? false,
    });
    setReserveDuty(record.reserve_duty ?? false);
    setRegularService(record.regular_service ?? false);
    setSpecialArrangementAmount(record.special_arrangement_amount ?? "");
    setSpecialArrangementNote(record.special_arrangement_note ?? "");
    setBonusAmount(record.bonus_amount ?? "");
    setBonusNote(record.bonus_note ?? "");
    setNotes(record.notes ?? "");
    setManualAdjustmentAmount(record.manual_adjustment_amount ?? "");
    setManualAdjustmentNote(record.manual_adjustment_note ?? "");
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
      await onCalculateTotal({
        ...checkboxes,
        reserve_duty: reserveDuty,
        regular_service: regularService,
        special_arrangement_amount: specialArrangementAmount === "" ? null : Number(specialArrangementAmount),
        special_arrangement_note: specialArrangementNote === "" ? null : specialArrangementNote,
        bonus_amount: bonusAmount === "" ? null : Number(bonusAmount),
        bonus_note: bonusNote === "" ? null : bonusNote,
        notes: notes === "" ? null : notes,
        manual_adjustment_amount: manualAdjustmentAmount === "" ? null : Number(manualAdjustmentAmount),
        manual_adjustment_note: manualAdjustmentNote === "" ? null : manualAdjustmentNote,
      });
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
          {CHECKBOX_FIELDS.map(({ key, label, amount }) => (
            <label key={key} className="checkbox-field">
              <input
                type="checkbox"
                checked={checkboxes[key]}
                onChange={(e) =>
                  setCheckboxes((prev) => ({ ...prev, [key]: e.target.checked }))
                }
              />
              {label} ({amount} ₪)
            </label>
          ))}
        </div>

        <label className="reserve-duty-field">
          <input
            type="checkbox"
            checked={reserveDuty}
            onChange={(e) => setReserveDuty(e.target.checked)}
          />
          היה במילואים החודש (מבטל את שאר החישוב ונותן מלגה קבועה של 500 ₪ + בונוס/הסדר/התאמה אם
          מולאו)
        </label>

        <label className="reserve-duty-field regular-service-field">
          <input
            type="checkbox"
            checked={regularService}
            onChange={(e) => setRegularService(e.target.checked)}
          />
          היה בשירות צבאי סדיר החודש (מבטל את חישוב הנוכחות והתוספות, אך בונוס/הסדר/התאמה עדיין
          מתווספים אם מולאו)
        </label>

        <div className="field-row">
          <label>
            הסדר מיוחד - סכום
            <input
              type="number"
              min="0"
              value={specialArrangementAmount}
              onChange={(e) => setSpecialArrangementAmount(e.target.value)}
            />
          </label>
          <label className="note-field">
            פירוט ההסדר
            <input
              type="text"
              value={specialArrangementNote}
              onChange={(e) => setSpecialArrangementNote(e.target.value)}
            />
          </label>
        </div>

        <div className="field-row">
          <label>
            בונוס - סכום
            <input
              type="number"
              min="0"
              value={bonusAmount}
              onChange={(e) => setBonusAmount(e.target.value)}
            />
          </label>
          <label className="note-field">
            הערה לבונוס
            <input type="text" value={bonusNote} onChange={(e) => setBonusNote(e.target.value)} />
          </label>
        </div>

        <label className="notes-field">
          הערות חופשיות
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <div className="field-row">
          <label>
            התאמה ידנית - סכום (ניתן שלילי)
            <input
              type="number"
              value={manualAdjustmentAmount}
              onChange={(e) => setManualAdjustmentAmount(e.target.value)}
            />
          </label>
          <label className="note-field">
            פירוט ההתאמה
            <input
              type="text"
              value={manualAdjustmentNote}
              onChange={(e) => setManualAdjustmentNote(e.target.value)}
            />
          </label>
        </div>

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
