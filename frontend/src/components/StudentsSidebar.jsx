import { useState } from "react";

export default function StudentsSidebar({
  avreichim,
  selectedAvrechId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
}) {
  const [newName, setNewName] = useState("");
  const [newChildren, setNewChildren] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingChildren, setEditingChildren] = useState("");

  function submitNew(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onAdd(name, newChildren === "" ? 0 : Number(newChildren));
    setNewName("");
    setNewChildren("");
  }

  function startEdit(avrech) {
    setEditingId(avrech.id);
    setEditingName(avrech.name);
    setEditingChildren(String(avrech.children_count ?? 0));
  }

  function submitEdit(e) {
    e.preventDefault();
    const name = editingName.trim();
    if (!name) return;
    onRename(editingId, name, editingChildren === "" ? 0 : Number(editingChildren));
    setEditingId(null);
  }

  return (
    <aside className="sidebar students-sidebar">
      <h2>אברכים</h2>

      <form className="add-form" onSubmit={submitNew}>
        <input
          type="text"
          placeholder="שם אברך חדש"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          type="number"
          className="children-input"
          placeholder="ילדים"
          min="0"
          value={newChildren}
          onChange={(e) => setNewChildren(e.target.value)}
        />
        <button type="submit">הוסף</button>
      </form>

      <ul className="students-list">
        {avreichim.map((avrech) => (
          <li key={avrech.id} className={avrech.id === selectedAvrechId ? "selected" : ""}>
            {editingId === avrech.id ? (
              <form className="edit-form" onSubmit={submitEdit}>
                <input
                  type="text"
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                />
                <div className="edit-form-row">
                  <label className="edit-form-children-label">
                    ילדים
                    <input
                      type="number"
                      className="children-input"
                      min="0"
                      value={editingChildren}
                      onChange={(e) => setEditingChildren(e.target.value)}
                    />
                  </label>
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
                <button className="student-name" onClick={() => onSelect(avrech.id)}>
                  {avrech.name}
                  {avrech.children_count > 0 && (
                    <span className="children-badge"> ({avrech.children_count})</span>
                  )}
                </button>
                <span className="row-actions">
                  <button
                    className="icon-btn"
                    title="ערוך"
                    onClick={() => startEdit(avrech)}
                  >
                    ✎
                  </button>
                  <button
                    className="icon-btn"
                    title="מחק"
                    onClick={() => {
                      if (window.confirm(`למחוק את ${avrech.name}?`)) {
                        onDelete(avrech.id);
                      }
                    }}
                  >
                    🗑
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
