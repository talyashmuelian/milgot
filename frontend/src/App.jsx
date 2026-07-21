import { useEffect, useState } from "react";
import StudentsSidebar from "./components/StudentsSidebar";
import MonthsSidebar from "./components/MonthsSidebar";
import RecordPanel from "./components/RecordPanel";
import CalendarPage from "./components/CalendarPage";
import SummaryPage from "./components/SummaryPage";
import BackupPage from "./components/BackupPage";
import ArchivePage from "./components/ArchivePage";
import {
  listAvreichim,
  createAvrech,
  updateAvrech,
  archiveAvrech,
  getRecord,
  calculateAttendance,
  calculateTotal,
} from "./api";
import "./App.css";

const CURRENT_YEAR = new Date().getFullYear();

export default function App() {
  const [activeTab, setActiveTab] = useState("students");
  const [avreichim, setAvreichim] = useState([]);
  const [selectedAvrechId, setSelectedAvrechId] = useState(null);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [record, setRecord] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(false);

  useEffect(() => {
    refreshAvreichim();
  }, []);

  useEffect(() => {
    if (selectedAvrechId == null || selectedMonth == null) {
      setRecord(null);
      return;
    }
    setLoadingRecord(true);
    getRecord(selectedAvrechId, year, selectedMonth)
      .then(setRecord)
      .finally(() => setLoadingRecord(false));
  }, [selectedAvrechId, year, selectedMonth]);

  function refreshAvreichim() {
    return listAvreichim().then(setAvreichim);
  }

  async function handleAdd(name, childrenCount) {
    const avrech = await createAvrech(name, childrenCount);
    await refreshAvreichim();
    setSelectedAvrechId(avrech.id);
  }

  async function handleRename(id, name, childrenCount) {
    await updateAvrech(id, name, childrenCount);
    await refreshAvreichim();
  }

  async function handleArchive(id) {
    await archiveAvrech(id);
    if (selectedAvrechId === id) {
      setSelectedAvrechId(null);
      setSelectedMonth(null);
    }
    await refreshAvreichim();
  }

  function handleSelectAvrech(id) {
    setSelectedAvrechId(id);
    setSelectedMonth(null);
  }

  async function handleCalculateAttendance(studyHours, excludedHours) {
    const updated = await calculateAttendance(
      selectedAvrechId,
      year,
      selectedMonth,
      studyHours,
      excludedHours
    );
    setRecord(updated);
  }

  async function handleCalculateTotal(checkboxes) {
    const updated = await calculateTotal(selectedAvrechId, year, selectedMonth, checkboxes);
    setRecord(updated);
  }

  const selectedAvrech = avreichim.find((a) => a.id === selectedAvrechId) || null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>מעקב מלגות אברכים</h1>
        <nav className="tab-nav">
          <button
            className={activeTab === "students" ? "active" : ""}
            onClick={() => setActiveTab("students")}
          >
            אברכים
          </button>
          <button
            className={activeTab === "calendar" ? "active" : ""}
            onClick={() => setActiveTab("calendar")}
          >
            לוח שנה
          </button>
          <button
            className={activeTab === "summary" ? "active" : ""}
            onClick={() => setActiveTab("summary")}
          >
            סיכום כללי
          </button>
          <button
            className={activeTab === "backup" ? "active" : ""}
            onClick={() => setActiveTab("backup")}
          >
            גיבוי ושחזור
          </button>
          <button
            className={activeTab === "archive" ? "active" : ""}
            onClick={() => setActiveTab("archive")}
          >
            ארכיון
          </button>
        </nav>
      </header>

      {activeTab === "students" ? (
        <div className="app-layout">
          <StudentsSidebar
            avreichim={avreichim}
            selectedAvrechId={selectedAvrechId}
            onSelect={handleSelectAvrech}
            onAdd={handleAdd}
            onRename={handleRename}
            onArchive={handleArchive}
          />

          {selectedAvrech && (
            <MonthsSidebar
              avrechId={selectedAvrech.id}
              avrechName={selectedAvrech.name}
              year={year}
              onYearChange={setYear}
              selectedMonth={selectedMonth}
              onSelectMonth={setSelectedMonth}
            />
          )}

          <RecordPanel
            avrechId={selectedAvrechId}
            year={year}
            month={selectedMonth}
            record={record}
            loading={loadingRecord}
            onCalculateAttendance={handleCalculateAttendance}
            onCalculateTotal={handleCalculateTotal}
          />
        </div>
      ) : activeTab === "calendar" ? (
        <CalendarPage />
      ) : activeTab === "summary" ? (
        <SummaryPage />
      ) : activeTab === "backup" ? (
        <BackupPage onRestored={refreshAvreichim} />
      ) : (
        <ArchivePage />
      )}
    </div>
  );
}
