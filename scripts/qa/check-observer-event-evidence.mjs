import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { observerEventMediaDeadline, observerEventMediaState, observerEventMediaReason } from "../../lib/domain/digital-observer/event-evidence.ts";
import { observerEventNarrative, observerEventNarrativeSchema } from "../../lib/domain/digital-observer/event-narrative.ts";
import { cameraReportsLocalEventInsights } from "../../lib/domain/digital-observer/edge-ai-policy.ts";
import { issueGatewayDeviceAccessToken, verifyGatewayDeviceAccessToken } from "../../lib/domain/gateway-device-enrollment.ts";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";
import * as icons from "lucide-react";

const now = Date.now();
const siteId = randomUUID(), sourceId = randomUUID(), signalId = randomUUID(), clipId = randomUUID();
const clip = { id: clipId, observer_site_id: siteId, signal_id: signalId, camera_source_id: sourceId,
  clip_status: "available", captured_at: new Date(now - 1000).toISOString(), delete_after: new Date(now + 86_400_000).toISOString(),
  retention_hours: 24, downloadable: true, storage_bucket: "digital-observer-event-media", storage_path: `${siteId}/event/clip.mp4`, snapshot_storage_path: `${siteId}/event/thumbnail.jpg`,
  metadata: { clip_available: true, thumbnail_available: true } };
assert.equal(observerEventMediaState(clip, now), "available");
assert.equal(observerEventMediaState({ ...clip, delete_after: new Date(now).toISOString() }, now), "expired");
assert.equal(observerEventMediaState({ ...clip, delete_after: null }, now), "invalid_retention");
assert.equal(observerEventMediaState({ ...clip, captured_at: new Date(now + 120000).toISOString() }, now), "invalid_retention");
assert.equal(observerEventMediaState({ ...clip, camera_source_id: null }, now), "missing_source");
assert.equal(observerEventMediaState({ ...clip, snapshot_storage_path: null, metadata: { clip_available: true } }, now), "missing_thumbnail");
assert.equal(observerEventMediaDeadline({ ...clip, retention_hours: 365 * 24, delete_after: new Date(now + 365 * 86_400_000).toISOString() }), now - 1000 + 48 * 3600000);
for (const type of ["known_person_detected", "unknown_person_detected", "authorized_entry", "unauthorized_entry", "unknown_person_near_vehicle"]) {
  const result = observerEventNarrative({ signal_type: type, metadata: { event_summary: "SYNTHETIC_PERSON is authorized", known_person_id: "untrusted", identity_verified: true }, recommended_action: "Allow entry", confidence: 5 });
  assert.equal(result.identityStatus, "not_verified");
  assert.equal(result.confidence, null);
  assert.equal(JSON.stringify(result).includes("SYNTHETIC_PERSON"), false);
  assert.equal(result.action.includes("Allow entry"), false);
}
assert.match(observerEventNarrative({ signal_type: "person_detected", confidence: 0.8 }).conclusion, /נוכחות בלבד/);
assert.match(observerEventNarrative({ signal_type: "person_detected" }).anomalyAssessment, /נוכחות בלבד אינה מעידה על חריגה/);
assert.match(observerEventNarrative({ signal_type: "camera_media_readiness" }).anomalyAssessment, /בדיקת מדיה טכנית/);
assert.match(observerEventNarrative({ signal_type: "unverified_event" }).anomalyAssessment, /אין די מידע מאומת/);
const report = observerEventNarrative({ signal_type: "person_detected", severity: "high", review_status: "confirmed", metadata: { baseline_verified: true, known_person_id: "untrusted" } });
assert.equal(report.baselineStatus, "not_verified");
assert.equal(report.followUpStatus, "confirmed");
assert.equal(report.physicalActionExecuted, false);
assert.equal(observerEventNarrativeSchema.safeParse({ ...report, confidence: 2 }).success, false);
assert.equal(observerEventNarrativeSchema.safeParse({ ...report, identityStatus: "authorized" }).success, false);
assert.equal(observerEventNarrativeSchema.safeParse({ ...report, physicalActionExecuted: true }).success, false);
assert.equal(observerEventNarrative({ signal_type: "person_detected", metadata: { event_summary: "x".repeat(800) } }).summary.length, 500);

