import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  }
});

const { evaluateIncidentVerification } = await import("../../lib/domain/digital-observer/incident-verification-engine.ts");
const migration = readFileSync(new URL("../../supabase/migrations/20260906020000_digital_observer_incident_verification.sql", import.meta.url), "utf8");
const service = readFileSync(new URL("../../lib/domain/digital-observer/incident-verification-service.ts", import.meta.url), "utf8");
const riskService = readFileSync(new URL("../../lib/domain/digital-observer/risk-decision-service.ts", import.meta.url), "utf8");
const cloudRoute = readFileSync(new URL("../../app/api/video-gateway/cloud-events/route.ts", import.meta.url), "utf8");
const incidentRoute = readFileSync(new URL("../../app/api/digital-observer/incidents/route.ts", import.meta.url), "utf8");
const incidentPage = readFileSync(new URL("../../app/digital-observer/incidents/page.tsx", import.meta.url), "utf8");
const tracker = readFileSync(new URL("../../services/video-gateway/journal-tracker.mjs", import.meta.url), "utf8");

const signal = (overrides = {}) => ({
  id: "event-a", observerSiteId: "site-a", sourceType: "system", provenance: "REAL_CAMERA_AI",
  validated: true, eventType: "person_entered", cameraSourceId: "camera-a", streamId: "stream-a",
  trackId: "track-a", occurredAt: "2026-09-06T09:00:00.000Z", detectionConfidence: 0.94,
  evidenceKind: "line_crossing",
  verificationEvidence: { distinctSourceFrames: 5, directionalConfirmations: 3, sourceSequence: 104, sourceAnchorVerified: true, trackingDurationMs: 8_000 },
  ...overrides
});

const input = (overrides = {}) => ({
  observerSiteId: "site-a",
  incident: {
    id: "incident-a", observerSiteId: "site-a", status: "open", provenance: "REAL_CAMERA_AI",
    cameraSourceIds: ["camera-a"], trackIds: ["track-a"], relatedEventIds: ["event-a"]
  },
  signals: [signal()],
  risk: {
    evaluationId: "risk-a", riskScore: 15, riskBand: "LOW", evaluationConfidence: 0.71,
    recommendedDecision: "LOG_ONLY", matchedRuleCount: 0, explicitHighPriorityRule: false
  },
  context: { withinExpectedHours: true, baselineMaturity: "LEARNING", baselineVersion: "baseline-v1" },
  cameraHealth: { state: "healthy", observedAt: "2026-09-06T09:00:01.000Z" },
  evidence: { status: "not_required", sourceMatches: null, timeMatches: null },
  technicalIntegrity: { sourceBindingValid: true, geometryValid: true, replayedFrameDetected: false },
  policy: { recordingAuthorized: false, inAppNotificationAllowed: true, externalEscalationEnabled: false },
  previousVerification: null,
  evaluatedAt: "2026-09-06T09:00:02.000Z",
  ...overrides
});

const normal = evaluateIncidentVerification(input());
assert(normal.accepted);
assert.equal(normal.status, "CONFIRMED", "a real directional entry with stable multi-frame tracking is confirmed");
assert.equal(normal.classification, "TRUE_EXPECTED_ACTIVITY", "ordinary real activity is not a false detection");
assert.equal(normal.finalDecision, "LOG_ONLY", "a confirmed low-risk expected passage remains bounded");
assert.notEqual(normal.verificationConfidence, input().signals[0].detectionConfidence, "detection confidence is not verification confidence");
assert.notEqual(normal.verificationConfidence * 100, input().risk.riskScore, "verification confidence is not Risk");

const scheduleUnknown = evaluateIncidentVerification(input({
  context: { withinExpectedHours: null, baselineMaturity: "LEARNING", baselineVersion: "baseline-v1" }
}));
assert(scheduleUnknown.accepted && scheduleUnknown.status === "CONFIRMED");
assert.equal(scheduleUnknown.classification, "OTHER_UNKNOWN", "missing schedule cannot overclaim expected or security activity");

