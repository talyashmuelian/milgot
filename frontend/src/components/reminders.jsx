import { useState } from "react";
import { createDonorReminder, editDonorReminder, deleteDonorReminder } from "../api";
import { formatDate, todayIso } from "../dates";

// Shared by the donor cards and the donations calendar.

const DEFAULT_TIME = "09:00";

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

/**
 * Create a reminder (pass `defaults`) or edit one (pass `reminder`).
 * `donors` feeds the "linked to donor" select; `lockDonor` hides it when the
 * reminder is being added from inside a donor's card.
 */
export function ReminderModal({ reminder, defaults = {}, donors = [], lockDonor, onClose, onSaved }) {
  const editing = Boolean(reminder);
  const initial = reminder || defaults;
  const [date, setDate] = useState(initial.date || todayIso());
  const [time, setTime] = useState(editing ? initial.time || "" : initial.time || DEFAULT_TIME);
  const [title, setTitle] = useState(initial.title || "");
  const [note, setNote] = useState(initial.note || "");
  const [donorId, setDonorId] = useState(initial.donor_id || "");
  const [recur, setRecur] = useState(false);
  const [recurUntil, setRecurUntil] = useState("");
  const [wholeSeries, setWholeSeries] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    setSaving(true);
    const fields = {
      date,
      time,
      title: title.trim(),
      note: note.trim(),
      donor_id: donorId ? Number(donorId) : null,
    };
    try {
      if (editing) {
        await editDonorReminder(reminder.id, { ...fields, whole_series: wholeSeries });
      } else {
        await createDonorReminder({ ...fields, recur, recur_until: recur ? recurUntil : "" });
      }
      await onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? "עריכת תזכורת" : "תזכורת חדשה"} onClose={onClose}>
      <form className="reminder-form" onSubmit={handleSubmit}>
        <label>
          נושא *
          <input type="text" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="reminder-form-row">
          <label>
            תאריך *
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            שעה
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <label>
          פירוט
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {!lockDonor && (
          <label>
            שייך לתורם
            <select value={donorId} onChange={(e) => setDonorId(e.target.value)}>
              <option value="">— תזכורת כללית —</option>
              {donors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!editing && (
          <div className="reminder-recur">
            <label className="monthly-reminder-checkbox">
              <input type="checkbox" checked={recur} onChange={(e) => setRecur(e.target.checked)} />
              🔁 חוזרת כל חודש
            </label>
            {recur && (
              <label className="reminder-recur-until">
                עד (ריק = שנה)
                <input
                  type="date"
                  value={recurUntil}
                  onChange={(e) => setRecurUntil(e.target.value)}
                />
              </label>
            )}
          </div>
        )}
        {editing && reminder.recur_series && (
          <label className="monthly-reminder-checkbox">
            <input
              type="checkbox"
              checked={wholeSeries}
              onChange={(e) => setWholeSeries(e.target.checked)}
            />
            החל את השינויים (חוץ מהתאריך) על כל הסדרה החוזרת
          </label>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            ביטול
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !title.trim() || !date}>
            {saving ? "שומר..." : "שמור"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteSeriesModal({ onClose, onDelete }) {
  return (
    <Modal title="מחיקת תזכורת חוזרת 🔁" onClose={onClose}>
      <p className="modal-text">התזכורת היא חלק מסדרה חוזרת. מה למחוק?</p>
      <div className="modal-choices">
        <button className="btn-ghost" onClick={() => onDelete(false)}>
          רק את המופע הזה
        </button>
        <button className="btn-danger" onClick={() => onDelete(true)}>
          את כל הסדרה
        </button>
        <button className="btn-ghost" onClick={onClose}>
          ביטול
        </button>
      </div>
    </Modal>
  );
}

/** One reminder line with done / edit / delete. `showDate` for lists that span days. */
export function ReminderItem({ reminder, donors, showDate, showDonor, highlighted, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [askSeries, setAskSeries] = useState(false);
  const overdue = !reminder.done && reminder.date < todayIso();

  async function toggleDone() {
    await editDonorReminder(reminder.id, { done: !reminder.done });
    await onChanged();
  }

  async function doDelete(wholeSeries) {
    setAskSeries(false);
    await deleteDonorReminder(reminder.id, wholeSeries);
    await onChanged();
  }

  function handleDelete() {
    if (reminder.recur_series) {
      setAskSeries(true);
    } else if (window.confirm("למחוק את התזכורת?")) {
      doDelete(false);
    }
  }

  return (
    <li
      className={`reminder-item ${reminder.donor_id ? "is-donor" : "is-general"} ${
        reminder.done ? "is-done" : ""
      } ${overdue ? "is-overdue" : ""} ${highlighted ? "search-hit" : ""}`}
    >
      <input
        type="checkbox"
        className="reminder-done"
        title={reminder.done ? "סמן כלא בוצע" : "סמן כבוצע"}
        checked={reminder.done}
        onChange={toggleDone}
      />
      <div className="reminder-info">
        <div className="reminder-title">
          {showDate && <span className="reminder-when">{formatDate(reminder.date)}</span>}
          {reminder.time && <span className="reminder-when">{reminder.time}</span>}
          {reminder.title}
          {reminder.recur_series && <span title="חוזרת כל חודש"> 🔁</span>}
          {overdue && <span className="reminder-overdue-badge">באיחור</span>}
        </div>
        {reminder.note && <div className="reminder-note">{reminder.note}</div>}
        {showDonor && (
          <span className="reminder-source">{reminder.donor_name || "תזכורת כללית"}</span>
        )}
      </div>
      <span className="row-actions">
        <button className="icon-btn" title="ערוך" onClick={() => setEditing(true)}>
          ✎
        </button>
        <button className="icon-btn" title="מחק" onClick={handleDelete}>
          🗑
        </button>
      </span>

      {editing && (
        <ReminderModal
          reminder={reminder}
          donors={donors}
          lockDonor={!donors}
          onClose={() => setEditing(false)}
          onSaved={onChanged}
        />
      )}
      {askSeries && <DeleteSeriesModal onClose={() => setAskSeries(false)} onDelete={doDelete} />}
    </li>
  );
}
