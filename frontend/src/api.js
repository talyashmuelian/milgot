const BASE_URL = "/api";

async function handle(res) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function listAvreichim() {
  return fetch(`${BASE_URL}/avreichim`).then(handle);
}

export function createAvrech(name, childrenCount) {
  return fetch(`${BASE_URL}/avreichim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, children_count: childrenCount }),
  }).then(handle);
}

export function updateAvrech(id, name, childrenCount) {
  return fetch(`${BASE_URL}/avreichim/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, children_count: childrenCount }),
  }).then(handle);
}

export function deleteAvrech(id) {
  return fetch(`${BASE_URL}/avreichim/${id}`, { method: "DELETE" }).then(handle);
}

export function getRecord(avrechId, year, month) {
  return fetch(`${BASE_URL}/records/${avrechId}/${year}/${month}`).then(handle);
}

export function calculateAttendance(avrechId, year, month, studyHours, excludedHours) {
  return fetch(`${BASE_URL}/records/${avrechId}/${year}/${month}/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ study_hours: studyHours, excluded_hours: excludedHours }),
  }).then(handle);
}

export function calculateTotal(avrechId, year, month, checkboxes) {
  return fetch(`${BASE_URL}/records/${avrechId}/${year}/${month}/total`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(checkboxes),
  }).then(handle);
}

export function recordPdfUrl(avrechId, year, month) {
  return `${BASE_URL}/records/${avrechId}/${year}/${month}/pdf`;
}

export function monthReportPdfUrl(year, month) {
  return `${BASE_URL}/reports/month/${year}/${month}/pdf`;
}

export function avrechReportPdfUrl(avrechId, year) {
  return `${BASE_URL}/reports/avrech/${avrechId}/${year}/pdf`;
}

export function getCalendarMonth(year, month) {
  return fetch(`${BASE_URL}/calendar/${year}/${month}`).then(handle);
}

export function saveMonthHours(year, month, hours) {
  return fetch(`${BASE_URL}/calendar/${year}/${month}/hours`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hours }),
  }).then(handle);
}
