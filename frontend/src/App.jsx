import { useEffect, useRef, useState } from "react";
import StudentsSidebar from "./components/StudentsSidebar";
import MonthsSidebar from "./components/MonthsSidebar";
import RecordPanel from "./components/RecordPanel";
import AvrechCard from "./components/AvrechCard";
import CalendarPage from "./components/CalendarPage";
import SummaryPage from "./components/SummaryPage";
import BackupPage from "./components/BackupPage";
import ArchivePage from "./components/ArchivePage";
import CardsPage from "./components/CardsPage";
import {
  listAvreichim,
  createAvrech,
  updateAvrech,
  archiveAvrech,
  getRecord,
  calculateAttendance,
  calculateTotal,
  getAvrechCard,
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
  const [avrechCard, setAvrechCard] = useState(null);
  const [mainView, setMainView] = useState("record"); // "record" | "card"
  const recordPanelRef = useRef(null);

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

  useEffect(() => {
    if (selectedAvrechId == null) {
      setAvrechCard(null);
      return;
    }
    refreshAvrechCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAvrechId]);

  function refreshAvreichim() {
    return listAvreichim().then(setAvreichim);
  }

  function refreshAvrechCard() {
    if (selectedAvrechId == null) return Promise.resolve();
    return getAvrechCard(selectedAvrechId).then(setAvrechCard);
  }

  async function handleAdd(name, childrenCount) {
    const avrech = await createAvrech(name, childrenCount);
    await refreshAvreichim();
    setSelectedAvrechId(avrech.id);
  }

  async function handleRename(id, name, childrenCount) {
    await updateAvrech(id, name, childrenCount, avreichim.find((a) => a.id === id)?.is_fixed);
    await refreshAvreichim();
  }

  async function handleToggleFixed() {
    if (!selectedAvrech) return;
    await updateAvrech(
      selectedAvrech.id,
      selectedAvrech.name,
      selectedAvrech.children_count,
      !selectedAvrech.is_fixed
    );
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

  async function handleSelectAvrech(id) {
    await recordPanelRef.current?.flush();
    setSelectedAvrechId(id);
    setSelectedMonth(null);
    setMainView("record");
  }

  async function handleSelectMonth(month) {
    await recordPanelRef.current?.flush();
    setSelectedMonth(month);
    setMainView("record");
  }

  async function handleSelectCard() {
    await recordPanelRef.current?.flush();
    setMainView("card");
  }

  async function handleYearChange(newYear) {
    await recordPanelRef.current?.flush();
    setYear(newYear);
  }

  async function handleTabChange(tab) {
    await recordPanelRef.current?.flush();
    setActiveTab(tab);
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
  const reminders = (avrechCard?.updates || []).filter((u) => u.monthly_reminder);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>מעקב מלגות אברכים</h1>
        <nav className="tab-nav">
          <button
            className={activeTab === "students" ? "active" : ""}
            onClick={() => handleTabChange("students")}
          >
            אברכים
          </button>
          <button
            className={activeTab === "cards" ? "active" : ""}
            onClick={() => handleTabChange("cards")}
          >
            כרטיסים
          </button>
          <button
            className={activeTab === "calendar" ? "active" : ""}
            onClick={() => handleTabChange("calendar")}
          >
            לוח שנה
          </button>
          <button
            className={activeTab === "summary" ? "active" : ""}
            onClick={() => handleTabChange("summary")}
          >
            סיכום כללי
          </button>
          <button
            className={activeTab === "backup" ? "active" : ""}
            onClick={() => handleTabChange("backup")}
          >
            גיבוי ושחזור
          </button>
          <button
            className={activeTab === "archive" ? "active" : ""}
            onClick={() => handleTabChange("archive")}
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
              onYearChange={handleYearChange}
              selectedMonth={selectedMonth}
              onSelectMonth={handleSelectMonth}
              cardSelected={mainView === "card"}
              onSelectCard={handleSelectCard}
            />
          )}

          {mainView === "card" && avrechCard ? (
            <AvrechCard avrech={avrechCard} onChanged={refreshAvrechCard} defaultOpen />
          ) : (
            <RecordPanel
              ref={recordPanelRef}
              avrechId={selectedAvrechId}
              year={year}
              month={selectedMonth}
              record={record}
              loading={loadingRecord}
              reminders={reminders}
              isFixed={selectedAvrech?.is_fixed || false}
              onToggleFixed={handleToggleFixed}
              onCalculateAttendance={handleCalculateAttendance}
              onCalculateTotal={handleCalculateTotal}
            />
          )}
        </div>
      ) : activeTab === "cards" ? (
        <CardsPage />
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
