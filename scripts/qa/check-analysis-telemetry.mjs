import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createAnalysisRoundReport } from "../../services/video-gateway/analysis-round-report.mjs";
import { createPersistentLearningCycle } from "../../services/video-gateway/persistent-learning-cycle.mjs";
import { validatedAnalysisTelemetry, recordAnalysisTelemetry } from "../../lib/domain/digital-observer/analysis-telemetry.ts";
import { observerSourceCoverage } from "../../lib/domain/digital-observer/source-coverage.ts";

const now = Date.now(), sourceId = randomUUID(), otherSourceId = randomUUID(), authorizationId = randomUUID();
const siteId = randomUUID(), gatewayId = "synthetic-gateway", receiptId = randomUUID();
const iso = delta => new Date(now + delta).toISOString();
const success = { source_id: sourceId, state: "no_event", last_attempt_at: iso(-1000), last_analyzed_at: iso(-500), event_count: 0 };
const offline = { source_id: otherSourceId, state: "offline", last_attempt_at: null, last_analyzed_at: null, event_count: null };
const policy = { authorization_id: authorizationId, consentVerified: true, sourceIds: [sourceId, otherSourceId], expiresAt: now + 60000,
  physical_actions_allowed: false, biometric_matching_allowed: false };
const report = createAnalysisRoundReport({ ...policy, credential: "SYNTHETIC_SECRET" }, {
  reports: [{ ...success, private_endpoint: "SYNTHETIC_SECRET", frames: "SYNTHETIC_SECRET" }, offline], private_data: "SYNTHETIC_SECRET"
}, now);
assert.ok(report);
assert.equal(JSON.stringify(report).includes("SYNTHETIC_SECRET"), false);
assert.deepEqual(Object.keys(report).sort(), ["authorization_id", "completed_at", "reports"]);
assert.equal(report.reports[0].detection_count, 0);
assert.equal(report.reports[1].detection_count, null);
assert.deepEqual(validatedAnalysisTelemetry(report, now), report);
assert.equal(createAnalysisRoundReport({}, { reports: [success] }, now), null, "Older server without receipt is not telemetry-ready");
for (const reports of [[success, success], [{ ...success, source_id: "bad" }], [{ ...success, state: "unknown" }],
  [{ ...success, event_count: 1 }], [{ ...success, state: "event_detected", event_count: 0 }],
  [{ ...success, last_analyzed_at: null }], [{ ...success, last_analyzed_at: iso(-2000) }],
  [{ ...success, last_attempt_at: iso(1) }], [{ ...offline, last_attempt_at: iso(-1000) }],
  [{ ...offline, state: "processing_failed" }], Array.from({ length: 129 }, () => ({ ...offline, source_id: randomUUID() }))]) {
  assert.equal(createAnalysisRoundReport(policy, { reports }, now), null);
}
for (const invalid of [
  { ...report, password: "SYNTHETIC_SECRET" }, { ...report, authorization_id: "invalid" },
  { ...report, completed_at: iso(1) }, { ...report, completed_at: iso(-300001) },
  { ...report, reports: [report.reports[0], report.reports[0]] },
  { ...report, reports: [{ ...report.reports[0], secret: "SYNTHETIC_SECRET" }] },
  { ...report, reports: [{ ...report.reports[0], detection_count: null }] },
  { ...report, reports: [{ ...report.reports[0], state: "processing_failed" }] },
  { ...report, reports: [{ ...report.reports[0], last_analyzed_at: iso(1) }] },
  { ...report, reports: [{ ...report.reports[0], last_attempt_at: iso(-400000) }] }
]) assert.throws(() => validatedAnalysisTelemetry(invalid, now));

let calls = [];
const db = { rpc: async (name, args) => { calls.push({ name, args }); return { data: { stored: 2, reported_at: report.completed_at }, error: null }; } };
assert.equal((await recordAnalysisTelemetry(db, siteId, gatewayId, receiptId, report, now)).stored, 2);
assert.equal(calls[0].name, "record_observer_analysis_telemetry");
assert.equal(calls[0].args.p_observer_site_id, siteId);
assert.equal(calls[0].args.p_gateway_id, gatewayId);
assert.equal(calls[0].args.p_receipt_id, receiptId);
assert.equal(calls[0].args.p_authorization_id, authorizationId);
calls = [];
await assert.rejects(recordAnalysisTelemetry(db, siteId, gatewayId, receiptId, { ...report, password: "bad" }, now));
assert.equal(calls.length, 0, "Reject malformed reports before RPC");
await assert.rejects(recordAnalysisTelemetry({ rpc: async () => ({ error: { message: "SYNTHETIC_SECRET" } }) }, siteId, gatewayId, receiptId, report, now),
  error => !error.message.includes("SECRET"));

