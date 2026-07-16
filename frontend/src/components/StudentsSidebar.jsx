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
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  function submitNew(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onAdd(name);
    setNewName("");
  }

  function startEdit(avrech) {
    setEditingId(avrech.id);
    setEditingName(avrech.name);
  }

  function submitEdit(e) {
    e.preventDefault();
    const name = editingName.trim();
    if (!name) return;
    onRename(editingId, name);
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
                  onBlur={() => setEditingId(null)}
                />
              </form>
            ) : (
              <>
                <button className="student-name" onClick={() => onSelect(avrech.id)}>
                  {avrech.name}
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
