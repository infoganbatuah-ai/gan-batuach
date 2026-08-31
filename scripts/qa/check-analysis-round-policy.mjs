import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { cameraReportsLocalEventInsights } from "../../lib/domain/digital-observer/edge-ai-policy.ts";
import { issueGatewayDeviceAccessToken, verifyGatewayDeviceAccessToken } from "../../lib/domain/gateway-device-enrollment.ts";

function load(path, modules, extra = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, Request, Response, Buffer, ...extra, require: name => { assert.ok(name in modules, name); return modules[name]; } });
  return exports;
}
const { observerAnalysisRoundPolicy } = load("lib/domain/digital-observer/analysis-round-policy.ts", { "./edge-ai-policy": { cameraReportsLocalEventInsights } });
const now = Date.now(), siteId = randomUUID(), sourceId = randomUUID(), gatewayId = "synthetic-gateway", deviceId = randomUUID();
const site = { id: siteId, active: true, monitoring_enabled: true, metadata: { observer_monitoring_consent: true } };
const schedule = { observer_site_id: siteId, schedule_mode: "event_only", status: "draft" };
const source = { id: sourceId, observer_site_id: siteId, status: "connected", health_status: "healthy", metadata: {
  gateway_id: gatewayId, private_endpoint: "SYNTHETIC_PRIVATE_VALUE",
  edge_policy: { monitoring_consent_verified: true, object_detection_enabled: true },
  edge_capability_contract: {
    version: 1, issued_at: new Date(now - 1000).toISOString(), gateway: { connected: true },
    runtime: { available: true }, hardware: { acceleration_available: true }, capability_test: { passed: true },
    models: { loaded: true, approved_inventory: [{ capability: "object_detection", loaded: true, self_test_passed: true }] },
    capabilities: { object_detection: true }
  }
} };
const policy = (s = site, c = source, scheduleRow = schedule) => observerAnalysisRoundPolicy(s, scheduleRow, [c], gatewayId, [sourceId], "request", now);
assert.equal(policy().sourceIds[0], sourceId);
assert.equal(policy().expiresAt, now + 60000);
assert.equal(policy().physical_actions_allowed, false);
assert.equal(policy().biometric_matching_allowed, false);
assert.equal(JSON.stringify(policy()).includes("SYNTHETIC_PRIVATE_VALUE"), false);
for (const s of [null, { ...site, active: false }, { ...site, monitoring_enabled: false }, { ...site, metadata: {} },
  { ...site, vision_privacy_mode: "skeleton_only" }, { ...site, business_handles_children: true }]) assert.equal(policy(s).sourceIds.length, 0);
for (const s of [null, { ...schedule, observer_site_id: "other" }, { ...schedule, status: "paused" }, { ...schedule, status: undefined },
  ...["custom_schedule", "night_only", "business_hours"].map(schedule_mode => ({ ...schedule, schedule_mode }))]) assert.equal(policy(site, source, s).sourceIds.length, 0);
for (const c of [
  { ...source, observer_site_id: "other" }, { ...source, status: "offline" },
  { ...source, metadata: { ...source.metadata, gateway_id: "other" } },
  ...[new Date(now + 1).toISOString(), new Date(now - 1200001).toISOString(), "invalid"].map(issued_at => ({ ...source, metadata: { ...source.metadata, edge_capability_contract: { ...source.metadata.edge_capability_contract, issued_at } } })),
  { ...source, metadata: { ...source.metadata, edge_capability_contract: { ...source.metadata.edge_capability_contract, runtime: { available: false } } } },
  { ...source, metadata: { ...source.metadata, edge_capability_contract: { ...source.metadata.edge_capability_contract, hardware: { acceleration_available: false } } } },
  { ...source, metadata: { ...source.metadata, edge_capability_contract: { ...source.metadata.edge_capability_contract, models: { loaded: true, approved_inventory: [{ capability: "object_detection", loaded: true, self_test_passed: false }] } } } },
  { ...source, metadata: { ...source.metadata, edge_capability_contract: { ...source.metadata.edge_capability_contract, models: { loaded: false } } } }
]) assert.equal(policy(site, c).sourceIds.length, 0);

