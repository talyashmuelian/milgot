import { MONTH_NAMES } from "../months";
import { avrechReportPdfUrl, monthReportPdfUrl } from "../api";

export default function MonthsSidebar({
  avrechId,
  avrechName,
  year,
  onYearChange,
  selectedMonth,
  onSelectMonth,
}) {
  return (
    <aside className="sidebar months-sidebar">
      <h3>{avrechName}</h3>

      <div className="year-picker">
        <button onClick={() => onYearChange(year - 1)}>‹</button>
        <span>{year}</span>
        <button onClick={() => onYearChange(year + 1)}>›</button>
      </div>

      <button
        className="pdf-link full-width"
        onClick={() => window.open(avrechReportPdfUrl(avrechId, year), "_blank")}
      >
        הורד PDF לכל השנה
      </button>

      <ul className="months-list">
        {MONTH_NAMES.map((name, index) => {
          const monthNum = index + 1;
          return (
            <li key={monthNum} className={monthNum === selectedMonth ? "selected" : ""}>
              <button onClick={() => onSelectMonth(monthNum)}>{name}</button>
              <button
                className="pdf-link icon-btn"
                title="הורד PDF לכל האברכים בחודש זה"
                onClick={() => window.open(monthReportPdfUrl(year, monthNum), "_blank")}
              >
                PDF
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