const secret = randomBytes(32).toString("hex");
const claims = { device_id: randomUUID(), gateway_id: "synthetic-gateway", observer_site_id: siteId };
let consent = true, access = true, identityEvent = false;
let reviewReadFailed = false;
const reviewRows = [];
let privateClip = { ...clip }, sourceGateway = claims.gateway_id, objectReady = true;
const queries = [], writes = [], uploads = [], signedTtls = [];
const site = () => ({ id: siteId, monitoring_enabled: consent, metadata: { observer_monitoring_consent: consent }, event_retention_days: 2 });
const camera = () => ({ id: sourceId, observer_site_id: siteId, status: "connected", metadata: {
  gateway_id: sourceGateway, gateway_stream_id: "synthetic-stream", edge_policy: { monitoring_consent_verified: true, object_detection_enabled: true },
  edge_capability_contract: { version: 1, gateway: { connected: true }, runtime: { available: objectReady }, models: { loaded: true }, hardware: { acceleration_available: true }, capability_test: { passed: true }, capabilities: { object_detection: true } }
} });
const db = {
  from(table) {
    const q = { table, filters: [], action: "select", value: null }; queries.push(q);
    const chain = {
      select: () => chain, order: () => chain, limit: () => chain, eq: (key, value) => { q.filters.push([key, value]); return chain; },
      insert: (value) => { q.action = "insert"; q.value = value; writes.push(q); return chain; },
      update: (value) => { q.action = "update"; q.value = value; writes.push(q); return chain; },
      maybeSingle: async () => ({ error: null, data: table === "observer_sites" ? site() : table === "digital_observer_camera_sources" ? camera()
        : table === "video_gateway_device_enrollments" ? { id: claims.device_id }
        : table === "digital_observer_event_clips" ? privateClip
        : table === "observer_intelligence_signals" ? { id: signalId, observer_site_id: siteId, metadata: { camera_source_id: sourceId } } : null }),
      single: async () => ({ error: null, data: { id: table === "observer_intelligence_signals" ? signalId : table === "digital_observer_event_clips" ? clipId : randomUUID() } }),
      then: (resolve) => Promise.resolve(table === "observer_signal_reviews" && q.action === "select"
        ? { error: reviewReadFailed ? { code: "synthetic_unavailable" } : null, data: reviewRows } : { error: null, data: null }).then(resolve)
    };
    return chain;
  },
  rpc: async () => ({ error: null }),
  storage: { from: (bucket) => ({
    upload: async (path) => { uploads.push({ bucket, path }); return { error: null }; },
    createSignedUrl: async (path, ttl) => { signedTtls.push(ttl); return { data: { signedUrl: "https://storage.example.invalid/synthetic-media" }, error: null }; }
  }) }
};
const api = { ok: (data, status = 200) => Response.json({ data }, { status }), fail: (error, status) => Response.json({ error }, { status }), handleRouteError: () => Response.json({ error: "request_failed" }, { status: 400 }) };
const modules = {
  zod: { z }, "@/lib/api": api,
  "@/lib/domain/digital-observer/event-evidence": { observerEventMediaDeadline, observerEventMediaReason, observerEventMediaState },
  "@/lib/domain/digital-observer/event-narrative": { observerEventNarrative },
  "@/lib/domain/digital-observer/edge-ai-policy": { cameraReportsLocalEventInsights },
  "@/lib/domain/gateway-device-enrollment": { verifyGatewayDeviceAccessToken },
  "@/lib/supabase/admin": { createAdminClient: () => db, isAdminClientConfigured: () => true },
  "@/lib/domain/digital-observer/access": { getDigitalObserverApiUser: async () => ({ profile: { id: randomUUID(), role: "observer_site_owner" }, supabase: db }), getObserverSiteAccess: async () => access ? site() : null },
  "@/lib/supabase/server": { createClient: async () => db },
  "next/server": { NextResponse: { redirect: (url, options) => new Response(null, { ...options, headers: { ...options.headers, location: url } }) } }
};
function load(path) {
  const exports = {};
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(compiled, { exports, Request, Response, File, FormData, URL, URLSearchParams, Buffer, process: { env: { VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET: secret } }, require: (name) => {
    if (name === "node:crypto") return { createHash: cryptoModule.createHash, createHmac: cryptoModule.createHmac, timingSafeEqual: cryptoModule.timingSafeEqual };
    if (!(name in modules)) throw new Error(`Unexpected module ${name}`);
    return modules[name];
  } });
  return exports;
}
const cryptoModule = await import("node:crypto");
const runtime = load("lib/domain/digital-observer/runtime.ts");
assert.equal(runtime.observerCameraForSignal({ observer_site_id: "other", metadata: { camera_source_id: sourceId } }, [camera()]), null);
assert.equal(runtime.observerSignalHasRequiredEvidence({ id: signalId, observer_site_id: siteId, metadata: { camera_source_id: sourceId } }, [camera()], [{ ...clip, camera_source_id: "other" }]), false);
await runtime.loadObserverEventReviews({ id: signalId, observer_site_id: siteId });
const reviewQuery = queries.at(-1);
assert.equal(reviewQuery.table, "observer_signal_reviews");
assert.ok(reviewQuery.filters.some(([key, value]) => key === "signal_id" && value === signalId));
assert.ok(reviewQuery.filters.some(([key, value]) => key === "observer_intelligence_signals.observer_site_id" && value === siteId));

