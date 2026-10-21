// Date helpers for the donations area.

export function isoDate(date) {
  // Local date (not UTC) so late-night actions still land on today.
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso() {
  return isoDate(new Date());
}

export function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function reminderMatches(reminder, term) {
  return [reminder.title, reminder.note, reminder.donor_name].some(
    (value) => value && value.toLowerCase().includes(term)
  );
}
