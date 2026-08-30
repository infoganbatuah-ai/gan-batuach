import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const gateway = read("services/video-gateway/server.mjs");
const domain = read("lib/domain/video-gateway.ts");
const actionRoute = read("app/api/digital-observer/camera-actions/route.ts");
const gatewayActionRoute = read("app/api/video-gateway/camera-actions/route.ts");
const controls = read("components/digital-observer/observer-camera-controls.tsx");
const conversation = read("app/api/digital-observer/conversation/route.ts");
const migration = read("supabase/migrations/20260829030000_digital_observer_camera_action_approvals.sql");
const persistentGateway = read("scripts/run-persistent-home-gateway.mjs");
const eventMediaRoute = read("app/api/video-gateway/cloud-event-media/route.ts");
const privateNvrCapabilities = read("services/video-gateway/private-nvr-capabilities.mjs");

for (const capability of ["live", "playback", "audio_input", "audio_output", "talkback", "ptz", "relay", "siren", "light"]) {
  assert.match(gateway, new RegExp(`\\b${capability}:`), `Gateway must report ${capability} evidence`);
}
assert.match(gateway, /method,[\s\S]*tested_at:[\s\S]*adapter/, "Capability evidence must include method, time, and adapter");
assert.match(domain, /channelCapabilities: channel\.capabilities/, "Per-channel evidence must be persisted");
assert.match(domain, /capability_evidence: values\.channelCapabilities/, "Dashboard capabilities must carry evidence");

for (const guard of ["observer_safe_action_consent", "verifiedEvidence", "awaiting_confirmation", "expires_at", "confirmation: z.literal(true)"]) {
  assert.ok(actionRoute.includes(guard), `Action API is missing guard: ${guard}`);
}
assert.match(actionRoute, /method === "not_tested"/, "Untested capabilities must fail closed");
assert.match(migration, /confirmed_by is not null and confirmed_at is not null/, "Database must require a recorded confirmation before delivery");
assert.match(migration, /capability_evidence ->> 'supported' = 'true'/, "Database must reject actions without supported evidence");
assert.match(gatewayActionRoute, /verifyGatewayDeviceAccessToken/, "Gateway polling must require enrolled device authentication");
assert.match(gatewayActionRoute, /action_status: "delivered"/, "Gateway claims must be single-delivery state transitions");
assert.match(gateway, /adapter_executor_not_installed/, "Unknown physical adapters must fail closed");
assert.match(gateway, /discoverPrivateNvrCapabilities/, "Private recorder controls must be discovered through a read-only adapter");
assert.doesNotMatch(privateNvrCapabilities, /\/Set\b|\/Control\b/, "Capability discovery must not contain physical mutation endpoints");
assert.match(controls, /window\.confirm/, "Dashboard controls must require immediate confirmation");
assert.match(conversation, /suggested_camera_action/, "Observer conversation must expose only a gated action offer");
assert.doesNotMatch(controls, /capabilities\.ptz === true/, "A bare capability boolean must not enable a physical control");
assert.match(persistentGateway, /EVENT_COOLDOWN_MS/, "Local object events must have a cooldown");
assert.match(persistentGateway, /submitEventEvidence/, "Local detections must create event-only evidence");
assert.match(persistentGateway, /identity_recognition_used: false/, "Object events must not claim biometric identity");
assert.match(eventMediaRoute, /verifyGatewayDeviceAccessToken/, "Event media must support enrolled Keychain-only Gateway identity");
assert.match(eventMediaRoute, /retentionHoursForSite/, "Event media must preserve the bounded retention policy");

console.log("Camera capability evidence and action-approval checks passed.");
