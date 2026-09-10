import { useEffect, useState } from "react";
import {
  listCards,
  createAvrech,
  createUpdate,
  editUpdate,
  deleteUpdate,
  createLedgerEntry,
  editLedgerEntry,
  deleteLedgerEntry,
} from "../api";

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function sumEntries(entries) {
  return entries.reduce((total, e) => total + e.amount, 0);
}

function LedgerRow({ entry, onChanged }) {
  async function saveField(field, value) {
    if (field === "amount") {
      const num = parseFloat(value);
      if (Number.isNaN(num) || num === entry.amount) return;
      await editLedgerEntry(entry.id, { amount: num });
    } else if (value === entry[field]) {
      return;
    } else {
      await editLedgerEntry(entry.id, { [field]: value });
    }
    await onChanged();
  }

  async function handleDelete() {
    if (!window.confirm("למחוק את השורה הזו?")) return;
    await deleteLedgerEntry(entry.id);
    await onChanged();
  }

  return (
    <li className="ledger-row">
      <input
        type="date"
        className="ledger-date"
        defaultValue={entry.date}
        onBlur={(e) => saveField("date", e.target.value)}
      />
      <input
        type="number"
        step="0.01"
        className="ledger-amount"
        defaultValue={entry.amount}
        onBlur={(e) => saveField("amount", e.target.value)}
      />
      <input
        type="text"
        className="ledger-note"
        placeholder="הערה"
        defaultValue={entry.note || ""}
        onBlur={(e) => saveField("note", e.target.value)}
      />
      <button className="icon-btn" title="מחק" onClick={handleDelete}>
        🗑
      </button>
    </li>
  );
}

function LedgerColumn({ kind, label, entries, avrechId, onChanged }) {
  const [date, setDate] = useState(todayIso());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    const num = parseFloat(amount);
    if (Number.isNaN(num)) return;
    setAdding(true);
    try {
      await createLedgerEntry(avrechId, { kind, date, amount: num, note: note.trim() });
      setAmount("");
      setNote("");
      setDate(todayIso());
      await onChanged();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={`ledger-col ledger-col-${kind}`}>
      <div className="ledger-col-header">{label}</div>

      <ul className="ledger-list">
        {entries.length === 0 && <li className="update-empty">אין שורות.</li>}
        {entries.map((entry) => (
          <LedgerRow key={entry.id} entry={entry} onChanged={onChanged} />
        ))}
      </ul>

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
        <button type="submit" disabled={adding || !amount.trim()}>
          {adding ? "מוסיף..." : "הוסף שורה"}
        </button>
      </form>

      <div className="ledger-col-total">
        סה"כ {label}: ₪{sumEntries(entries)}
      </div>
    </div>
  );
}

function AccountLedger({ avrech, onChanged }) {
  const ledger = avrech.ledger || [];
  const charges = ledger.filter((e) => e.kind === "charge");
  const credits = ledger.filter((e) => e.kind === "credit");
  const balance = sumEntries(charges) - sumEntries(credits);

  return (
    <div className="ledger">
      <h4>דף חשבון</h4>
      <div className="ledger-columns">
        <LedgerColumn
          kind="charge"
          label="חיובים"
          entries={charges}
          avrechId={avrech.id}
          onChanged={onChanged}
        />
        <LedgerColumn
          kind="credit"
          label="זיכויים"
          entries={credits}
          avrechId={avrech.id}
          onChanged={onChanged}
        />
      </div>
      <div className="ledger-balance">יתרה כוללת: ₪{balance}</div>
    </div>
  );
}

function AvrechCard({ avrech, onChanged }) {
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");

  async function handleAdd(e) {
    e.preventDefault();
    const text = newText.trim();
    if (!text) return;
    setAdding(true);
    try {
      await createUpdate(avrech.id, text);
      setNewText("");
      await onChanged();
    } finally {
      setAdding(false);
    }
  }

  function startEdit(update) {
    setEditingId(update.id);
    setEditingText(update.text);
  }

  async function submitEdit(e) {
    e.preventDefault();
    const text = editingText.trim();
    if (!text) return;
    await editUpdate(editingId, text);
    setEditingId(null);
    await onChanged();
  }

  async function handleDelete(update) {
    if (!window.confirm("למחוק את העדכון הזה?")) return;
    await deleteUpdate(update.id);
    await onChanged();
  }

  return (
    <div className="avrech-card">
      <div className="avrech-card-header">
        <h3>{avrech.name}</h3>
        {avrech.children_count > 0 && (
          <span className="children-badge">({avrech.children_count})</span>
        )}
        {avrech.card_only && <span className="card-only-badge">כרטיס בלבד</span>}
      </div>

      <form className="update-form" onSubmit={handleAdd}>
        <textarea
          rows={2}
          placeholder="הוסף עדכון..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
        />
        <button type="submit" disabled={adding || !newText.trim()}>
          {adding ? "מוסיף..." : "הוסף עדכון"}
        </button>
      </form>

      <ul className="update-list">
        {avrech.updates.length === 0 && <li className="update-empty">אין עדכונים עדיין.</li>}
        {avrech.updates.map((update) => (
          <li key={update.id} className="update-item">
            {editingId === update.id ? (
              <form className="update-edit-form" onSubmit={submitEdit}>
                <textarea
                  rows={2}
                  autoFocus
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                />
                <div className="update-edit-actions">
                  <button type="submit" className="icon-btn" title="שמור">
                    ✓
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="בטל"
                    onClick={() => setEditingId(null)}
                  >
                    ✕
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="update-text">{update.text}</p>
                <div className="update-meta">
                  <span>
                    {formatDate(update.created_at)}
                    {update.updated_at && ` (עודכן ב-${formatDate(update.updated_at)})`}
                  </span>
                  <span className="row-actions">
                    <button className="icon-btn" title="ערוך" onClick={() => startEdit(update)}>
                      ✎
                    </button>
                    <button className="icon-btn" title="מחק" onClick={() => handleDelete(update)}>
                      🗑
                    </button>
                  </span>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <AccountLedger avrech={avrech} onChanged={onChanged} />
    </div>
  );
}

function AddCardPersonForm({ onChanged }) {
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      await createAvrech(trimmed, 0, true);
      setName("");
      setOpen(false);
      await onChanged();
    } finally {
      setAdding(false);
    }
  }

  if (!open) {
    return (
      <button className="add-card-person-toggle" onClick={() => setOpen(true)}>
        + כרטיס חדש (למי שאינו ברשימת האברכים)
      </button>
    );
  }

  return (
    <form className="add-card-person-form" onSubmit={handleAdd}>
      <input
        type="text"
        placeholder="שם"
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

export default function CardsPage() {
  const [cards, setCards] = useState(null);

  function refresh() {
    return listCards().then(setCards);
  }

  useEffect(() => {
    refresh();
  }, []);

  if (!cards) {
    return <main className="cards-page">טוען...</main>;
  }

  return (
    <main className="cards-page">
      <AddCardPersonForm onChanged={refresh} />

      {cards.length === 0 ? (
        <p className="archive-empty">אין עדיין אברכים במערכת.</p>
      ) : (
        <div className="cards-grid">
          {cards.map((avrech) => (
            <AvrechCard key={avrech.id} avrech={avrech} onChanged={refresh} />
          ))}
        </div>
      )}
    </main>
  );
}