const source = { id: sourceId, observer_site_id: siteId, status: "connected", metadata: { gateway_id: gatewayId } };
const saved = { camera_source_id: sourceId, observer_site_id: siteId, gateway_id: gatewayId, ...report.reports[0], reported_at: iso(0) };
const coverage = reports => observerSourceCoverage(siteId, [source], [], now, reports)[0];
assert.equal(coverage([saved]).analysisState, "no_event");
assert.equal(coverage([saved]).lastAnalyzedAt, iso(-500));
assert.equal(coverage([]).analysisState, "not_reported");
assert.equal(coverage([{ ...saved, reported_at: iso(-600001), last_attempt_at: iso(-601000), last_analyzed_at: iso(-600500) }]).analysisState, "stale");
for (const patch of [{ observer_site_id: randomUUID() }, { gateway_id: "another" }, { reported_at: iso(1) },
  { last_analyzed_at: iso(1) }, { state: "made_up" }, { detection_count: 1 }, { last_attempt_at: null }]) {
  assert.equal(coverage([{ ...saved, ...patch }]).analysisState, "not_reported");
}
assert.equal(coverage([{ ...saved, state: "processing_failed", detection_count: null, last_analyzed_at: null }]).lastAnalyzedAt, null);

// Reporting is independent of event/metric delivery and remains part of single-flight work.
let reportCalls = [], eventCalls = 0;
const channel = { camera_source_id: sourceId, gateway_stream_id: "synthetic-stream", status: "connected" };
const cycle = options => createPersistentLearningCycle({
  authorize: async () => ({ ...policy, expiresAt: Date.now() + 60000 }),
  analyze: async () => ({ stream_id: channel.gateway_stream_id, local_processing: true, no_raw_video_returned: true,
    insight: { sampled_at: new Date().toISOString(), motion_score: 0.1, luminance_score: 0.2, sample_frames: 2,
      object_detection: { status: "sampled", detections: [{ label: "person", confidence: 0.9 }] } } }),
  publishSamples: async () => { throw new Error("metric outage"); },
  publishEvent: async () => { eventCalls++; return { submitted: true }; },
  publishReport: async value => { reportCalls.push(value); return { submitted: true }; },
  ...options
});
const oneSourcePolicy = { ...policy, sourceIds: [sourceId], expiresAt: Date.now() + 60000 };
let result = await cycle({ authorize: async () => oneSourcePolicy }).run([channel]);
assert.equal(result.report_submitted, true); assert.equal(eventCalls, 1);
assert.equal(reportCalls[0].reports[0].detection_count, 1);
result = await cycle({ authorize: async () => oneSourcePolicy, publishReport: async () => { throw new Error("report outage"); } }).run([channel]);
assert.equal(result.report_submitted, false); assert.equal(result.events_submitted, 1);
reportCalls = [];
result = await cycle({ authorize: async () => ({ ...oneSourcePolicy, consentVerified: false, sourceIds: [], expiresAt: Date.now() }),
  analyze: async () => assert.fail("No analysis without consent") }).run([channel]);
assert.equal(result.attempted, 0); assert.equal(result.report_submitted, true);
assert.equal(reportCalls[0].reports[0].state, "consent_unavailable");
assert.equal(reportCalls[0].reports[0].last_analyzed_at, null);

const migration = readFileSync("supabase/migrations/20260831020000_observer_source_analysis_telemetry.sql", "utf8");
for (const required of ["enable row level security", "can_access_observer_site(observer_site_id)", "for update", "for share",
  "telemetry_received_at", "requested_source_ids", "authorized_source_ids", "current_status.reported_at < excluded.reported_at",
  "related_entity_id = p_observer_site_id", "from public, anon, authenticated", "to service_role", "on delete cascade"]) assert.ok(migration.includes(required), required);
console.log("PASS: sanitized round reports, stale/duplicate/tenant rejection, honest coverage, failure isolation and migration guard review (synthetic; SQL not executed)");
