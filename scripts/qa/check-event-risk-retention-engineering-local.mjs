import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ENGINEERING_RETENTION_POLICY_V1, addCalendarMonthsUtc,
  evaluateEngineeringRetention, summarizeEngineeringRetentionDryRun
} from "../../lib/domain/digital-observer/retention-engineering-baseline.ts";
import { evaluateRetentionDisposition } from "../../lib/domain/digital-observer/privacy-compliance.ts";

const at = value => new Date(value);
const recordedAt = "2025-12-01T00:00:00.000Z";
const closedAt = "2026-01-01T00:00:00.000Z";
const resolvedAt = closedAt;
const required = {
  REGISTRATION_VERSION: ["EVENT", "CLAIM", "EFFECT", "REPLAY", "RESTORE"],
  EVENT_ACCEPTANCE_BINDING: ["EVENT", "INCIDENT", "CLAIM", "EFFECT", "COMPLAINT", "REPLAY", "RESTORE"],
  RISK_PROCESSING: ["CLAIM", "EFFECT", "EXTERNAL_OUTCOME", "REPLAY", "RESTORE", "ROLLBACK"],
  RECIPIENT_SETTINGS_REFERENCE: ["DELIVERY", "COMPLAINT", "REPLAY", "RESTORE"],
  REGISTRATION_BUSINESS_AUDIT: ["INVESTIGATION", "RESTORE"],
  SECURITY_COMPLIANCE_LOG: ["RESTORE"], DEBUG_TELEMETRY: []
};
const dependency = kind => ({ kind, state: "RESOLVED", resolvedAt,
  ...(["REPLAY", "RESTORE"].includes(kind) ? { horizonUntil: resolvedAt } : {}) });
function input(category = "EVENT_ACCEPTANCE_BINDING", overrides = {}) {
  const classification = category === "SECURITY_COMPLIANCE_LOG" ? "TECHNICAL_SECURITY_LOG"
    : category === "REGISTRATION_BUSINESS_AUDIT" ? "BUSINESS_AUDIT"
      : category === "DEBUG_TELEMETRY" ? "NON_SENSITIVE_DEBUG" : "OPERATIONAL_METADATA";
  return { authority: "TRUSTED_SERVER", category, context: "HOME", jurisdiction: "IL",
    policyVersion: ENGINEERING_RETENTION_POLICY_V1.version, purpose: "synthetic review",
    environment: "SYNTHETIC_QA", securityClassification: classification,
    securityLogApplicability: category === "SECURITY_COMPLIANCE_LOG" ? "APPLIES" : "DOES_NOT_APPLY",
    recordedAt, closedAt, hold: { state: "NONE" },
    dependencies: (required[category] ?? []).map(dependency),
    ...(category === "REGISTRATION_VERSION" ? { registration: {
      currentVersion: false, sourceActive: true, supersededAt: closedAt } } : {}),
    ...overrides };
}
const evaluate = (value, when = "2026-02-01T00:00:00.000Z") => evaluateEngineeringRetention(value, at(when));

test("baseline is engineering-only and exact 30-day boundary yields review, never deletion", () => {
  assert.equal(ENGINEERING_RETENTION_POLICY_V1.externalLegalApproval, false);
  assert.equal(ENGINEERING_RETENTION_POLICY_V1.realDataActivationReady, false);
  const candidate = input();
  const before = evaluate(candidate, "2026-01-30T23:59:59.999Z");
  const edge = evaluate(candidate, "2026-01-31T00:00:00.000Z");
  assert.equal(before.state, "KEEP_REQUIRED");
  assert.equal(before.earliestReviewAt, "2026-01-31T00:00:00.000Z");
  assert.equal(edge.state, "ELIGIBLE_FOR_REVIEW");
  assert.equal(edge.deletionAuthorized, false);
});

test("existing privacy disposition still requires external approval", () => {
  const active = evaluateRetentionDisposition({ dataClass: "EVENT_ALERT_METADATA",
    expiresAt: "2020-01-01T00:00:00.000Z", activeLegalHold: false,
    externalSystemOwnsData: false, externalDeletionConfirmed: false,
    policyDecision: "LEGAL_REVIEW_PENDING" }, at("2026-02-01T00:00:00.000Z"));
  assert.deepEqual(active, { action: "REVIEW", reason: "POLICY_NOT_APPROVED" });
});

