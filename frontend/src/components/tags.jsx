import { useState } from "react";
import { createTag, renameTag, deleteTag, setDonorTags } from "../api";

/** Read-only chips of the tags set on a donor (shown on the card even when collapsed). */
export function DonorTagChips({ donor, tags }) {
  const own = tags.filter((t) => donor.tag_ids.includes(t.id));
  if (own.length === 0) return null;
  return (
    <div className="donor-tag-chips">
      {own.map((t) => (
        <span key={t.id} className="tag-chip is-on is-small">
          {t.name}
        </span>
      ))}
    </div>
  );
}

/** Inside an open card: toggle any tag on/off, or create a new one and set it. */
export function DonorTagsEditor({ donor, tags, onChanged }) {
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(tagIds) {
    setBusy(true);
    try {
      await setDonorTags(donor.id, tagIds);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  function toggle(tagId) {
    const has = donor.tag_ids.includes(tagId);
    save(has ? donor.tag_ids.filter((id) => id !== tagId) : [...donor.tag_ids, tagId]);
  }

  async function handleCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setError("");
    const existing = tags.find((t) => t.name === name);
    try {
      const tag = existing || (await createTag(name));
      setNewName("");
      if (!donor.tag_ids.includes(tag.id)) await save([...donor.tag_ids, tag.id]);
      else await onChanged();
    } catch {
      setError("לא הצלחתי ליצור את התגית");
    }
  }

  return (
    <div className="donor-tags">
      <h4>תגיות</h4>
      <div className="tag-chip-list">
        {tags.map((t) => {
          const on = donor.tag_ids.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              className={`tag-chip ${on ? "is-on" : ""}`}
              disabled={busy}
              aria-pressed={on}
              onClick={() => toggle(t.id)}
            >
              {on ? "✓ " : ""}
              {t.name}
            </button>
          );
        })}
      </div>
      <form className="tag-new-form" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="תגית חדשה..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="btn-primary btn-sm" disabled={busy || !newName.trim()}>
          + הוסף וסמן
        </button>
      </form>
      {error && <p className="tag-error">{error}</p>}
    </div>
  );
}

function TagManagerRow({ tag, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [error, setError] = useState("");

  async function handleSave(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError("");
    try {
      if (trimmed !== tag.name) await renameTag(tag.id, trimmed);
      await onChanged();
      setEditing(false);
    } catch {
      setError("כבר קיימת תגית בשם הזה");
    }
  }

  async function handleDelete() {
    if (!window.confirm(`למחוק את התגית "${tag.name}"? היא תוסר מכל הכרטיסים.`)) return;
    await deleteTag(tag.id);
    await onChanged();
  }

  if (editing) {
    return (
      <li className="tag-manager-row">
        <form onSubmit={handleSave}>
          <input type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="icon-btn" title="שמור">
            ✓
          </button>
          <button
            type="button"
            className="icon-btn"
            title="בטל"
            onClick={() => {
              setName(tag.name);
              setEditing(false);
            }}
          >
            ✕
          </button>
        </form>
        {error && <span className="tag-error">{error}</span>}
      </li>
    );
  }

  return (
    <li className="tag-manager-row">
      <span>{tag.name}</span>
      <span className="row-actions">
        <button className="icon-btn" title="שנה שם" onClick={() => setEditing(true)}>
          ✎
        </button>
        <button className="icon-btn" title="מחק תגית" onClick={handleDelete}>
          🗑
        </button>
      </span>
    </li>
  );
}

/** Top-of-page filter: pick tags to narrow the visible donor cards. */
export function TagFilterBar({ tags, donors, selected, onSelectedChange, matchAll, onMatchAllChange, onTagsChanged }) {
  const [managing, setManaging] = useState(false);
  const [newName, setNewName] = useState("");

  function toggle(tagId) {
    onSelectedChange(
      selected.includes(tagId) ? selected.filter((id) => id !== tagId) : [...selected, tagId]
    );
  }

  async function handleCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || tags.some((t) => t.name === name)) return;
    await createTag(name);
    setNewName("");
    await onTagsChanged();
  }

  return (
    <div className="tag-filter">
      <div className="tag-filter-row">
        <span className="tag-filter-label">סינון לפי תגיות:</span>
        <div className="tag-chip-list">
          {tags.map((t) => {
            const on = selected.includes(t.id);
            const count = donors.filter((d) => d.tag_ids.includes(t.id)).length;
            return (
              <button
                key={t.id}
                type="button"
                className={`tag-chip ${on ? "is-on" : ""}`}
                aria-pressed={on}
                onClick={() => toggle(t.id)}
              >
                {t.name} <span className="tag-count">({count})</span>
              </button>
            );
          })}
        </div>
        {selected.length > 1 && (
          <div className="cal-view-toggle tag-match-toggle">
            <button className={!matchAll ? "active" : ""} onClick={() => onMatchAllChange(false)}>
              אחת מהן
            </button>
            <button className={matchAll ? "active" : ""} onClick={() => onMatchAllChange(true)}>
              כולן
            </button>
          </div>
        )}
        {selected.length > 0 && (
          <button className="link-btn" onClick={() => onSelectedChange([])}>
            נקה סינון
          </button>
        )}
        <button className="link-btn tag-manage-toggle" onClick={() => setManaging((v) => !v)}>
          {managing ? "סגור ניהול תגיות" : "ניהול תגיות"}
        </button>
      </div>

      {managing && (
        <div className="tag-manager">
          <ul>
            {tags.map((t) => (
              <TagManagerRow key={t.id} tag={t} onChanged={onTagsChanged} />
            ))}
          </ul>
          <form className="tag-new-form" onSubmit={handleCreate}>
            <input
              type="text"
              placeholder="שם תגית חדשה..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" className="btn-primary btn-sm" disabled={!newName.trim()}>
              + הוסף תגית
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
