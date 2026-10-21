import { useEffect, useState } from "react";
import {
  listDonors,
  createDonor,
  renameDonor,
  editDonorDescription,
  deleteDonor,
  createDonationEntry,
  editDonationEntry,
  deleteDonationEntry,
} from "../api";
import { ReminderItem, ReminderModal } from "./reminders";
import { formatDate, reminderMatches, todayIso } from "../dates";

function sumEntries(entries) {
  return entries.reduce((total, e) => total + (e.amount || 0), 0);
}

function entryMatches(entry, term) {
  return [entry.note, entry.amount, entry.date, formatDate(entry.date)].some(
    (value) => value != null && String(value).toLowerCase().includes(term)
  );
}

function AddDonorForm({ onAdded }) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const donor = await createDonor(trimmed);
      setName("");
      setOpen(false);
      await onAdded(donor);
    } finally {
      setAdding(false);
    }
  }

  if (!open) {
    return (
      <button className="add-card-person-toggle" onClick={() => setOpen(true)}>
        + תורם חדש
      </button>
    );
  }

  return (
    <form className="add-card-person-form" onSubmit={handleAdd}>
      <input
        type="text"
        placeholder="שם התורם"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" disabled={adding || !name.trim()}>
        {adding ? "יוצר..." : "צור כרטיס"}
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        בטל
      </button>
    </form>
  );
}