test("24 calendar months use UTC day clamping, not 730 days or chained month addition", () => {
  assert.equal(addCalendarMonthsUtc("2024-02-29T12:13:14.123Z", 24), "2026-02-28T12:13:14.123Z");
  assert.equal(addCalendarMonthsUtc("2025-01-31T00:00:00.000Z", 1), "2025-02-28T00:00:00.000Z");
  assert.equal(addCalendarMonthsUtc("2024-01-31T00:00:00.000Z", 1), "2024-02-29T00:00:00.000Z");
  assert.equal(addCalendarMonthsUtc("2024-01-31T00:00:00.000Z", 2), "2024-03-31T00:00:00.000Z");
  const log = input("SECURITY_COMPLIANCE_LOG", { recordedAt: "2024-02-29T12:13:14.123Z",
    closedAt: null, dependencies: [{ kind: "RESTORE", state: "RESOLVED",
      resolvedAt: "2024-03-01T00:00:00.000Z", horizonUntil: "2024-03-01T00:00:00.000Z" }] });
  assert.equal(evaluate(log, "2026-02-28T12:13:14.122Z").state, "KEEP_REQUIRED");
  assert.equal(evaluate(log, "2026-02-28T12:13:14.123Z").state, "ELIGIBLE_FOR_REVIEW");
  const released = { ...log, hold: { state: "RELEASED",
    releasedAt: "2026-03-01T00:00:00.000Z" } };
  assert.equal(evaluate(released, "2026-03-01T00:00:00.000Z").earliestReviewAt,
    "2026-03-01T00:00:00.000Z");
});

test("current registration is kept, and superseded version survives its old Event", () => {
  assert.equal(evaluate(input("REGISTRATION_VERSION", { registration: {
    currentVersion: true, sourceActive: true } })).reasonCodes[0], "CURRENT_REGISTRATION_REQUIRED");
  const superseded = input("REGISTRATION_VERSION");
  const oldEvent = { ...superseded, dependencies: superseded.dependencies.map(row =>
    row.kind === "EVENT" ? { kind: "EVENT", state: "ACTIVE" } : row) };
  assert.equal(evaluate(oldEvent).state, "WAIT_DEPENDENCIES");
  assert.equal(evaluate(superseded).state, "ELIGIBLE_FOR_REVIEW");
  const retired = input("REGISTRATION_VERSION", { registration: {
    currentVersion: true, sourceActive: false, sourceRetiredAt: closedAt } });
  assert.equal(evaluate(retired).state, "ELIGIBLE_FOR_REVIEW");
});

test("expired lease is not completion; pending effect and unknown provider outcome block review", () => {
  const risk = input("RISK_PROCESSING");
  const pendingEffect = { ...risk, dependencies: risk.dependencies.map(row =>
    row.kind === "EFFECT" ? { kind: "EFFECT", state: "ACTIVE" } : row) };
  assert.equal(evaluate(pendingEffect).reasonCodes[0], "DEPENDENCY_ACTIVE");
  const unknownOutcome = { ...risk, dependencies: risk.dependencies.map(row =>
    row.kind === "EXTERNAL_OUTCOME" ? { kind: "EXTERNAL_OUTCOME", state: "UNKNOWN" } : row) };
  assert.equal(evaluate(unknownOutcome).state, "WAIT_DEPENDENCIES");
  assert.equal(evaluate(risk).state, "ELIGIBLE_FOR_REVIEW");
});

test("active hold wins; released hold does not bypass future restore dependency", () => {
  const candidate = input();
  assert.equal(evaluate({ ...candidate, hold: { state: "ACTIVE" } }).reasonCodes[0], "ACTIVE_LEGAL_HOLD");
  const held = evaluate({ ...candidate, hold: { state: "ACTIVE",
    activatedAt: "2026-01-01T00:00:00.000Z", reviewedAt: "2026-01-10T00:00:00.000Z" } });
  assert.equal(held.state, "KEEP_REQUIRED");
  assert.equal(held.earliestReviewAt, "2026-02-09T00:00:00.000Z");
  const restoredLater = { ...candidate, hold: { state: "RELEASED", releasedAt: closedAt },
    dependencies: candidate.dependencies.map(row => row.kind === "RESTORE"
      ? { ...row, horizonUntil: "2026-03-01T00:00:00.000Z" } : row) };
  const decision = evaluate(restoredLater);
  assert.equal(decision.state, "WAIT_DEPENDENCIES");
  assert.equal(decision.earliestReviewAt, "2026-03-31T00:00:00.000Z");
});

test("unbounded or missing replay/restore horizon never selects a short period", () => {
  const candidate = input();
  const unbounded = { ...candidate, dependencies: candidate.dependencies.map(row =>
    row.kind === "REPLAY" ? { kind: "REPLAY", state: "UNBOUNDED" } : row) };
  assert.equal(evaluate(unbounded).reasonCodes[0], "DEPENDENCY_UNBOUNDED");
  const noHorizon = { ...candidate, dependencies: candidate.dependencies.map(row =>
    row.kind === "RESTORE" ? { kind: "RESTORE", state: "RESOLVED", resolvedAt } : row) };
  assert.equal(evaluate(noHorizon).reasonCodes[0], "DEPENDENCY_UNVERIFIED");
});

