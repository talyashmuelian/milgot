import { useEffect, useState } from "react";
import { listDonors, listDonorReminders, listOverdueDonorReminders } from "../api";
import { MONTH_NAMES } from "../months";
import { ReminderItem, ReminderModal } from "./reminders";
import { formatDate, isoDate, reminderMatches, todayIso } from "../dates";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MAX_PILLS = 3;

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** The days to show: a full month (with leading blanks) or one week. */
function visibleRange(view, anchor) {
  if (view === "week") {
    const start = startOfWeek(anchor);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const end = days[6];
    const label = `${start.getDate()}/${start.getMonth() + 1} – ${end.getDate()}/${
      end.getMonth() + 1
    }/${end.getFullYear()}`;
    return { days, blanks: 0, from: isoDate(start), to: isoDate(end), label };
  }
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
  return {
    days,
    blanks: days[0].getDay(),
    from: isoDate(days[0]),
    to: isoDate(days[daysInMonth - 1]),
    label: `${MONTH_NAMES[month]} ${year}`,
  };
}

function DayModal({ dateStr, reminders, donors, onClose, onAdd, onChanged }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" role="dialog">
        <h3>תזכורות ל-{formatDate(dateStr)}</h3>
        <ul className="reminder-list">
          {reminders.length === 0 && <li className="update-empty">אין תזכורות ביום זה.</li>}
          {reminders.map((r) => (
            <ReminderItem
              key={r.id}
              reminder={r}
              donors={donors}
              showDonor
              onChanged={onChanged}
            />
          ))}
        </ul>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>
            סגור
          </button>
          <button className="btn-primary" onClick={onAdd}>
            + הוסף תזכורת
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RemindersCalendarPage() {
  const [view, setView] = useState("month"); // "month" | "week"
  const [anchor, setAnchor] = useState(() => new Date());
  const [reminders, setReminders] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [donors, setDonors] = useState([]);
  const [search, setSearch] = useState("");
  const [openDay, setOpenDay] = useState(null);
  const [newReminderDate, setNewReminderDate] = useState(null);

  const range = visibleRange(view, anchor);

  function refresh() {
    return Promise.all([
      listDonorReminders(range.from, range.to).then(setReminders),
      listOverdueDonorReminders().then(setOverdue),
    ]);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  useEffect(() => {
    listDonors().then(setDonors);
  }, []);

  function step(direction) {
    setAnchor((prev) =>
      view === "week"
        ? addDays(prev, 7 * direction)
        : new Date(prev.getFullYear(), prev.getMonth() + direction, 1)
    );
  }

  const term = search.trim().toLowerCase();
  const byDate = {};
  for (const r of reminders) {
    if (term && !reminderMatches(r, term)) continue;
    (byDate[r.date] ||= []).push(r);
  }
  const today = todayIso();

  return (
    <main className="cards-page reminders-page">
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button onClick={() => step(-1)} title="הקודם">
            ›
          </button>
          <span className="cal-nav-label">{range.label}</span>
          <button onClick={() => step(1)} title="הבא">
            ‹
          </button>
        </div>
        <button className="cal-today-btn" onClick={() => setAnchor(new Date())}>
          היום
        </button>
        <div className="cal-view-toggle">
          <button className={view === "month" ? "active" : ""} onClick={() => setView("month")}>
            חודשי
          </button>
          <button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>
            שבועי
          </button>
        </div>
        <button className="btn-primary" onClick={() => setNewReminderDate(today)}>
          + תזכורת חדשה
        </button>
        <input
          type="search"
          className="donations-search"
          placeholder="חיפוש תזכורת..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="cal-legend">
        <span className="cal-legend-item is-general">תזכורת כללית</span>
        <span className="cal-legend-item is-donor">תזכורת של תורם</span>
      </div>

      {overdue.length > 0 && (
        <section className="reminders-overdue">
          <h4>⏰ תזכורות שעבר זמנן ולא סומנו כבוצעו ({overdue.length})</h4>
          <ul className="reminder-list">
            {overdue.map((r) => (
              <ReminderItem
                key={r.id}
                reminder={r}
                donors={donors}
                showDate
                showDonor
                onChanged={refresh}
              />
            ))}
          </ul>
        </section>
      )}

      <div className={`rcal-grid ${view === "week" ? "is-week" : ""}`}>
        {DAY_NAMES.map((n) => (
          <div key={n} className="rcal-day-header">
            {n}
          </div>
        ))}
        {Array.from({ length: range.blanks }, (_, i) => (
          <div key={`blank-${i}`} className="rcal-cell is-blank" />
        ))}
        {range.days.map((day) => {
          const dateStr = isoDate(day);
          const dayReminders = byDate[dateStr] || [];
          const shown = view === "week" ? dayReminders : dayReminders.slice(0, MAX_PILLS);
          return (
            <button
              key={dateStr}
              type="button"
              className={`rcal-cell ${dateStr === today ? "is-today" : ""}`}
              onClick={() => setOpenDay(dateStr)}
            >
              <span className="rcal-day-num">
                {view === "week" ? `${day.getDate()}/${day.getMonth() + 1}` : day.getDate()}
              </span>
              {shown.map((r) => (
                <span
                  key={r.id}
                  className={`rcal-pill ${r.donor_id ? "is-donor" : "is-general"} ${
                    r.done ? "is-done" : ""
                  }`}
                  title={[r.time, r.donor_name, r.title].filter(Boolean).join(" · ")}
                >
                  {r.time && <b>{r.time} </b>}
                  {r.donor_name ? `${r.donor_name}: ` : ""}
                  {r.title}
                </span>
              ))}
              {dayReminders.length > shown.length && (
                <span className="rcal-more">+{dayReminders.length - shown.length} נוספות</span>
              )}
            </button>
          );
        })}
      </div>

      {openDay && (
        <DayModal
          dateStr={openDay}
          reminders={byDate[openDay] || []}
          donors={donors}
          onClose={() => setOpenDay(null)}
          onAdd={() => {
            setNewReminderDate(openDay);
            setOpenDay(null);
          }}
          onChanged={refresh}
        />
      )}
      {newReminderDate && (
        <ReminderModal
          defaults={{ date: newReminderDate }}
          donors={donors}
          onClose={() => setNewReminderDate(null)}
          onSaved={refresh}
        />
      )}
    </main>
  );
}