const singleFrameDetection = input({
  incident: { ...input().incident, relatedEventIds: ["event-detect"] },
  signals: [signal({ id: "event-detect", eventType: "person_detected", evidenceKind: "object_detection", verificationEvidence: { distinctSourceFrames: 1, sourceSequence: 8 } })],
  technicalIntegrity: { sourceBindingValid: true, geometryValid: null, replayedFrameDetected: false }
});
const weak = evaluateIncidentVerification(singleFrameDetection);
assert(weak.accepted && ["UNVERIFIED", "UNCERTAIN"].includes(weak.status), "an isolated box does not become a confirmed entry");
assert(weak.contradictorySignals.some((item) => item.key === "detection_without_crossing"));

const multiFrameDetection = evaluateIncidentVerification({
  ...singleFrameDetection,
  signals: [signal({ id: "event-detect", eventType: "person_detected", evidenceKind: "object_detection", verificationEvidence: { distinctSourceFrames: 4, sourceSequence: 12 } })]
});
assert(multiFrameDetection.accepted && multiFrameDetection.verificationConfidence > weak.verificationConfidence, "multiple distinct frames strengthen verification");
assert.notEqual(multiFrameDetection.status, "CONFIRMED", "person detection without crossing cannot become a confirmed entry");

const replay = evaluateIncidentVerification({
  ...singleFrameDetection,
  technicalIntegrity: { sourceBindingValid: true, geometryValid: null, replayedFrameDetected: true }
});
assert(replay.accepted && replay.verificationConfidence < weak.verificationConfidence, "a replay never strengthens verification");

const fragmentedInput = input({
  incident: { ...input().incident, trackIds: ["track-a", "track-b"], relatedEventIds: ["event-a", "event-b"] },
  signals: [signal(), signal({ id: "event-b", trackId: "track-b", occurredAt: "2026-09-06T09:00:01.000Z" })]
});
const fragmented = evaluateIncidentVerification(fragmentedInput);
assert(fragmented.accepted && fragmented.verificationConfidence < normal.verificationConfidence, "track fragmentation lowers verification confidence");
assert(fragmented.contradictorySignals.some((item) => item.key === "track_fragmentation"));

const degraded = evaluateIncidentVerification(input({ cameraHealth: { state: "degraded", observedAt: null } }));
assert(degraded.accepted && degraded.verificationConfidence < normal.verificationConfidence, "degraded camera quality lowers certainty without erasing the Incident");
assert.notEqual(degraded.status, "REJECTED_FALSE_POSITIVE");

const closedInput = input({
  incident: { ...input().incident, status: "closed", relatedEventIds: ["event-a", "event-exit"] },
  signals: [signal(), signal({ id: "event-exit", eventType: "person_exited", occurredAt: "2026-09-06T09:00:25.000Z", verificationEvidence: { distinctSourceFrames: 8, directionalConfirmations: 3, sourceSequence: 121 } })],
  evaluatedAt: "2026-09-06T09:00:26.000Z"
});
const resolved = evaluateIncidentVerification(closedInput);
assert(resolved.accepted && resolved.status === "RESOLVED", "compatible real entry/exit strengthens and resolves verification");

const mismatch = evaluateIncidentVerification(input({ evidence: { status: "available", sourceMatches: false, timeMatches: true } }));
assert(mismatch.accepted && mismatch.status === "REJECTED_FALSE_POSITIVE" && mismatch.classification === "FALSE_CORRELATION", "wrong-camera evidence is a technical false correlation");

