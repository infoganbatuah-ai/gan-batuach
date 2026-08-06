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
