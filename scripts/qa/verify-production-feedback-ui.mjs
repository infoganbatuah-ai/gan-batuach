import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const [originValue, siteId, incidentId] = process.argv.slice(2);
const origin = new URL(originValue);
assert.equal(origin.origin, "https://ganbatuach.com", "Exact Production origin required");
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
assert.match(siteId ?? "", uuid, "Valid observer site ID required");
assert.match(incidentId ?? "", uuid, "Valid Incident ID required");

const allowed = new Set(["QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL", "QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD"]);
const config = {};
for (const file of [".env.qa-demo.local", ".env.local"]) {
  if (!existsSync(file)) continue;
  const values = parseEnv(readFileSync(file, "utf8"));
  for (const key of allowed) if (!config[key] && values[key]) config[key] = values[key];
}
assert.ok(config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL && config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD,
  "Authorized Production admin QA configuration is missing");

const form = new FormData();
form.set("email", config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL);
form.set("password", config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD);
form.set("next", "/digital-observer/admin/quality");
form.set("observer_account_type", "home");
const login = await fetch(new URL("/api/digital-observer/auth/login", origin), {
  method: "POST",
  body: form,
  redirect: "manual",
  signal: AbortSignal.timeout(30_000)
});
assert.equal(login.status, 303, `Production UI login failed with HTTP ${login.status}`);
const setCookies = login.headers.getSetCookie();
assert.ok(setCookies.length > 0, "Production UI login did not establish an authenticated cookie session");
const cookieHeader = setCookies.map((value) => value.split(";", 1)[0]).join("; ");

async function render(path) {
  const response = await fetch(new URL(path, origin), {
    headers: { accept: "text/html", cookie: cookieHeader },
    redirect: "manual",
    signal: AbortSignal.timeout(30_000)
  });
  const html = await response.text();
  assert.equal(response.status, 200, `Authorized Product page ${path} failed with HTTP ${response.status}`);
  return html;
}

const quality = await render("/digital-observer/admin/quality");
for (const expected of [
  "איכות וכיול", "תקריות שנבדקו", "פעילות אמיתית וצפויה", "False Detection Rate",
  "Recall", "לא זמין", "do-feedback-dataset-v1", "CONTEXT_BASELINE_REVIEW",
  "INSUFFICIENT_SAMPLE", "שינוי אוטומטי ב‑Production", "חסום"
]) assert.ok(quality.includes(expected), `Admin quality UI is missing ${expected}`);

const detail = await render(`/digital-observer/incidents?site=${siteId}&incident=${incidentId}`);
for (const expected of [incidentId, "משוב על התקרית", "המשוב הנוכחי", "Ground Truth שנבדק", "אמיתי אבל צפוי", "למידה מבוקרת בלבד"])
  assert.ok(detail.includes(expected), `Incident feedback UI is missing ${expected}`);

console.log(JSON.stringify({
  status: "PASS",
  incident_id: incidentId,
  admin_quality_ui: "RENDERED_AUTHORIZED",
  incident_feedback_ui: "RENDERED_AUTHORIZED",
  expected_activity_visible: true,
  ground_truth_visible: true,
  recall_truthfully_unavailable: true,
  automatic_production_change_blocked: true
}, null, 2));