test("missing/contradictory/future/non-UTC dates are invalid", () => {
  assert.equal(evaluate(input(undefined, { recordedAt: "2025-02-30T00:00:00.000Z" })).state, "INVALID_INPUT");
  assert.equal(evaluate(input(undefined, { recordedAt: "2026-04-01T00:00:00.000Z" })).state, "INVALID_INPUT");
  assert.equal(evaluate(input(undefined, { closedAt: "2025-11-01T00:00:00.000Z" })).state, "INVALID_INPUT");
  assert.equal(evaluate(input(undefined, { closedAt: "2026-01-01T03:00:00+03:00" })).state, "INVALID_INPUT");
  assert.equal(evaluate(input(undefined, { dependencies: [dependency("EVENT"), dependency("EVENT")] })).state, "INVALID_INPUT");
});

test("policy change, missing jurisdiction and missing security classification fail closed", () => {
  assert.equal(evaluate(input(undefined, { policyVersion: "older-v0" })).reasonCodes[0], "POLICY_VERSION_REVIEW");
  assert.equal(evaluate(input(undefined, { jurisdiction: null })).state, "WAIT_POLICY");
  assert.equal(evaluate(input(undefined, { context: "SMALL_BUSINESS" })).state, "WAIT_POLICY");
  assert.equal(evaluate(input(undefined, { securityClassification: null })).state, "WAIT_POLICY");
  assert.equal(evaluate(input(undefined, { securityLogApplicability: "UNKNOWN" })).state, "WAIT_POLICY");
});

test("technical log's conditional 24 months cannot be downgraded to business audit's 30 days", () => {
  const audit = input("REGISTRATION_BUSINESS_AUDIT");
  assert.equal(evaluate(audit).state, "ELIGIBLE_FOR_REVIEW");
  assert.equal(evaluate({ ...audit, securityLogApplicability: "APPLIES" }).state, "WAIT_POLICY");
  assert.equal(evaluate(input("SECURITY_COMPLIANCE_LOG", {
    securityLogApplicability: "UNKNOWN" })).state, "WAIT_POLICY");
  assert.equal(evaluate(input("SECURITY_COMPLIANCE_LOG")).state, "KEEP_REQUIRED");
});

test("debug TTL is synthetic-only and media/special data have no inherited period", () => {
  const debug = input("DEBUG_TELEMETRY", { closedAt: null });
  assert.equal(evaluate(debug, "2025-12-08T00:00:00.000Z").state, "ELIGIBLE_FOR_REVIEW");
  assert.equal(evaluate({ ...debug, environment: "REAL" }).state, "WAIT_POLICY");
  assert.equal(evaluate(input("DIGITAL_OBSERVER_EVIDENCE", {
    securityClassification: "SPECIAL_OR_MEDIA" })).state, "WAIT_POLICY");
});

test("revoked recipient cannot be expanded; dry-run outputs only sanitized category/reason/count", () => {
  const candidate = input("RECIPIENT_SETTINGS_REFERENCE", { recipientIds: ["person@example.invalid"],
    recipientCurrentPermission: "REVOKED", dependencies: [
      { kind: "DELIVERY", state: "ACTIVE" }, dependency("COMPLAINT"),
      dependency("REPLAY"), dependency("RESTORE") ] });
  const frozen = structuredClone(candidate);
  Object.freeze(candidate);
  const decision = evaluate(candidate);
  assert.equal(decision.state, "WAIT_DEPENDENCIES");
  const report = summarizeEngineeringRetentionDryRun([decision, decision]);
  assert.equal(report[0].count, 2);
  assert.deepEqual(candidate, frozen);
  assert(!JSON.stringify({ decision, report }).includes("person@example.invalid"));
  assert(!JSON.stringify({ decision, report }).includes("REVOKED"));
  assert.equal(decision.deletionAuthorized, false);
  const forged = summarizeEngineeringRetentionDryRun([{ ...decision,
    category: "person@example.invalid", state: "person@example.invalid",
    reasonCodes: ["person@example.invalid"], earliestReviewAt: "person@example.invalid" }]);
  assert.equal(forged[0].category, "UNRECOGNIZED");
  assert.equal(forged[0].state, "INVALID_INPUT");
  assert.equal(forged[0].nextReviewAt, null);
  assert(!JSON.stringify(forged).includes("person@example.invalid"));
});

test("module is disconnected from runtime, SQL, deletion and active retention executor", () => {
  const source = readFileSync(new URL("../../lib/domain/digital-observer/retention-engineering-baseline.ts", import.meta.url), "utf8");
  const ingest = readFileSync(new URL("../../app/api/video-gateway/cloud-events/route.ts", import.meta.url), "utf8");
  assert(!ingest.includes("retention-engineering-baseline"));
  assert(!/\b(delete|remove|truncate|drop)\s*\(/i.test(source));
  assert(!/createAdminClient|supabase\.from|fetch\(|cron|setInterval\(/.test(source));
});
