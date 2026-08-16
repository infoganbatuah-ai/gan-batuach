export function israelTodayDateParts(now = new Date()) {
  const weekday = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    timeZone: "Asia/Jerusalem"
  }).format(now);
  const hebrewDate = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jerusalem"
  }).format(now);
  const gregorianDate = new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jerusalem"
  }).format(now);

  return { weekday, hebrewDate, gregorianDate };
}

export function israelTodayDateLine(now = new Date()) {
  const { weekday, hebrewDate, gregorianDate } = israelTodayDateParts(now);
  return { top: `${weekday}, ${hebrewDate}`, bottom: gregorianDate };
}

export function israelTodayDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jerusalem"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