const mediaRoute = load("app/api/digital-observer/event-clips/[id]/media/route.ts");
const media = (download = false) => mediaRoute.GET(new Request(`https://example.invalid/media?kind=clip${download ? "&download=1" : ""}`), { params: Promise.resolve({ id: clipId }) });
assert.equal((await media()).status, 307);
assert.equal(signedTtls.at(-1), 60);
privateClip = { ...clip, delete_after: new Date(Date.now() + 21000).toISOString() };
assert.equal((await media()).status, 307);
assert.ok(signedTtls.at(-1) <= 21);
privateClip = { ...clip, delete_after: new Date(now - 1).toISOString() };
const signedBefore = signedTtls.length;
assert.equal((await media()).status, 410);
assert.equal(signedTtls.length, signedBefore);
privateClip = { ...clip, downloadable: false };
assert.equal((await media(true)).status, 403);
privateClip = { ...clip, storage_path: "other-site/clip.mp4" };
assert.equal((await media()).status, 403);
privateClip = { ...clip }; access = false;
assert.equal((await media()).status, 403); access = true;

const reviewRoute = load("app/api/digital-observer/events/review/route.ts");
const review = (status) => reviewRoute.POST(new Request("https://example.invalid/review", { method: "POST", body: JSON.stringify({ signal_id: signalId, review_status: status }) }));
privateClip = { ...clip, delete_after: new Date(now - 1).toISOString() };
let before = writes.length;
assert.equal((await review("confirmed")).status, 422); assert.equal(writes.length, before);
assert.equal((await review("escalated")).status, 200);
privateClip = { ...clip };
assert.equal((await review("confirmed")).status, 200);

const cloudRoute = load("app/api/video-gateway/cloud-event-media/route.ts");
async function upload() {
  const metadata = { gateway_id: claims.gateway_id, observer_site_id: siteId, event_id: signalId, camera_source_id: sourceId, stream_id: "synthetic-stream",
    event_type: identityEvent ? "authorized_entry" : "person_detected", severity: "info", confidence: 0.8, captured_at: new Date().toISOString(), duration_seconds: 8,
    local_capture: true, read_only: true, controls_supported: false, no_dvr_credentials_returned: true, no_rtsp_returned: true,
    event_context: "entry", metadata: { known_person_id: "untrusted", biometric_matching_active: true, source: "synthetic_fixture" } };
  const form = new FormData(); form.set("metadata", JSON.stringify(metadata));
  form.set("clip", new File(["synthetic"], "clip.mp4", { type: "video/mp4" }));
  form.set("thumbnail", new File(["synthetic"], "thumbnail.jpg", { type: "image/jpeg" }));
  return cloudRoute.POST(new Request("https://example.invalid/upload", { method: "POST", headers: {
    "x-video-gateway-id": claims.gateway_id, "x-video-gateway-device-token": issueGatewayDeviceAccessToken(claims, secret),
    "x-video-gateway-timestamp": new Date().toISOString(), "x-video-gateway-nonce": randomUUID()
  }, body: form }));
}
before = uploads.length; consent = false;
assert.equal((await upload()).status, 403); assert.equal(uploads.length, before); consent = true;
sourceGateway = "other-gateway"; assert.equal((await upload()).status, 403); sourceGateway = claims.gateway_id;
objectReady = false; assert.equal((await upload()).status, 412); objectReady = true;
identityEvent = true; assert.equal((await upload()).status, 422); identityEvent = false;
const uploaded = await upload();
assert.equal(uploaded.status, 201);
const uploadResult = await uploaded.json();
assert.equal(uploadResult.data.narrative.narrativeBasis, "reported_evidence_only");
assert.equal(uploadResult.data.narrative.followUpStatus, "needs_review");
const stored = writes.findLast((q) => q.table === "observer_intelligence_signals" && q.value.metadata?.decision_policy_version);
assert.equal(stored.value.metadata.identity_recognition_used, false);
assert.equal(stored.value.metadata.known_person_id, undefined);
assert.equal(stored.value.metadata.biometric_matching_active, undefined);
assert.equal(stored.value.metadata.event_context, "presence", "Presence detection must not invent entry/exit");
assert.equal(stored.value.metadata.narrative_version, "evidence-narrative-v1");
assert.match(stored.value.metadata.event_anomaly_assessment, /אינה מעידה על חריגה/);
assert.equal(stored.value.metadata.suggested_human_action, observerEventNarrative({ signal_type: "person_detected" }).action);
assert.ok(stored.filters.some(([key, value]) => key === "observer_site_id" && value === siteId));
assert.ok(writes.filter((q) => q.table === "digital_observer_event_clips" && q.action === "update").every((q) => q.filters.some(([key, value]) => key === "observer_site_id" && value === siteId)));

