// Local calendar days. All learning logic uses the device's local date, as
// "YYYY-MM-DD" keys, so a study day follows the learner's clock and time zone.

export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0); // noon avoids DST edge cases
}

export function addDays(key, n) {
  const dt = parseDay(key);
  dt.setDate(dt.getDate() + n);
  return dayKey(dt);
}

// Whole calendar days from a to b (b - a). Robust across DST changes.
export function diffDays(a, b) {
  const da = parseDay(a);
  const db = parseDay(b);
  return Math.round((db - da) / 86400000);
}

export function isValidDay(key) {
  return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && dayKey(parseDay(key)) === key;
}