const secret = randomBytes(32).toString("hex");
const token = issueGatewayDeviceAccessToken({ device_id: deviceId, gateway_id: gatewayId, observer_site_id: siteId }, secret);
let revoked = false, consent = true, auditFailed = false, completionFailed = false, queryFailed = false, policyQueryFailed = false, duplicate = false, writes = [], reads = [], metricsCalls = 0;
const db = { from(table) {
  const q = { table, filters: [], write: null, action: null }; reads.push(q);
  const result = () => {
    if (q.write) return { data: { id: randomUUID() }, error: auditFailed || (completionFailed && q.action === "update") ? { code: "synthetic_failure" } : duplicate && q.action === "insert" ? { code: "23505" } : null };
    if (table === "video_gateway_device_enrollments") return { data: revoked ? null : { id: deviceId }, error: null };
    if (table === "provider_webhook_events") return { data: null, error: queryFailed ? { code: "synthetic_failure" } : null };
    if (table === "observer_sites") return { data: { ...site, monitoring_enabled: consent }, error: policyQueryFailed ? { code: "synthetic_failure" } : null };
    if (table === "observer_monitoring_schedules") return { data: schedule, error: null };
    if (table === "digital_observer_camera_sources") return { data: [source], error: null };
    throw new Error("Unexpected table");
  };
  const chain = {
    select: () => chain, eq: (key, value) => { q.filters.push([key, value]); return chain; },
    in: (key, value) => { q.filters.push([key, value]); return chain; },
    insert: value => { q.write = value; q.action = "insert"; writes.push(q); return chain; },
    update: value => { q.write = value; q.action = "update"; writes.push(q); return chain; },
    maybeSingle: async () => result(), single: async () => result(), then: done => Promise.resolve(result()).then(done)
  }; return chain;
} };
const route = load("app/api/video-gateway/cloud-learning/route.ts", {
  zod: { z }, "node:crypto": { createHmac, timingSafeEqual },
  "@/lib/api": { ok: (data, status = 200) => Response.json({ data }, { status }), fail: (error, status) => Response.json({ error }, { status }), handleRouteError: () => Response.json({ error: "invalid" }, { status: 400 }) },
  "@/lib/supabase/admin": { createAdminClient: () => db },
  "@/lib/domain/gateway-device-enrollment": { verifyGatewayDeviceAccessToken },
  "@/lib/domain/digital-observer/analysis-round-policy": { observerAnalysisRoundPolicy },
  "@/lib/domain/digital-observer/home-learning-sampler": { recordHomeActivityMetrics: async (_db, metricSite, _samples, metricGateway) => {
    assert.equal(metricSite, siteId); assert.equal(metricGateway, gatewayId); metricsCalls++; return { sampled: 1 };
  } }
}, { process: { env: { VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET: secret } } });
async function ask(patch = {}, headers = {}) {
  writes = []; reads = [];
  const body = { operation: "authorize_round", gateway_id: gatewayId, observer_site_id: siteId,
    sample_id: randomUUID(), sampled_at: new Date().toISOString(), local_processing: true, no_raw_video_returned: true, source_ids: [sourceId], ...patch };
  const response = await route.POST(new Request("https://synthetic.invalid/learning", { method: "POST", headers: {
    "x-video-gateway-id": gatewayId, "x-video-gateway-timestamp": new Date().toISOString(),
    "x-video-gateway-nonce": randomUUID(), "x-video-gateway-device-token": token, ...headers
  }, body: JSON.stringify(body) }));
  return { status: response.status, ...(await response.json()) };
}
let result = await ask();
assert.equal(result.status, 200); assert.equal(result.data.policy.sourceIds[0], sourceId);
assert.equal(metricsCalls, 0, "Authorization cannot analyze, learn or change consent");
assert.ok(writes.every(q => q.table === "provider_webhook_events"));
assert.ok(reads.filter(q => ["observer_sites", "observer_monitoring_schedules", "digital_observer_camera_sources"].includes(q.table))
  .every(q => q.filters.some(([key, value]) => ["id", "observer_site_id"].includes(key) && value === siteId)));
assert.equal(writes.at(-1).write.metadata.authorized_source_count, 1);
assert.equal(JSON.stringify(writes).includes("SYNTHETIC_PRIVATE_VALUE"), false);
consent = false; result = await ask(); assert.equal(result.data.policy.consentVerified, false); consent = true;
revoked = true; assert.equal((await ask()).status, 401); assert.equal(writes.length, 0); revoked = false;
assert.equal((await ask({ observer_site_id: randomUUID() })).status, 403); assert.equal(writes.length, 0);
assert.equal((await ask({}, { "x-video-gateway-device-token": "invalid" })).status, 401); assert.equal(writes.length, 0);
assert.equal((await ask({ password: "synthetic" })).status, 400);
assert.equal((await ask({ source_ids: [sourceId, sourceId] })).status, 400);
assert.equal((await ask({}, { "content-length": "999999" })).status, 413);
assert.equal((await ask({ extra: "x".repeat(66000) })).status, 413);
assert.equal((await ask({}, { "x-video-gateway-timestamp": new Date(Date.now() - 360000).toISOString() })).status, 401);
assert.equal((await ask({}, { "x-video-gateway-nonce": "x".repeat(129) })).status, 401);
auditFailed = true; assert.equal((await ask()).status, 503); auditFailed = false;
completionFailed = true; assert.equal((await ask()).status, 503); completionFailed = false;
policyQueryFailed = true; assert.equal((await ask()).status, 503); policyQueryFailed = false;
queryFailed = true; assert.equal((await ask()).status, 503); queryFailed = false;
duplicate = true; assert.equal((await ask()).status, 409); duplicate = false;
result = await ask({ operation: undefined, source_ids: undefined, samples: [{ stream_id: "synthetic-stream", motion_score: 0.1, luminance_score: 0.2, sampled_at: new Date().toISOString(), sample_frames: 2 }] });
assert.equal(result.status, 201); assert.equal(metricsCalls, 1, "Legacy metrics envelope remains compatible");
console.log("PASS: fresh site/source policy, device/site isolation, revocation/replay/audit failure, no private metadata and legacy metric compatibility (synthetic only)");
