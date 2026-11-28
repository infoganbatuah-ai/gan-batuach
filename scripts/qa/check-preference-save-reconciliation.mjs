import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { loadPersistedPreferences, saveAndReconcilePreferences } from "../../lib/management/preference-save-reconciliation.ts";

const persisted = { data: { preferences: { receive_email: false }, push_category_preferences: { message: false } } };
const reply = (status, body) => ({ ok: status < 400, json: async () => body });

test("successful save keeps editable state and confirms success", async () => {
  const calls = [];
  const result = await saveAndReconcilePreferences(async (_url, options) => {
    calls.push(options.method);
    return reply(200, { data: { saved: true } });
  }, { receive_email: true });
  assert.deepEqual(result, { status: "saved" });
  assert.deepEqual(calls, ["PATCH"]);
});

test("server 500 after a partial first write reloads actual persisted values", async () => {
  const calls = [];
  const result = await saveAndReconcilePreferences(async (_url, options) => {
    calls.push(options.method);
    return options.method === "PATCH" ? reply(500, { error: "second write failed" }) : reply(200, persisted);
  }, { receive_email: true });
  assert.deepEqual(calls, ["PATCH", "GET"]);
  assert.equal(result.status, "reconciled");
  assert.equal(result.snapshot.preferences.receive_email, false);
  assert.equal(result.snapshot.push_category_preferences.message, false);
  assert.match(result.message, /נטענו מחדש מהשרת/);
});

test("rejected PATCH and failed GET hides unverified choices", async () => {
  const result = await saveAndReconcilePreferences(async (_url, options) => {
    if (options.method === "PATCH") throw new Error("network lost");
    return reply(503, { error: "unavailable" });
  }, { receive_email: true });
  assert.equal(result.status, "unknown");
  assert.match(result.message, /הוסתרו/);
});

test("malformed PATCH response triggers a persisted refetch", async () => {
  const result = await saveAndReconcilePreferences(async (_url, options) =>
    options.method === "PATCH" ? { ok: true, json: async () => { throw new SyntaxError("bad JSON"); } } : reply(200, persisted), {});
  assert.equal(result.status, "reconciled");
  assert.equal(result.snapshot.preferences.receive_email, false);
});

test("malformed GET never manufactures saved consent", async () => {
  assert.equal(await loadPersistedPreferences(async () => reply(200, { data: { preferences: {}, push_category_preferences: { message: "yes" } } })), null);
});

test("shared component used by all four role pages hides the form on unknown result", () => {
  const component = readFileSync(new URL("../../components/parent-notification-preferences.tsx", import.meta.url), "utf8");
  assert.match(component, /unavailable \? <button[\s\S]*?NotificationPreferencesForm/);
  assert.match(component, /<div role="alert"/);
  for (const role of ["parent", "staff", "garden", "inspector"]) {
    const page = readFileSync(new URL(`../../app/dashboard/${role}/notifications/page.tsx`, import.meta.url), "utf8");
    assert.match(page, /NotificationPreferencesPanel|ParentNotificationPreferences/);
  }
});
