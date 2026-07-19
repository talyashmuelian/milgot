import { useEffect, useRef, useState } from "react";
import { MONTH_NAMES } from "../months";
import {
  getCalendarMonth,
  saveMonthHours,
  setDayExclusion,
  deleteDayExclusion,
} from "../api";

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
  const [contextMenu, setContextMenu] = useState(null); // {date, x, y, hasExclusion}
  const [exclusionPopover, setExclusionPopover] = useState(null); // {date, x, y, value}
  const menuRef = useRef(null);

  function loadCalendar() {
    return getCalendarMonth(year, month).then((res) => {
      setData(res);
      setHours(res.saved_hours ?? res.suggested_hours);
    });
  }

  useEffect(() => {
    loadCalendar();
  }, [year, month]);

  useEffect(() => {
    if (!contextMenu) return;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [contextMenu]);

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

  function handleDayContextMenu(e, day) {
    e.preventDefault();
    setExclusionPopover(null);
    setContextMenu({
      date: day.date,
      x: e.clientX,
      y: e.clientY,
      hasExclusion: day.excluded_hours != null,
    });
  }

  function openExclusionPopover(currentValue) {
    setExclusionPopover({
      date: contextMenu.date,
      x: contextMenu.x,
      y: contextMenu.y,
      value: currentValue ?? 8,
    });
    setContextMenu(null);
  }

  async function handleSaveExclusion() {
    const { date, value } = exclusionPopover;
    await setDayExclusion(date, Number(value));
    setExclusionPopover(null);
    await loadCalendar();
  }

  async function handleCancelExclusion(date) {
    setContextMenu(null);
    await deleteDayExclusion(date);
    await loadCalendar();
  }

  if (!data) {
    return <main className="calendar-page">טוען...</main>;
  }

  const leadingBlanks = columnIndex(data.days[0].weekday);
  const cells = [...Array(leadingBlanks).fill(null), ...data.days];

  const rawHours = data.business_days * 8;
  const manuallyExcludedTotal = rawHours - data.suggested_hours;

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
                (day.is_weekend && !day.is_yomtov ? " weekend" : "") +
                (day.excluded_hours != null ? " manual-exclusion" : "")
              }
              onContextMenu={(e) => handleDayContextMenu(e, day)}
            >
              <span className="day-number">{Number(day.date.slice(-2))}</span>
              {day.label && <span className="day-label">{day.label}</span>}
              {day.is_erev && !day.is_yomtov && <span className="day-label">ערב חג</span>}
              {day.excluded_hours != null && (
                <span className="day-exclusion-badge">הוחרגו {day.excluded_hours} ש'</span>
              )}
            </div>
          )
        )}
      </div>

      {contextMenu && (
        <div
          ref={menuRef}
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.hasExclusion ? (
            <>
              <button
                onClick={() =>
                  openExclusionPopover(
                    data.days.find((d) => d.date === contextMenu.date)?.excluded_hours
                  )
                }
              >
                עדכן החרגה
              </button>
              <button onClick={() => handleCancelExclusion(contextMenu.date)}>
                בטל החרגה
              </button>
            </>
          ) : (
            <button onClick={() => openExclusionPopover(8)}>החרג מהיום</button>
          )}
        </div>
      )}

      {exclusionPopover && (
        <div
          className="exclusion-popover"
          style={{ top: exclusionPopover.y, left: exclusionPopover.x }}
        >
          <label>
            שעות להחריג ביום {exclusionPopover.date}
            <input
              type="number"
              autoFocus
              value={exclusionPopover.value}
              onChange={(e) =>
                setExclusionPopover((prev) => ({ ...prev, value: e.target.value }))
              }
            />
          </label>
          <div className="exclusion-popover-actions">
            <button onClick={handleSaveExclusion}>שמור</button>
            <button className="link-button" onClick={() => setExclusionPopover(null)}>
              בטל
            </button>
          </div>
        </div>
      )}

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
          ברירת המחדל: {data.business_days} ימי עסקים × 8 שעות = {rawHours} שעות (ללא שישי, שבת,
          חגים וערבי חגים)
          {manuallyExcludedTotal > 0 && (
            <> , בניכוי {manuallyExcludedTotal} שעות שהוחרגו ידנית בלוח = {data.suggested_hours} שעות</>
          )}
          . ניתן לערוך את השדה בעצמכם עבור חריגים נוספים, או ללחוץ מקש ימני על יום בלוח כדי להחריג
          אותו.
        </p>
      </div>
    </main>
  );
}
