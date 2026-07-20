import { useState } from "react";
import { backupUrl, restoreBackup } from "../api";

export default function BackupPage({ onRestored }) {
  const [fileName, setFileName] = useState(null);
  const [pendingData, setPendingData] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState(null);

  function handleFileChange(e) {
    const file = e.target.files[0];
    setMessage(null);
    setPendingData(null);
    setFileName(null);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        setPendingData(data);
        setFileName(file.name);
      } catch {
        setMessage({ type: "error", text: "הקובץ שנבחר אינו קובץ JSON תקין." });
      }
    };
    reader.readAsText(file);
  }

  async function handleRestore() {
    if (!pendingData) return;
    const confirmed = window.confirm(
      "פעולה זו תמחק את כל הנתונים הקיימים במערכת ותחליף אותם בנתונים מהקובץ שנבחר. הפעולה אינה הפיכה. להמשיך?"
    );
    if (!confirmed) return;

    setRestoring(true);
    setMessage(null);
    try {
      const result = await restoreBackup(pendingData);
      setMessage({
        type: "success",
        text: `השחזור הצליח: ${result.avreichim} אברכים ו-${result.monthly_records} רשומות חודשיות נטענו מחדש.`,
      });
      setPendingData(null);
      setFileName(null);
      if (onRestored) onRestored();
    } catch (err) {
      setMessage({ type: "error", text: "השחזור נכשל: " + err.message });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <main className="backup-page">
      <section className="backup-section">
        <h2>גיבוי</h2>
        <p>מוריד קובץ JSON עם כל הנתונים הקיימים במערכת: אברכים, רשומות חודשיות, שעות חודשיות ואילו ימים הוחרגו בלוח השנה.</p>
        <button
          className="pdf-link full-width"
          onClick={() => window.open(backupUrl(), "_blank")}
        >
          הורד גיבוי
        </button>
      </section>

      <hr className="divider" />

      <section className="backup-section">
        <h2>שחזור</h2>
        <p className="restore-warning">
          שימו לב: שחזור מגיבוי <strong>ימחק את כל הנתונים הקיימים</strong> במערכת ויחליף אותם
          בנתונים מהקובץ שנבחר. הפעולה אינה הפיכה — מומלץ להוריד גיבוי עדכני לפני שמשחזרים.
        </p>
        <input type="file" accept="application/json" onChange={handleFileChange} />
        {fileName && <p className="backup-filename">נבחר קובץ: {fileName}</p>}
        <div className="field-row calc-row">
          <button onClick={handleRestore} disabled={!pendingData || restoring}>
            {restoring ? "משחזר..." : "שחזר מגיבוי"}
          </button>
        </div>
        {message && (
          <p className={message.type === "error" ? "backup-error" : "backup-success"}>
            {message.text}
          </p>
        )}
      </section>
    </main>
  );
}