function DonationRow({ entry, highlighted, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDate(entry.date || "");
    setAmount(entry.amount ?? "");
    setNote(entry.note || "");
    setEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    const num = String(amount).trim() === "" ? null : parseFloat(amount);
    if (Number.isNaN(num)) return;
    setSaving(true);
    try {
      await editDonationEntry(entry.id, { date, amount: num, note });
      await onChanged();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("למחוק את הרשומה הזו?")) return;
    await deleteDonationEntry(entry.id);
    await onChanged();
  }

  if (editing) {
    return (
      <li className="donation-row is-editing">
        <form className="ledger-add-form" onSubmit={handleSave}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input
            type="number"
            step="0.01"
            placeholder="סכום"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            type="text"
            placeholder="הערה"
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button type="submit" disabled={saving}>
            {saving ? "שומר..." : "שמור"}
          </button>
          <button type="button" className="icon-btn" title="בטל" onClick={() => setEditing(false)}>
            ✕
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className={`donation-row ${highlighted ? "search-hit" : ""}`}>
      <span className="donation-date">{entry.date ? formatDate(entry.date) : "—"}</span>
      <span className="donation-amount">
        {entry.amount != null ? `₪${entry.amount.toLocaleString("he-IL")}` : "—"}
      </span>
      <span className="donation-note">{entry.note || ""}</span>
      <span className="row-actions">
        <button className="icon-btn" title="ערוך" onClick={startEdit}>
          ✎
        </button>
        <button className="icon-btn" title="מחק" onClick={handleDelete}>
          🗑
        </button>
      </span>
    </li>
  );
}

function DonorDescription({ donor, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft(donor.description || "");
    setEditing(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await editDonorDescription(donor.id, draft);
      await onChanged();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <form className="donor-description is-editing" onSubmit={handleSave}>
        <textarea
          rows={4}
          autoFocus
          placeholder="תיאור כללי על התורם..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="update-edit-actions">
          <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(false)}>
            ביטול
          </button>
          <button type="submit" className="btn-primary btn-sm" disabled={saving}>
            {saving ? "שומר..." : "שמור"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="donor-description">
      <div className="donor-description-header">
        <h4>תיאור כללי</h4>
        <button className="icon-btn" title="ערוך תיאור" onClick={startEdit}>
          ✎
        </button>
      </div>
      {donor.description ? (
        <p className="donor-description-text">{donor.description}</p>
      ) : (
        <button className="link-btn" onClick={startEdit}>
          + הוסף תיאור
        </button>
      )}
    </div>
  );
}

function DonorReminders({ donor, searchTerm, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const doneCount = donor.reminders.filter((r) => r.done).length;
  const shown = showDone ? donor.reminders : donor.reminders.filter((r) => !r.done);

  return (
    <div className="ledger donor-reminders">
      <div className="donor-reminders-header">
        <h4>תזכורות</h4>
        {doneCount > 0 && (
          <button className="link-btn" onClick={() => setShowDone((prev) => !prev)}>
            {showDone ? "הסתר שבוצעו" : `הצג גם שבוצעו (${doneCount})`}
          </button>
        )}
        <button className="btn-primary btn-sm" onClick={() => setAdding(true)}>
          + תזכורת
        </button>
      </div>
      <ul className="reminder-list">
        {shown.length === 0 && <li className="update-empty">אין תזכורות פתוחות.</li>}
        {shown.map((r) => (
          <ReminderItem
            key={r.id}
            reminder={{ ...r, donor_name: donor.name }}
            showDate
            highlighted={Boolean(searchTerm) && reminderMatches(r, searchTerm)}
            onChanged={onChanged}
          />
        ))}
      </ul>
      {adding && (
        <ReminderModal
          defaults={{ donor_id: donor.id }}
          lockDonor
          onClose={() => setAdding(false)}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}

function DonorCard({ donor, searchTerm, onChanged }) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(donor.name);
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  // While searching, every card shown is opened so the matching rows are visible.
  const isOpen = open || Boolean(searchTerm);

  async function handleRename(e) {
    e.preventDefault();
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    if (trimmed !== donor.name) {
      await renameDonor(donor.id, trimmed);
      await onChanged();
    }
    setRenaming(false);
  }

  async function handleDeleteDonor() {
    if (!window.confirm(`למחוק את הכרטיס של ${donor.name} וכל הרשומות שבו?`)) return;
    await deleteDonor(donor.id);
    await onChanged();
  }

  async function handleAdd(e) {
    e.preventDefault();
    const num = amount.trim() === "" ? null : parseFloat(amount);
    if (Number.isNaN(num)) return;
    setAdding(true);
    try {
      await createDonationEntry(donor.id, { date, amount: num, note: note.trim() });
      setAmount("");
      setNote("");
      setDate(todayIso());
      await onChanged();
    } finally {
      setAdding(false);
    }
  }

  const total = sumEntries(donor.entries);

  return (
    <div className={`avrech-card donor-card ${isOpen ? "open" : "collapsed"}`}>
      <div className="avrech-card-header">
        {renaming ? (
          <form className="donor-rename-form" onSubmit={handleRename}>
            <input
              type="text"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
            />
            <button type="submit" className="icon-btn" title="שמור">
              ✓
            </button>
            <button
              type="button"
              className="icon-btn"
              title="בטל"
              onClick={() => {
                setNameDraft(donor.name);
                setRenaming(false);
              }}
            >
              ✕
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              className="avrech-card-toggle"
              onClick={() => setOpen((prev) => !prev)}
              aria-expanded={isOpen}
            >
              <span className="card-toggle-arrow">{isOpen ? "▾" : "◂"}</span>
              <h3>{donor.name}</h3>
              <span className="donor-summary">
                {donor.entries.length} רשומות · ₪{total.toLocaleString("he-IL")}
              </span>
            </button>
            <span className="row-actions">
              <button className="icon-btn" title="ערוך שם" onClick={() => setRenaming(true)}>
                ✎
              </button>
              <button className="icon-btn" title="מחק תורם" onClick={handleDeleteDonor}>
                🗑
              </button>
            </span>
          </>
        )}
      </div>

      {isOpen && (
        <div className="avrech-card-body">
          <DonorDescription donor={donor} onChanged={onChanged} />

          <form className="ledger-add-form" onSubmit={handleAdd}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <input
              type="number"
              step="0.01"
              placeholder="סכום"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <input
              type="text"
              placeholder="הערה"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button type="submit" disabled={adding}>
              {adding ? "מוסיף..." : "הוסף רשומה"}
            </button>
          </form>

          <ul className="ledger-list donation-list">
            {donor.entries.length === 0 && <li className="update-empty">אין רשומות עדיין.</li>}
            {donor.entries.map((entry) => (
              <DonationRow
                key={entry.id}
                entry={entry}
                highlighted={Boolean(searchTerm) && entryMatches(entry, searchTerm)}
                onChanged={onChanged}
              />
            ))}
          </ul>

          <div className="ledger-balance">סה"כ תרומות: ₪{total.toLocaleString("he-IL")}</div>

          <DonorReminders donor={donor} searchTerm={searchTerm} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}

export default function DonationsPage() {
  const [donors, setDonors] = useState(null);
  const [search, setSearch] = useState("");

  function refresh() {
    return listDonors().then(setDonors);
  }

  useEffect(() => {
    refresh();
  }, []);

  if (!donors) {
    return <main className="cards-page">טוען...</main>;
  }

  const term = search.trim().toLowerCase();
  const visible = term
    ? donors.filter(
        (d) =>
          d.name.toLowerCase().includes(term) ||
          (d.description || "").toLowerCase().includes(term) ||
          d.entries.some((e) => entryMatches(e, term)) ||
          d.reminders.some((r) => reminderMatches(r, term))
      )
    : donors;

  return (
    <main className="cards-page">
      <div className="donations-toolbar">
        <AddDonorForm onAdded={refresh} />
        <input
          type="search"
          className="donations-search"
          placeholder="חיפוש לפי שם, תיאור, הערה, סכום, תאריך או תזכורת..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {donors.length === 0 ? (
        <p className="archive-empty">אין עדיין תורמים במערכת.</p>
      ) : visible.length === 0 ? (
        <p className="archive-empty">לא נמצאו תוצאות עבור "{search.trim()}".</p>
      ) : (
        <div className="cards-grid">
          {visible.map((donor) => (
            <DonorCard key={donor.id} donor={donor} searchTerm={term} onChanged={refresh} />
          ))}
        </div>
      )}
    </main>
  );
}