const mock = evaluateIncidentVerification(input({ signals: [signal({ provenance: "SHADOW_AI" })] }));
assert.deepEqual(mock, { accepted: false, reason: "UNTRUSTED_PROVENANCE" }, "mock/shadow cannot verify Production");
const foreign = evaluateIncidentVerification(input({ signals: [signal({ observerSiteId: "site-b" })] }));
assert.deepEqual(foreign, { accepted: false, reason: "SCOPE_MISMATCH" }, "tenant/site boundaries remain strict");

const highUncertain = evaluateIncidentVerification({
  ...singleFrameDetection,
  risk: { ...singleFrameDetection.risk, riskScore: 82, riskBand: "HIGH", recommendedDecision: "NOTIFY_IN_APP" }
});
assert(highUncertain.accepted && highUncertain.finalDecision === "VERIFY", "high Risk plus weak verification requests verification instead of noisy interruption");

const fastPath = evaluateIncidentVerification(input({
  risk: { ...input().risk, riskScore: 82, riskBand: "HIGH", recommendedDecision: "NOTIFY_IN_APP", matchedRuleCount: 1, explicitHighPriorityRule: true }
}));
assert(fastPath.accepted && fastPath.fastPath && fastPath.finalDecision === "NOTIFY_IN_APP", "a confirmed explicit high-priority rule supports the no-delay path");

const privacy = evaluateIncidentVerification(input({
  risk: { ...input().risk, riskScore: 55, riskBand: "ELEVATED", recommendedDecision: "PRESERVE_EVIDENCE" },
  policy: { recordingAuthorized: false, inAppNotificationAllowed: true, externalEscalationEnabled: false }
}));
assert(privacy.accepted && privacy.finalDecision !== "PRESERVE_EVIDENCE", "verification cannot override recording/privacy policy");

const duplicate = evaluateIncidentVerification(input());
assert(duplicate.accepted && duplicate.inputFingerprint === normal.inputFingerprint, "recalculation is idempotent");
assert.equal(duplicate.decisionDedupeKey, normal.decisionDedupeKey, "duplicate calculations cannot spam final action intent");

for (const required of [
  "digital_observer_incident_verifications", "previous_verification_id", "TRUE_EXPECTED_ACTIVITY",
  "FALSE_DETECTION", "FALSE_CORRELATION", "latest_verification_id", "observer_site_memberships",
  "external action execution"
]) assert(migration.includes(required), `verification migration missing ${required}`);
for (const required of [
  "evaluateIncidentVerification", "decision_stage: \"post_verification_final\"", "privacy_policy_authoritative",
  "INCIDENT_VERIFICATION_PROJECTION_FAILED", "digital_observer_event_clips", "evaluatePersistedIncidentVerification",
  "PERSISTED_INCIDENT_RISK_UNAVAILABLE"
]) assert(service.includes(required), `verification service missing ${required}`);
assert(riskService.includes("evaluateAndPersistIncidentVerification"), "Risk persistence must continue into canonical Verification");
assert(!riskService.includes("for (const intent of evaluation.actionIntents)"), "pre-verification Risk recommendations must not create competing final action intents");
for (const required of ["verification_status", "final_decision_confidence", "verification_version"])
  assert(cloudRoute.includes(required), `Gateway event response missing ${required}`);
for (const required of ["incident_verifications", "verification_metrics", "average_time_to_verification_ms", "do-verification-v2"])
  assert(incidentRoute.includes(required), `Incident API missing ${required}`);
for (const required of ["אימות האירוע", "ביטחון באימות", "ביטחון בהחלטה", "אותות סותרים"])
  assert(incidentPage.includes(required), `Incident UI missing ${required}`);
for (const required of ["distinct_source_frames", "directional_confirmations", "source_anchor_verified"])
  assert(tracker.includes(required), `Gateway audit evidence missing ${required}`);

console.log("Digital Observer Incident Verification checks passed: confidence separation, multi-frame/track/spatial corroboration, degraded-camera uncertainty, expected-activity distinction, false-correlation rejection, Risk+Verification final Decision, provenance/scope/privacy guards, history and idempotency.");
