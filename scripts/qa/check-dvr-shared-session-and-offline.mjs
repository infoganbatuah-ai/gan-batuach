import { readFileSync } from "node:fs";

const gateway = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
const mapping = readFileSync(new URL("../../lib/domain/video-gateway.ts", import.meta.url), "utf8");
const liveStatus = readFileSync(new URL("../../lib/domain/digital-observer/camera-live-status.ts", import.meta.url), "utf8");
const player = readFileSync(new URL("../../components/digital-observer/observer-live-player.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../supabase/migrations/20260827000400_remove_digital_observer_demo_bundle.sql", import.meta.url), "utf8");
const edgePolicy = readFileSync(new URL("../../lib/domain/digital-observer/edge-ai-policy.ts", import.meta.url), "utf8");
const cameraRoute = readFileSync(new URL("../../app/api/digital-observer/cameras/route.ts", import.meta.url), "utf8");
const cameraControls = readFileSync(new URL("../../components/digital-observer/observer-camera-controls.tsx", import.meta.url), "utf8");
const cameraPresence = readFileSync(new URL("../../components/digital-observer/observer-camera-presence.tsx", import.meta.url), "utf8");
const edgeReadiness = readFileSync(new URL("../../services/video-gateway/edge-readiness.mjs", import.meta.url), "utf8");

for (const required of [
  "const privateNvrSessions = new Map()",
  "rememberPrivateNvrSession",
  "refreshPrivateNvrSession",
  "failedToken && current.token !== failedToken",
  "if (session.refreshPromise) session = await session.refreshPromise",
  "relay.sessionToken",
  "requestMetrics",
  "await waitForFile(relay.playlist, 8000)",
  '["-c:v", "copy"]'
]) {
  if (!gateway.includes(required)) throw new Error(`Missing shared DVR session safeguard: ${required}`);
}
if (gateway.includes("refreshPrivateNvrSource")) throw new Error("Each relay must not create a new DVR login");
for (const required of ['status: connected ? "connected" : "offline"', 'health_status: connected ? "healthy" : "offline"', "monitoringConsentVerified", "localEventInsightsEnabled", "biometric_recognition_enabled: false", "edge_capability_contract", "raw_frames_uploaded: false"]) {
  if (!mapping.includes(required)) throw new Error(`Missing cloud offline/edge mapping: ${required}`);
}
for (const required of ["unavailableStatuses", "digitalObserverCameraIsConnected", "digitalObserverCameraHasLiveGateway"]) {
  if (!liveStatus.includes(required)) throw new Error(`Missing truthful live status guard: ${required}`);
}
for (const required of ["response.status !== 503", "attempt < 3", "1200 * (attempt + 1)"]) {
  if (!player.includes(required)) throw new Error(`Missing playback recovery: ${required}`);
}
for (const required of ["ONLY_SYNTHETIC_DEMO_CAMERA_CAN_BE_REMOVED", "source_row.camera_stream_id is not null", "source_row.secret_reference is not null", "capabilities @> '{\"live_view\":true}'", "DEMO_CAMERA_HAS_STORED_MEDIA", "can_manage_observer_site"]) {
  if (!migration.includes(required)) throw new Error(`Missing demo deletion boundary: ${required}`);
}
for (const required of ["structured_insights_only", "פריימים לדגימה", "Push חיצוני טרם הוגדר", "זיהוי ביומטרי כבוי"]) {
  if (!edgePolicy.includes(required)) throw new Error(`Missing truthful local AI policy: ${required}`);
}
for (const required of ["אירועים בלבד", "PTZ", "תאורה", "סירנה", "חסום במדיניות"]) {
  if (!cameraControls.includes(required)) throw new Error(`Missing event-only or read-only camera control status: ${required}`);
}
if (!cameraPresence.includes("תצפיתן כבוי")) throw new Error("Inactive cameras must show that the Digital Observer is off");
for (const required of ["apple_vision_runtime_available", "approved_edge_model_not_installed", "model_present_but_runtime_load_and_capability_test_required", "self_test_passed: false", "face_recognition: false", "raw_frames_retained: false"]) {
  if (!edgeReadiness.includes(required)) throw new Error(`Missing truthful Edge readiness guard: ${required}`);
}
for (const required of ["removeSyntheticDemoBundleFallback", "hasGatewayBinding", "secret_reference", "capabilities?.live_view", "DEMO_CAMERA_HAS_STORED_MEDIA", 'eq("source_mode", "demo")']) {
  if (!cameraRoute.includes(required)) throw new Error(`Missing production demo cleanup boundary: ${required}`);
}

console.log("DVR shared session, offline status and local AI policy PASS");