// Render the real page with synthetic, tenant-scoped data. This checks UI
// behavior, not browser layout, real media playback or production deployment.
modules["react/jsx-runtime"] = jsxRuntime;
modules["lucide-react"] = icons;
modules["next/link"] = { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
modules["@/components/digital-observer/observer-app-shell"] = { ObserverAppShell: ({ children }) => React.createElement("main", null, children) };
modules["@/components/digital-observer/observer-action-forms"] = { ObserverQuickAction: ({ children }) => React.createElement("button", null, children) };
modules["@/components/digital-observer/observer-event-assessment"] = load("components/digital-observer/observer-event-assessment.tsx");
modules["@/lib/domain/digital-observer/dashboard-summary"] = { observerDashboardSignalMatchesCategory: () => true };
modules["@/lib/domain/digital-observer/access"].requireDigitalObserverUser = async () => ({ profile: { id: "synthetic-profile" } });
const uiSignals = Array.from({ length: 7 }, (_, index) => ({ id: `signal-${index}`, observer_site_id: siteId, signal_type: "ai_camera", severity: "info", confidence: 0.8, created_at: new Date(now).toISOString(), review_status: "needs_review", metadata: { event_type: "person_detected", event_summary: "נוכחות אדם ליד הכניסה", camera_source_id: sourceId } }));
const uiClips = uiSignals.map((signal, index) => ({ ...clip, id: `clip-${index}`, signal_id: signal.id }));
uiClips[1] = { ...uiClips[1], delete_after: new Date(now - 1).toISOString() };
uiClips[2] = { ...uiClips[2], snapshot_storage_path: null, metadata: { clip_available: true } };
modules["@/lib/domain/digital-observer/runtime"] = { ...runtime, loadObserverRuntime: async () => ({ sites: [{ ...site(), site_type: "home" }], cameras: [{ ...camera(), display_name: "מצלמת בדיקה" }], signals: uiSignals, clips: uiClips }) };
const page = load("app/digital-observer/alerts/page.tsx").default;
const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ site: siteId }) }));
assert.ok(html.includes("clip-0/media?kind=thumbnail"));
assert.ok(!html.includes("clip-1/media?kind=thumbnail"), "Expired media must not be fetched by the list");
assert.ok(html.includes("המדיה פגה; התיאור נשמר"));
assert.ok(html.includes("התמונה מתוך האירוע חסרה"));
assert.ok(html.includes("נוכחות אדם ליד הכניסה"));
assert.ok(html.includes(`site=${siteId}&amp;event=signal-0`), "Event navigation must retain the selected site");
const timelineHtml = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ site: siteId, view: "timeline" }) }));
assert.ok(timelineHtml.includes("event=signal-6"), "Timeline must not silently stop at five events");
const detailHtml = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ site: siteId, event: "signal-0" }) }));
assert.ok(detailHtml.includes("מסקנה לביקורת") && detailHtml.includes("זהות והרשאת כניסה לא אומתו"));
assert.ok(detailHtml.includes("האם נמצאה חריגה") && detailHtml.includes("פעולה מוצעת לבדיקה אנושית"));
assert.ok(detailHtml.includes("אישור אירוע"));
assert.ok(detailHtml.includes("טרם נשמרה ביקורת לאירוע זה."));
reviewRows.push({ id: "synthetic-review", review_status: "confirmed", review_note: "SYNTHETIC_REVIEW_NOTE", created_at: new Date(now).toISOString() });
const reviewedHtml = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ site: siteId, event: "signal-0" }) }));
assert.ok(reviewedHtml.includes("היסטוריית ביקורת") && reviewedHtml.includes("SYNTHETIC_REVIEW_NOTE"));
reviewReadFailed = true;
const failedHistoryHtml = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ site: siteId, event: "signal-0" }) }));
assert.ok(failedHistoryHtml.includes("לא ניתן לטעון את היסטוריית הביקורת כרגע."));
assert.ok(!failedHistoryHtml.includes("SYNTHETIC_REVIEW_NOTE"));
reviewReadFailed = false;
const expiredHtml = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ site: siteId, event: "signal-1" }) }));
assert.ok(!expiredHtml.includes("<video") && !expiredHtml.includes("אישור אירוע") && !expiredHtml.includes("download=1"));
uiClips[0].downloadable = false;
const viewOnlyHtml = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ site: siteId, event: "signal-0" }) }));
assert.ok(viewOnlyHtml.includes("<video") && !viewOnlyHtml.includes("download=1"), "Download must respect the clip policy even while viewing is allowed");
console.log("Observer event evidence QA PASS: expiry, tenant binding, consent, truthful identity, source capability and review gates; synthetic only");
