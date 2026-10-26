// REVIEW ONLY. No production adapter, route, persistence, or authority is installed.
// The injected readers must be server-owned and independently reviewed before use.
import { assertSnapshotDigestsV1, snapshotDigestsV1 } from "./canonical-v1.mjs";

const SCOPE_KEYS = ["tenantId", "siteId", "sourceId", "eventId", "incidentId", "riskDecisionId"];
const MAX_AGE_MS = 30_000; // Candidate fail-closed freshness bound, not an approved product SLA.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function fail(code) { throw new Error(`DECISION_TIME_${code}`); }
function exact(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).length !== keys.length
    || keys.some(key => !Object.hasOwn(value, key))) fail("SHAPE_INVALID");
}
function text(value) { return typeof value === "string" && value.length > 0 && value.length <= 256; }
function canonicalTime(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
function sameScope(left, right) { return SCOPE_KEYS.every(key => left?.[key] === right[key]); }
function assertRequest(request) {
  exact(request, ["scope", "engineVersion"]);
  exact(request.scope, SCOPE_KEYS);
  if (SCOPE_KEYS.some(key => !UUID.test(request.scope[key]))
    || request.engineVersion !== "do-risk-v1") fail("REQUEST_INVALID");
}
function assertFresh(timestamp, nowMs) {
  if (!canonicalTime(timestamp) || Date.parse(timestamp) > nowMs
    || nowMs - Date.parse(timestamp) > MAX_AGE_MS) fail("AUTHORITY_STALE");
}
function immutable(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}
function assertStored(record, request) {
  if (!record || typeof record !== "object" || Array.isArray(record)) fail("FROZEN_SHAPE_INVALID");
  if (record.digestAlgorithm === "pg-jsonb-text-v1") {
    // The guarded PR #259/#260 reader owns this old database serialization.
    // Never reinterpret, upgrade, or overwrite its hashes in Node.
    fail("LEGACY_REQUIRES_PG_VERIFICATION");
  }
  if (record.digestAlgorithm !== "canonical-v1") fail("ALGORITHM_UNKNOWN");
  exact(record, ["scope", "engineVersion", "digestAlgorithm", "content", "fingerprint", "digest", "authorityEvidenceRef", "settingsAuthorityRef"]);
  if (!sameScope(record.scope, request.scope) || record.engineVersion !== request.engineVersion
    || !text(record.authorityEvidenceRef) || !text(record.settingsAuthorityRef)) fail("FROZEN_SCOPE_INVALID");
  exact(record.scope, SCOPE_KEYS);
  if (!sameScope(record.content?.scope, request.scope)) fail("FROZEN_SCOPE_INVALID");
  assertSnapshotDigestsV1(record.content, request.scope.tenantId, request.scope.siteId,
    { fingerprint: record.fingerprint, digest: record.digest });
  return immutable({ status: "FROZEN_REPLAY", record: structuredClone(record) });
}

/**
 * Candidate only. `trustedFrozenReader` must read an immutable, scoped record;
 * `trustedDecisionReader` must read ownership, Risk and recipient settings in
 * one consistent server-side decision-time operation. Neither adapter exists.
 * No supplied digest or client snapshot is accepted in `request`.
 */
export async function prepareDecisionTimeCandidateV1({ request, now, trustedFrozenReader, trustedDecisionReader }) {
  assertRequest(request);
  if (!canonicalTime(now) || typeof trustedFrozenReader?.readFrozen !== "function"
    || typeof trustedDecisionReader?.readAtDecision !== "function") fail("READER_MISSING");
  const existing = await trustedFrozenReader.readFrozen(request);
  if (existing !== null && existing !== undefined) return assertStored(existing, request);

  const facts = await trustedDecisionReader.readAtDecision(request);
  exact(facts, ["ownership", "risk", "settings"]);
  exact(facts.ownership, ["stage", "scope", "authorityEvidenceRef", "verifiedAt"]);
  exact(facts.ownership.scope, SCOPE_KEYS);
  exact(facts.risk, ["scope", "riskDecisionId", "engineVersion", "decisionCode", "severity", "evaluatedAt", "persisted"]);
  exact(facts.risk.scope, SCOPE_KEYS);
  exact(facts.settings, ["scope", "settingsVersion", "policyVersion", "capturedAt", "authorityEvidenceRef", "recipients"]);
  exact(facts.settings.scope, SCOPE_KEYS);
  if (facts.ownership.stage !== "POST_READ_RISK_SCOPE_BOUND"
    || !sameScope(facts.ownership.scope, request.scope)
    || !text(facts.ownership.authorityEvidenceRef)
    || !sameScope(facts.risk.scope, request.scope) || !sameScope(facts.settings.scope, request.scope)
    || facts.risk.persisted !== true || facts.risk.riskDecisionId !== request.scope.riskDecisionId
    || facts.risk.engineVersion !== request.engineVersion
    || !text(facts.risk.decisionCode) || !text(facts.risk.severity)
    || !text(facts.settings.settingsVersion) || !text(facts.settings.policyVersion)
    || !text(facts.settings.authorityEvidenceRef)
    || !Array.isArray(facts.settings.recipients)) fail("AUTHORITY_UNVERIFIED");
  const nowMs = Date.parse(now);
  assertFresh(facts.ownership.verifiedAt, nowMs);
  assertFresh(facts.risk.evaluatedAt, nowMs);
  assertFresh(facts.settings.capturedAt, nowMs);

  const recipients = facts.settings.recipients.map(row => {
    exact(row, ["tenantId", "siteId", "recipientRef", "authorizationRef", "verifiedForDecision", "channels"]);
    if (row.tenantId !== request.scope.tenantId || row.siteId !== request.scope.siteId
      || !text(row.recipientRef) || !text(row.authorizationRef)
      || row.verifiedForDecision !== true || !Array.isArray(row.channels)) fail("RECIPIENT_UNVERIFIED");
    return { recipientRef: row.recipientRef, channels: row.channels.map(channel => {
      exact(channel, ["channel", "enabled", "severityLevels"]);
      return { channel: channel.channel, enabled: channel.enabled, severityLevels: channel.severityLevels };
    }) };
  });
  // The candidate does not sort or repair inputs: duplicates and noncanonical
  // order are rejected by the independently cross-checked v1 validator.
  const content = { schemaVersion: 1, scope: { ...request.scope },
    decisionCode: facts.risk.decisionCode, severity: facts.risk.severity,
    settingsVersion: facts.settings.settingsVersion, policyVersion: facts.settings.policyVersion,
    capturedAt: facts.settings.capturedAt, recipients };
  const { fingerprint, digest } = snapshotDigestsV1(content, request.scope.tenantId, request.scope.siteId);
  return immutable({ status: "CANDIDATE_NOT_PERSISTED", requiresAtomicInsert: true,
    record: { scope: { ...request.scope }, engineVersion: request.engineVersion,
      digestAlgorithm: "canonical-v1", content, fingerprint, digest,
      authorityEvidenceRef: facts.ownership.authorityEvidenceRef,
      settingsAuthorityRef: facts.settings.authorityEvidenceRef } });
}
