import { useEffect, useState } from "react";
import { MONTH_NAMES } from "../months";
import { getCalendarMonth, saveMonthHours } from "../api";

const WEEKDAY_HEADERS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// Python's date.weekday(): Monday=0 ... Sunday=6. Convert to a Sunday=0 column index.
function columnIndex(weekday) {
  return (weekday + 1) % 7;
}

const now = new Date();

export default function CalendarPage() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [hours, setHours] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCalendarMonth(year, month).then((res) => {
      setData(res);
      setHours(res.saved_hours ?? res.suggested_hours);
    });
  }, [year, month]);

  function goToMonth(delta) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setYear(newYear);
    setMonth(newMonth);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const value = hours === "" ? null : Number(hours);
      const updated = await saveMonthHours(year, month, value);
      setData((prev) => ({ ...prev, saved_hours: updated.hours }));
    } finally {
      setSaving(false);
    }
  }

  function handleResetToDefault() {
    if (data) setHours(data.suggested_hours);
  }

  if (!data) {
    return <main className="calendar-page">טוען...</main>;
  }

  const leadingBlanks = columnIndex(data.days[0].weekday);
  const cells = [...Array(leadingBlanks).fill(null), ...data.days];

  return (
    <main className="calendar-page">
      <div className="calendar-nav">
        <button onClick={() => goToMonth(-1)}>‹</button>
        <h2>
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <button onClick={() => goToMonth(1)}>›</button>
      </div>

      <div className="calendar-grid">
        {WEEKDAY_HEADERS.map((label) => (
          <div key={label} className="calendar-weekday-header">
            {label}
          </div>
        ))}

        {cells.map((day, i) =>
          day == null ? (
            <div key={`blank-${i}`} className="calendar-cell empty" />
          ) : (
            <div
              key={day.date}
              className={
                "calendar-cell" +
                (day.is_yomtov ? " yomtov" : "") +
                (day.is_erev ? " erev" : "") +
                (day.is_weekend && !day.is_yomtov ? " weekend" : "")
              }
            >
              <span className="day-number">{Number(day.date.slice(-2))}</span>
              {day.label && <span className="day-label">{day.label}</span>}
              {day.is_erev && !day.is_yomtov && <span className="day-label">ערב חג</span>}
            </div>
          )
        )}
      </div>

      <div className="calendar-hours">
        <label>
          מספר שעות בחודש
          <input
            type="number"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </label>
        <button onClick={handleSave} disabled={saving}>
          {saving ? "שומר..." : "שמור"}
        </button>
        <button className="link-button" onClick={handleResetToDefault}>
          איפוס לברירת המחדל
        </button>
        <p className="calendar-hint">
          ברירת המחדל: {data.business_days} ימי עסקים × 8 שעות = {data.suggested_hours} שעות (ללא
          שישי, שבת, חגים וערבי חגים). ניתן לערוך את השדה בעצמכם עבור חריגים נוספים.
        </p>
      </div>
    </main>
  );
}
