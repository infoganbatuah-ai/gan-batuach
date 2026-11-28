export type ShiftPlanningStaff = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
};

export function staffAvailableOnDate(staff: ShiftPlanningStaff, date: string) {
  return (!staff.startDate || staff.startDate <= date) && (!staff.endDate || staff.endDate >= date);
}

export function validateShiftPlan(input: {
  staffId: string;
  date: string;
  start: string;
  end: string;
  today: string;
  staff: ShiftPlanningStaff[];
}) {
  const parsedDate = Date.parse(`${input.date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(parsedDate) || new Date(parsedDate).toISOString().slice(0, 10) !== input.date) {
    return "בחרו תאריך תקין.";
  }
  if (input.date < input.today) return "אפשר לתכנן משמרת מהיום והלאה.";
  const selected = input.staff.find((person) => person.id === input.staffId);
  if (!selected || !staffAvailableOnDate(selected, input.date)) return "איש הצוות אינו מועסק בגן בתאריך שנבחר.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.end)) {
    return "בחרו שעת התחלה וסיום תקינות.";
  }
  if (input.start === input.end) return "שעות ההתחלה והסיום חייבות להיות שונות.";
  return null;
}
