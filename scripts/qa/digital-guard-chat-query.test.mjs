import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";
const { buildGuardJournalQuery: plan, guardQueryClarification: explain } = loadTs("lib/domain/digital-observer/guard-chat-query.ts");
const site = "00000000-0000-4000-8000-000000000001";
const camera = "00000000-0000-4000-8000-000000000002";
const other = "00000000-0000-4000-8000-000000000003";
const context = { observerSiteId: site, timeZone: "Asia/Jerusalem", now: new Date("2026-08-31T21:30:00Z"), cameras: [
  { id: camera, observerSiteId: site, name: "מצלמה ראשית", zoneName: "דלת קדמית", aliases: ["Front Door", "כניסה"] },
  { id: other, observerSiteId: other, name: "מצלמה זרה", zoneName: "חניה" }
] };
const today = { window: { kind: "relative", day: "today" } };
test("today is resolved using the site's calendar day, not server UTC", () => {
  const query = plan(today, context);
  assert.equal(query.fromInclusive, "2026-08-31T21:00:00.000Z");
  assert.equal(query.toExclusive, "2026-09-01T21:00:00.000Z");
  assert.equal(query.hardwareActions, 0); assert.equal(query.historicalOnly, true);
});
test("entrance history 14:00–17:00 resolves exact camera, offset and typed filters", () => {
  const query = plan({ ...today, cameraZoneName: "  front   DOOR ", window: { kind: "date", date: "2026-08-31", fromTime: "14:00", toTime: "17:00" }, eventTypes: ["ENTRY", "ENTRY"], reviewStatuses: ["needs_review"] }, context);
  assert.equal(query.cameraSourceId, camera); assert.equal(query.fromInclusive, "2026-08-31T11:00:00.000Z");
  assert.equal(query.toExclusive, "2026-08-31T14:00:00.000Z"); assert.deepEqual(query.eventTypes, ["ENTRY"]);
});
test("yesterday and winter days use the configured timezone offset", () => {
  const query = plan({ window: { kind: "relative", day: "yesterday" } }, { ...context, now: new Date("2026-01-01T22:30:00Z") });
  assert.equal(query.fromInclusive, "2025-12-31T22:00:00.000Z"); assert.equal(query.toExclusive, "2026-01-01T22:00:00.000Z");
});
test("same-name cameras require clarification instead of silently broadening the query", () => {
  const scoped = { ...context, cameras: [...context.cameras, { id: other, observerSiteId: site, name: "כניסה" }] };
  assert.throws(() => plan({ ...today, cameraZoneName: "כניסה" }, scoped), /AMBIGUOUS_ZONE/);
  assert.equal(plan({ ...today, cameraZoneName: "כניסה", cameraSourceId: camera }, scoped).cameraSourceId, camera);
});
test("foreign camera IDs and aliases never enter the query plan", () => {
  assert.throws(() => plan({ ...today, cameraSourceId: other }, context), /OUTSIDE_SITE/);
  assert.throws(() => plan({ ...today, cameraZoneName: "חניה" }, context), /UNKNOWN_ZONE/);
});
test("camera selection and alias must refer to the same camera", () => {
  const scoped = { ...context, cameras: [...context.cameras, { id: other, observerSiteId: site, name: "בריכה" }] };
  assert.throws(() => plan({ ...today, cameraSourceId: camera, cameraZoneName: "בריכה" }, scoped), /MISMATCH/);
});
test("invalid calendar dates, reversed windows and oversized ranges fail closed", () => {
  for (const window of [
    { kind: "date", date: "2026-02-30" }, { kind: "date", date: "2026-08-31", fromTime: "17:00", toTime: "14:00" },
    { kind: "instant", from: "2026-01-01T00:00:00Z", to: "2026-03-01T00:00:00Z" }
  ]) assert.throws(() => plan({ window }, context));
});
test("unknown query keys cannot grant actions, alter the tenant or supply raw database filters", () => {
  for (const extra of [{ observerSiteId: other }, { confirmed: true }, { raw_filter: "or(anything)" }, { limit: 500 }]) assert.throws(() => plan({ ...today, ...extra }, context));
});
test("spring DST skips and autumn DST repeats require explicit timestamps", () => {
  const us = { ...context, timeZone: "America/New_York" };
  assert.throws(() => plan({ window: { kind: "date", date: "2026-03-08", fromTime: "02:30", toTime: "04:00" } }, us), /NONEXISTENT_LOCAL_TIME/);
  assert.throws(() => plan({ window: { kind: "date", date: "2026-11-01", fromTime: "01:30", toTime: "03:00" } }, us), /AMBIGUOUS_LOCAL_TIME/);
  const query = plan({ window: { kind: "instant", from: "2026-11-01T01:30:00-04:00", to: "2026-11-01T01:30:00-05:00" } }, us);
  assert.equal(Date.parse(query.toExclusive) - Date.parse(query.fromInclusive), 3_600_000);
});
test("full calendar days can be 23 or 25 hours across DST", () => {
  const us = { ...context, timeZone: "America/New_York" };
  for (const [date, hours] of [["2026-03-08", 23], ["2026-11-01", 25]]) {
    const query = plan({ window: { kind: "date", date } }, us);
    assert.equal(Date.parse(query.toExclusive) - Date.parse(query.fromInclusive), hours * 3_600_000);
  }
});
test("invalid tenant timezone is rejected and error text does not echo input", () => {
  assert.throws(() => plan(today, { ...context, timeZone: "invalid-private-value" }));
  assert.throws(() => plan(today, { ...context, timeZone: undefined }));
  assert.ok(!explain(Error("invalid-private-value")).includes("invalid-private-value"));
});
