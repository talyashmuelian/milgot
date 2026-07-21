import { useEffect, useState } from "react";
import { listArchivedAvreichim, unarchiveAvrech, deleteAvrech } from "../api";

export default function ArchivePage() {
  const [archived, setArchived] = useState([]);
  const [loading, setLoading] = useState(true);

  function refresh() {
    setLoading(true);
    return listArchivedAvreichim()
      .then(setArchived)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleRestore(avrech) {
    await unarchiveAvrech(avrech.id);
    await refresh();
  }

  async function handleDelete(avrech) {
    if (
      !window.confirm(
        `למחוק את ${avrech.name} לצמיתות? כל הנתונים וההיסטוריה שלו יימחקו לצמיתות ולא ניתן יהיה לשחזר אותם.`
      )
    ) {
      return;
    }
    await deleteAvrech(avrech.id);
    await refresh();
  }

  return (
    <main className="archive-page">
      <div className="archive-section">
        <h2>ארכיון</h2>
        <p>אברכים שהועברו לארכיון. ניתן לשחזר אותם בחזרה לרשימה הפעילה, או למחוק אותם לצמיתות.</p>

        {loading ? (
          <p>טוען...</p>
        ) : archived.length === 0 ? (
          <p className="archive-empty">אין אברכים בארכיון.</p>
        ) : (
          <ul className="archive-list">
            {archived.map((avrech) => (
              <li key={avrech.id}>
                <span className="archive-name">
                  {avrech.name}
                  {avrech.children_count > 0 && (
                    <span className="children-badge"> ({avrech.children_count})</span>
                  )}
                </span>
                <span className="row-actions">
                  <button className="pdf-link" onClick={() => handleRestore(avrech)}>
                    שחזר
                  </button>
                  <button className="pdf-link archive-delete-link" onClick={() => handleDelete(avrech)}>
                    מחק לצמיתות
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
