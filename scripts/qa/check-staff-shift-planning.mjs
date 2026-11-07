import assert from "node:assert/strict";
import { test } from "node:test";
import { staffAvailableOnDate, validateShiftPlan } from "../../lib/domain/staff-shift-planning.ts";

const staff = [
  { id: "staff-b", name: "עובדת ב", startDate: "2026-11-01", endDate: null },
  { id: "ended", name: "העסקה הסתיימה", startDate: "2026-01-01", endDate: "2026-11-08" },
  { id: "future", name: "מתחילה בעתיד", startDate: "2026-11-12", endDate: null }
];
const plan = { staffId: "staff-b", date: "2026-11-10", start: "08:00", end: "16:00", today: "2026-11-07", staff };

test("accepts a planned local shift for an active worker", () => {
  assert.equal(validateShiftPlan(plan), null);
  assert.equal(validateShiftPlan({ ...plan, start: "22:00", end: "06:00" }), null);
});

test("rejects past, impossible, malformed, and equal-time plans before POST", () => {
  assert.match(validateShiftPlan({ ...plan, date: "2026-11-06" }), /מהיום/);
  assert.match(validateShiftPlan({ ...plan, date: "2026-02-30" }), /תאריך תקין/);
  assert.match(validateShiftPlan({ ...plan, start: "25:00" }), /שעת התחלה/);
  assert.match(validateShiftPlan({ ...plan, end: "08:00" }), /שונות/);
});

test("rejects staff outside the supplied Garden eligibility set and employment dates", () => {
  assert.match(validateShiftPlan({ ...plan, staffId: "foreign-staff" }), /אינו מועסק/);
  assert.match(validateShiftPlan({ ...plan, staffId: "ended" }), /אינו מועסק/);
  assert.match(validateShiftPlan({ ...plan, staffId: "future" }), /אינו מועסק/);
  assert.equal(staffAvailableOnDate(staff[1], "2026-11-08"), true);
  assert.equal(staffAvailableOnDate(staff[1], "2026-11-09"), false);
});
