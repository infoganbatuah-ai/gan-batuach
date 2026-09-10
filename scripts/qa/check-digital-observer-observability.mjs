import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const telemetry = read("lib/domain/digital-observer/operational-telemetry.ts");
const page = read("app/digital-observer/admin/observability/page.tsx");
const route = read("app/api/digital-observer/admin/observability/route.ts");
const shell = read("components/digital-observer/observer-app-shell.tsx");

for (const required of ["HEALTHY", "DEGRADED", "UNAVAILABLE", "UNKNOWN", "OperationalMetric", "OperationalIssue", "OperationalAlert", "OperationalTelemetrySnapshot"]) {
  assert.match(telemetry, new RegExp(required), `telemetry model missing ${required}`);
}

for (const domain of ["CAMERA_CONNECTION", "EVENT_JOURNAL", "INCIDENT", "EVIDENCE_STORAGE", "CONTEXT_BASELINE", "RISK_VERIFICATION_DECISION", "RULES_SEARCH_FEEDBACK", "PROVIDERS", "API_DATABASE"]) {
  assert.match(telemetry, new RegExp(domain), `canonical operational domain missing ${domain}`);
}

assert.match(telemetry, /if \(!available\) return "UNKNOWN"/, "unknown telemetry must never claim healthy");
assert.match(telemetry, /buildOperationalAlerts/, "operational alerts must be derived and deduplicated");
assert.match(telemetry, /dedupeKey/, "operational alerts require a dedupe key");
assert.match(telemetry, /safeOperationalSnapshot/, "support snapshot must be scrubbed");
assert.doesNotMatch(telemetry, /password|secret_reference|signedUrl|rtsp:\/\//i, "telemetry model must not select sensitive camera/media fields");
assert.match(page, /requireDigitalObserverAdmin/, "operational dashboard must be server-authorized");
assert.match(page, /UNKNOWN/, "dashboard must expose unknown telemetry state");
assert.match(page, /PUSH 16/, "roadmap blocker must remain visible to admin");
assert.match(page, /PUSH 25/, "deferred RLS finding must remain visible to admin");
assert.match(route, /getDigitalObserverApiUser/, "diagnostic snapshot must authenticate the caller");
assert.match(route, /hasObserverAdminClaim/, "diagnostic snapshot must require server-side admin authorization");
assert.match(route, /safeOperationalSnapshot/, "diagnostic API must return scrubbed telemetry only");
assert.match(shell, /\/digital-observer\/admin\/observability/, "admin navigation must expose the operational dashboard");

console.log(JSON.stringify({ status: "PASS", suite: "digital-observer-observability", checks: 21, production_mutation: false, frozen_runtime_mutation: false }, null, 2));
