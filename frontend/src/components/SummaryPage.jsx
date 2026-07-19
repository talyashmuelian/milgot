import { useEffect, useState } from "react";
import { MONTH_NAMES } from "../months";
import {
  listAvreichim,
  getMonthReport,
  getAvrechReport,
  monthReportXlsxUrl,
  avrechReportXlsxUrl,
} from "../api";

const COLUMNS = [
  { key: "study_hours", label: "שעות לימוד", type: "number" },
  { key: "excluded_hours", label: "שעות מוחרגות", type: "number" },
  { key: "attendance_amount", label: "מלגת נוכחות", type: "amount" },
  { key: "with_american", label: "עם אמריקאי", type: "bool" },
  { key: "emuna", label: "אמונה", type: "bool" },
  { key: "tanach", label: 'תנ"ך', type: "bool" },
  { key: "ktiva", label: "כתיבה", type: "bool" },
  { key: "gemara_bekiut", label: "בקיאות", type: "bool" },
  { key: "review_test", label: "מבחן חזרה", type: "bool" },
  { key: "enrichment", label: "העשרות", type: "bool" },
  { key: "reserve_duty", label: "מילואים", type: "bool" },
  { key: "total_amount", label: 'סה"כ מלגה', type: "amount" },
];

const now = new Date();

function Cell({ column, record }) {
  const value = record[column.key];
  if (column.type === "bool") {
    return (
      <td className={value ? "bool-yes" : "bool-no"}>{value ? "כן" : "לא"}</td>
    );
  }
  if (column.type === "amount") {
    return <td className="amount-cell">{value != null ? `₪${value}` : "-"}</td>;
  }
  return <td>{value != null ? value : "-"}</td>;
}

export default function SummaryPage() {
  const [mode, setMode] = useState("month"); // "month" | "avrech"
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [avreichim, setAvreichim] = useState([]);
  const [selectedAvrechId, setSelectedAvrechId] = useState(null);
  const [monthRows, setMonthRows] = useState(null);
  const [avrechData, setAvrechData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listAvreichim().then((list) => {
      setAvreichim(list);
      if (list.length > 0) setSelectedAvrechId((prev) => prev ?? list[0].id);
    });
  }, []);

  useEffect(() => {
    if (mode === "month") {
      setLoading(true);
      getMonthReport(year, month)
        .then(setMonthRows)
        .finally(() => setLoading(false));
    }
  }, [mode, year, month]);

  useEffect(() => {
    if (mode === "avrech" && selectedAvrechId != null) {
      setLoading(true);
      getAvrechReport(selectedAvrechId, year)
        .then(setAvrechData)
        .finally(() => setLoading(false));
    }
  }, [mode, selectedAvrechId, year]);

  function goToMonth(delta) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setYear(newYear);
    setMonth(newMonth);
  }

  const rows =
    mode === "month"
      ? (monthRows || []).map((r) => ({ label: r.name, record: r }))
      : (avrechData?.months || []).map((r) => ({ label: MONTH_NAMES[r.month - 1], record: r }));

  return (
    <main className="summary-page">
      <div className="summary-controls">
        <div className="tab-nav summary-mode-toggle">
          <button
            className={mode === "month" ? "active" : ""}
            onClick={() => setMode("month")}
          >
            לפי חודש
          </button>
          <button
            className={mode === "avrech" ? "active" : ""}
            onClick={() => setMode("avrech")}
          >
            לפי אברך
          </button>
        </div>

        {mode === "month" ? (
          <div className="summary-nav">
            <button onClick={() => goToMonth(-1)}>‹</button>
            <h2>
              {MONTH_NAMES[month - 1]} {year}
            </h2>
            <button onClick={() => goToMonth(1)}>›</button>
          </div>
        ) : (
          <div className="summary-nav">
            <select
              value={selectedAvrechId ?? ""}
              onChange={(e) => setSelectedAvrechId(Number(e.target.value))}
            >
              {avreichim.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button onClick={() => setYear((y) => y - 1)}>‹</button>
            <h2>{year}</h2>
            <button onClick={() => setYear((y) => y + 1)}>›</button>
          </div>
        )}

        <button
          className="pdf-link summary-xlsx-link"
          onClick={() =>
            window.open(
              mode === "month"
                ? monthReportXlsxUrl(year, month)
                : avrechReportXlsxUrl(selectedAvrechId, year),
              "_blank"
            )
          }
        >
          הורד כקובץ Excel
        </button>
      </div>

      <div className="summary-table-wrap">
        {loading ? (
          <p>טוען...</p>
        ) : rows.length === 0 ? (
          <p className="summary-empty">
            {mode === "month" ? "אין עדיין אברכים במערכת" : "אין נתונים להצגה"}
          </p>
        ) : (
          <table className="summary-table">
            <thead>
              <tr>
                <th>{mode === "month" ? "שם אברך" : "חודש"}</th>
                {COLUMNS.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ label, record }, i) => (
                <tr key={i}>
                  <td className="row-label-cell">{label}</td>
                  {COLUMNS.map((col) => (
                    <Cell key={col.key} column={col} record={record} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
