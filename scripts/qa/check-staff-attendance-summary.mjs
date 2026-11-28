import test from "node:test";
import assert from "node:assert/strict";
import { formatStaffMinutes, staffRowsRead, staffShiftTimeLabel, staffSingleRead, summarizeStaffPeriod, verifiedShiftMinutes } from "../../lib/domain/staff-attendance-summary.ts";
import { israelTodayDateKey } from "../../lib/domain/israel-date.ts";

const closed = (shift_date, total_minutes, extra = {}) => ({
  shift_date, total_minutes,
  actual_start: `${shift_date}T07:00:00.000Z`,
  actual_end: `${shift_date}T08:30:00.000Z`,
  ...extra
});

test("server minutes are displayed as floor hours and remainder for metrics and rows", () => {
  for (const [minutes, hours, remainder] of [[0, "0 ש׳", "0 דק׳"], [59, "0 ש׳", "59 דק׳"], [60, "1 ש׳", "0 דק׳"], [90, "1 ש׳", "30 דק׳"], [125, "2 ש׳", "5 דק׳"]]) {
    assert.deepEqual(formatStaffMinutes(minutes), { hours, remainder });
    assert.equal(staffShiftTimeLabel(closed("2026-11-07", minutes)), `סה״כ ${hours} ${remainder}`);
    assert.deepEqual(summarizeStaffPeriod([closed("2026-11-07", minutes)], "month", "2026-11-07"), { minutes, state: "complete" });
  }
});

test("only closed, valid server totals count as verified work", () => {
  const open = closed("2026-11-07", 0, { actual_end: null });
  assert.equal(verifiedShiftMinutes(open), null);
  assert.equal(staffShiftTimeLabel(open), "שעות עבודה טרם אומתו");
  assert.deepEqual(summarizeStaffPeriod([open], "month", "2026-11-07"), { minutes: 0, state: "complete" });
  for (const row of [closed("2026-11-07", -1), closed("2026-11-07", null), closed("2026-11-07", 90, { actual_end: "2026-11-07T06:00:00Z" })]) {
    assert.equal(verifiedShiftMinutes(row), null);
    assert.equal(summarizeStaffPeriod([row], "month", "2026-11-07").state, "unavailable");
  }
});

test("Jerusalem date keys, including DST transitions, determine month and rolling seven days", () => {
  assert.equal(israelTodayDateKey(new Date("2026-10-31T22:30:00Z")), "2026-11-01");
  assert.equal(israelTodayDateKey(new Date("2026-03-26T22:30:00Z")), "2026-03-27");
  const rows = [closed("2026-11-01", 60), closed("2026-10-31", 90), closed("2026-10-26", 125), closed("2026-10-25", 59), closed("2026-11-02", 60)];
  assert.deepEqual(summarizeStaffPeriod(rows, "month", "2026-11-01"), { minutes: 60, state: "complete" });
  assert.deepEqual(summarizeStaffPeriod(rows, "lastSevenDays", "2026-11-01"), { minutes: 275, state: "complete" });
});

test("bounded query marks a potentially truncated period partial", () => {
  const rows = Array.from({ length: 45 }, () => closed("2026-11-07", 1));
  assert.deepEqual(summarizeStaffPeriod(rows, "month", "2026-11-07"), { minutes: 45, state: "partial" });
  assert.deepEqual(summarizeStaffPeriod([...rows.slice(0, 44), closed("2026-10-31", 1)], "month", "2026-11-07"), { minutes: 44, state: "complete" });
});

test("read failures never become verified empty data or a pending assignment", () => {
  assert.deepEqual(staffRowsRead({ data: [], error: null }), { state: "available", rows: [] });
  assert.deepEqual(staffRowsRead({ data: [{ id: "own" }], error: null }), { state: "available", rows: [{ id: "own" }] });
  assert.deepEqual(staffRowsRead({ data: [], error: { code: "unavailable" } }), { state: "unavailable", rows: [] });
  assert.deepEqual(staffRowsRead({ data: null, error: null }), { state: "unavailable", rows: [] });
  assert.deepEqual(staffSingleRead({ data: null, error: null }), { state: "available", value: null });
  assert.deepEqual(staffSingleRead({ data: null, error: { code: "denied" } }), { state: "unavailable", value: null });
});
