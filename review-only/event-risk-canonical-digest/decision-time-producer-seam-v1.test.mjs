import assert from "node:assert/strict";
import test from "node:test";
import { prepareDecisionTimeCandidateV1 } from "./decision-time-producer-seam-v1.mjs";
import { snapshotDigestsV1 } from "./canonical-v1.mjs";

const NOW = "2026-10-27T00:00:20.000Z";
const scope = { tenantId: "11111111-1111-4111-8111-111111111111",
  siteId: "33333333-3333-4333-8333-333333333333",
  sourceId: "55555555-5555-4555-8555-555555555555",
  eventId: "77777777-7777-4777-8777-777777777777",
  incidentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  riskDecisionId: "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const request = { scope, engineVersion: "do-risk-v1" };
function facts() {
  return { ownership: { stage: "POST_READ_RISK_SCOPE_BOUND", scope: { ...scope },
      authorityEvidenceRef: "synthetic-ownership-receipt", verifiedAt: "2026-10-27T00:00:15.000Z" },
    risk: { scope: { ...scope }, riskDecisionId: scope.riskDecisionId, engineVersion: "do-risk-v1",
      decisionCode: "LOG_ONLY", severity: "HIGH", evaluatedAt: "2026-10-27T00:00:12.000Z", persisted: true },
    settings: { scope: { ...scope }, settingsVersion: "settings-v1", policyVersion: "policy-v1",
      capturedAt: "2026-10-27T00:00:10.000Z", authorityEvidenceRef: "synthetic-settings-receipt",
      recipients: [{ tenantId: scope.tenantId, siteId: scope.siteId,
        recipientRef: "אב😀", authorizationRef: "synthetic-recipient-receipt",
        verifiedForDecision: true, channels: [{ channel: "in_app", enabled: true,
          severityLevels: ["HIGH"] }] }] } };
}
function invoke({ readFacts = facts, readFrozen = async () => null, input = request, now = NOW } = {}) {
  return prepareDecisionTimeCandidateV1({ request: input, now,
    trustedFrozenReader: { readFrozen }, trustedDecisionReader: { readAtDecision: readFacts } });
}
function denied(name, change, marker) {
  test(name, async () => {
    const input = facts();
    change(input);
    await assert.rejects(invoke({ readFacts: async () => input }), marker);
  });
}

test("candidate binds synthetic decision-time facts to canonical-v1 without persisting", async () => {
  const result = await invoke();
  assert.equal(result.status, "CANDIDATE_NOT_PERSISTED");
  assert.equal(result.requiresAtomicInsert, true);
  assert.equal(result.record.digestAlgorithm, "canonical-v1");
  assert.equal(result.record.authorityEvidenceRef, "synthetic-ownership-receipt");
  assert.equal(result.record.settingsAuthorityRef, "synthetic-settings-receipt");
  assert.deepEqual(snapshotDigestsV1(result.record.content, scope.tenantId, scope.siteId),
    { fingerprint: result.record.fingerprint, digest: result.record.digest });
  assert.equal(Object.isFrozen(result.record.content.recipients[0].channels[0]), true);
});
test("no server-owned reader and client-supplied digest are rejected", async () => {
  await assert.rejects(prepareDecisionTimeCandidateV1({ request, now: NOW }), /READER_MISSING/);
  await assert.rejects(invoke({ input: { ...request, expectedDigest: "0".repeat(64) } }), /SHAPE_INVALID/);
  await assert.rejects(invoke({ input: { ...request, engineVersion: "unknown" } }), /REQUEST_INVALID/);
  await assert.rejects(invoke({ input: { ...request, scope: { ...scope, eventId: "not-a-uuid" } } }), /REQUEST_INVALID/);
  await assert.rejects(invoke({ readFacts: async () => null }), /SHAPE_INVALID/);
});
denied("stale ownership evidence denied", x => { x.ownership.verifiedAt = "2026-10-26T23:59:00.000Z"; }, /AUTHORITY_STALE/);
denied("stale Risk decision denied", x => { x.risk.evaluatedAt = "2026-10-26T23:59:00.000Z"; }, /AUTHORITY_STALE/);
denied("stale recipient settings denied", x => { x.settings.capturedAt = "2026-10-26T23:59:00.000Z"; }, /AUTHORITY_STALE/);
denied("wrong ownership Tenant denied", x => { x.ownership.scope.tenantId = scope.siteId; }, /AUTHORITY_UNVERIFIED/);
denied("wrong Risk Site denied", x => { x.risk.scope.siteId = scope.tenantId; }, /AUTHORITY_UNVERIFIED/);
denied("wrong settings Site denied, including empty recipient list", x => {
  x.settings.scope.siteId = scope.tenantId; x.settings.recipients = [];
}, /AUTHORITY_UNVERIFIED/);
denied("recipient from another Tenant denied", x => {
  x.settings.recipients[0].tenantId = scope.siteId;
}, /RECIPIENT_UNVERIFIED/);
denied("recipient from another Site denied", x => {
  x.settings.recipients[0].siteId = scope.tenantId;
}, /RECIPIENT_UNVERIFIED/);
denied("unverified recipient denied", x => { x.settings.recipients[0].verifiedForDecision = false; }, /RECIPIENT_UNVERIFIED/);
denied("unpersisted or mismatched Risk denied", x => { x.risk.persisted = false; }, /AUTHORITY_UNVERIFIED/);
denied("wrong Risk engine denied", x => { x.risk.engineVersion = "other-engine"; }, /AUTHORITY_UNVERIFIED/);
denied("duplicate recipient identity denied", x => {
  x.settings.recipients.push(structuredClone(x.settings.recipients[0]));
}, /CANON_V1_/);

test("replay reuses the frozen content even when current settings and recipients change", async () => {
  const first = (await invoke()).record;
  let currentRead = 0;
  const replay = await invoke({ readFrozen: async () => first,
    readFacts: async () => { currentRead++; const x = facts(); x.settings.settingsVersion = "settings-v2";
      x.settings.recipients = []; return x; } });
  assert.equal(replay.status, "FROZEN_REPLAY");
  assert.equal(currentRead, 0);
  assert.equal(replay.record.digest, first.digest);
  assert.equal(replay.record.content.settingsVersion, "settings-v1");
  assert.equal(replay.record.content.recipients.length, 1);
});
test("without an atomic frozen row, changed settings yield only a new unpersisted candidate", async () => {
  const first = await invoke();
  const second = await invoke({ readFacts: async () => {
    const x = facts(); x.settings.policyVersion = "policy-v2"; return x;
  } });
  assert.equal(first.status, "CANDIDATE_NOT_PERSISTED");
  assert.equal(second.status, "CANDIDATE_NOT_PERSISTED");
  assert.notEqual(first.record.digest, second.record.digest);
});
test("forged digest, changed snapshot or scope cannot become a replay", async () => {
  const first = (await invoke()).record;
  await assert.rejects(invoke({ readFrozen: async () => ({ ...first, digest: "0".repeat(64) }) }), /DIGEST_MISMATCH/);
  await assert.rejects(invoke({ readFrozen: async () => ({ ...first,
    content: { ...first.content, settingsVersion: "settings-v2" } }) }), /DIGEST_MISMATCH/);
  await assert.rejects(invoke({ readFrozen: async () => ({ ...first,
    scope: { ...first.scope, siteId: scope.tenantId } }) }), /FROZEN_SCOPE_INVALID/);
});
test("unknown and legacy algorithms remain fail-closed; no in-place upgrade", async () => {
  const first = (await invoke()).record;
  await assert.rejects(invoke({ readFrozen: async () => ({ ...first, digestAlgorithm: "future-v2" }) }), /ALGORITHM_UNKNOWN/);
  await assert.rejects(invoke({ readFrozen: async () => ({ ...first, digestAlgorithm: "pg-jsonb-text-v1" }) }),
    /LEGACY_REQUIRES_PG_VERIFICATION/);
  await assert.rejects(invoke({ readFrozen: async () => ({ digestAlgorithm: "pg-jsonb-text-v1" }) }),
    /LEGACY_REQUIRES_PG_VERIFICATION/);
});
