import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  MANAGEMENT_LIVE_PRODUCTION_VERIFIED,
  cameraTruthState,
  safetySummary,
  toSafetyCamera
} from "../../lib/management/safety-cameras.ts";

const read = (path) => readFile(path, "utf8");
const [platform, css, garden, parent, staff, inspector, admin, playback, layout] = await Promise.all([
  read("components/safety-cameras-platform.tsx"),
  read("app/styles/ux-implement-16.css"),
  read("app/dashboard/garden/cameras/page.tsx"),
  read("app/dashboard/parent/cameras/page.tsx"),
  read("app/dashboard/staff/cameras/page.tsx"),
  read("app/dashboard/inspector/cameras/page.tsx"),
  read("app/dashboard/admin/cameras/page.tsx"),
  read("app/api/camera-streams/[id]/playback-token/route.ts"),
  read("app/layout.tsx")
]);

test("camera source state is truthful and distinct from Live capability", () => {
  assert.equal(cameraTruthState({ active: true, status: "online" }), "online");
  assert.equal(cameraTruthState({ active: true, health_status: "degraded" }), "degraded");
  assert.equal(cameraTruthState({ active: true, status: "offline" }), "offline");
  assert.equal(cameraTruthState({ active: true, status: "pending_gateway" }), "setup_required");
  assert.equal(cameraTruthState({ active: false, status: "online" }), "unavailable");
  assert.equal(MANAGEMENT_LIVE_PRODUCTION_VERIFIED, false);
  const camera = toSafetyCamera({ id: "c1", active: true, status: "online", playback_hls_ready: true, gateway_stream_id: "present", parent_view_allowed: true }, "parent");
  assert.equal(camera.truthState, "online");
  assert.equal(camera.liveState, "production_verification_required");
  assert.equal(camera.liveLabel, "Live דורש אימות Production");
});

test("role camera policies remain separate", () => {
  assert.equal(toSafetyCamera({ id: "c1", parent_view_allowed: false }, "parent").permission, "denied");
  assert.equal(toSafetyCamera({ id: "c1", parent_view_allowed: true }, "parent").permission, "permitted_context");
  assert.equal(toSafetyCamera({ id: "c1", staff_view_allowed: false }, "staff").permission, "denied");
  assert.equal(toSafetyCamera({ id: "c1", staff_view_allowed: true }, "staff").permission, "permitted_context");
  assert.equal(toSafetyCamera({ id: "c1", inspector_view_allowed: true }, "inspector").permission, "evidence_only");
  assert.equal(toSafetyCamera({ id: "c1", inspector_view_allowed: false }, "inspector").permission, "denied");
});

test("summary keeps degraded, offline, setup and no-recording states distinct", () => {
  const rows = [
    toSafetyCamera({ id: "1", active: true, status: "online", recording_enabled: true }, "owner"),
    toSafetyCamera({ id: "2", active: true, health_status: "degraded" }, "owner"),
    toSafetyCamera({ id: "3", active: true, status: "offline" }, "owner"),
    toSafetyCamera({ id: "4", active: true, status: "pending_gateway" }, "owner")
  ];
  assert.deepEqual(safetySummary(rows), { total: 4, online: 1, degraded: 1, offline: 1, setupRequired: 1, unavailable: 0, actionRequired: 3, recordingDisabled: 3 });
});

test("every role uses the shared canonical Safety and Cameras platform", () => {
  for (const source of [garden, parent, staff, inspector, admin]) assert.match(source, /<SafetyCamerasPlatform/);
  assert.match(garden, /resolveManagementGardenContext/);
  assert.match(parent, /getParentCameraListForProfile/);
  assert.match(staff, /requireOperationalRole/);
  assert.match(staff, /\.eq\("staff_view_allowed", true\)/);
  assert.match(inspector, /\.eq\("inspector_id", profile\.id\)/);
  assert.match(admin, /requireRole\(\["admin"\]\)/);
  for (const source of [garden, parent, staff, inspector, admin]) assert.doesNotMatch(source, /CameraPlaybackCard/);
});

test("Live token issuance fails closed until explicit Production verification exists", () => {
  assert.match(playback, /MANAGEMENT_LIVE_PRODUCTION_VERIFIED/);
  assert.match(playback, /צפייה חיה אינה מאומתת כרגע ל־Production/);
  assert.match(playback, /requirePermission\("video:stream"\)/);
  assert.match(playback, /assertRateLimit/);
});

test("events, incidents, evidence and identity remain distinct", () => {
  assert.match(platform, /אירועי מצלמה מאומתים/);
  assert.match(platform, /דיווחי בטיחות קנוניים/);
  assert.match(platform, /גישה חתומה ומוגבלת/);
  assert.match(platform, /Track ID אינו זהות ילד/);
  assert.match(platform, /mock, shadow, sandbox או local/);
  assert.doesNotMatch(garden + parent + staff + inspector, /ai_camera_events|observer_incidents|digital_observer_incidents/);
});

test("search, truth filters and canonical continuation routes remain functional", () => {
  assert.match(platform, /method="get" role="search"/);
  assert.match(platform, /name="q"/);
  assert.match(platform, /normalizedSearch/);
  assert.match(platform, /safety-filter-chips/);
  assert.match(platform, /\/dashboard\/garden\/camera-health/);
  assert.match(platform, /\/dashboard\/admin\/video-gateway/);
  for (const source of [garden, parent, staff, inspector, admin]) assert.match(source, /searchQuery=\{params\.q \?\? ""\}/);
});

test("private camera details and public media URLs are absent from role surfaces", () => {
  for (const source of [garden, parent, staff, inspector, admin, platform]) {
    assert.doesNotMatch(source, /rtsp_url|connection_password|source_url|publicUrl|getPublicUrl|service_role/i);
  }
  assert.match(platform, /כתובת קצרה וחתומה/);
  assert.match(platform, /אין כתובות ציבוריות או נתיבי אחסון/);
});

test("Desktop and Mobile are purpose-built, RTL and accessible", () => {
  for (const selector of ["safety-platform", "safety-hero", "safety-metrics", "safety-camera-grid", "safety-camera-detail", "safety-events-layout", "safety-setup", "safety-policy", "safety-readiness-layout"]) assert.match(css, new RegExp(`\\.${selector}`));
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
  assert.match(platform, /aria-label/);
  assert.match(platform, /aria-disabled="true"/);
  assert.match(layout, /dir="rtl"/);
  assert.match(layout, /ux-implement-16\.css/);
});

test("Digital Observer core remains untouched by UX-16", () => {
  const base = process.env.GB_UX16_BASE_REF ?? "5d09f80324240b41b44ad52b7912d07fd0c0f653";
  const changed = execFileSync("git", ["diff", "--name-only", base, "--"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  const forbidden = changed.filter((path) => path.startsWith("lib/domain/digital-observer/") || path.startsWith("app/digital-observer/") || path.startsWith("components/digital-observer/") || path.startsWith("app/api/digital-observer/"));
  assert.deepEqual(forbidden, []);
});
