import { useEffect, useState } from "react";
import { listCards, createUpdate, editUpdate, deleteUpdate } from "../api";

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
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
    </div>
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
