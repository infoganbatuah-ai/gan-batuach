import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { evaluateHomeLegacyMatch, HOME_LEGACY_MATCH_DEVICES, HOME_LEGACY_MATCH_SITE_ID, HOME_LEGACY_MATCH_BINDINGS } from "../../services/video-gateway/home-legacy-match-service.mjs";

const tenantId = HOME_LEGACY_MATCH_SITE_ID;
const credential = "synthetic-legacy-credential-for-isolated-qa-only-123456";
let checks = 0;

for (const [deviceId, deploymentProfile] of Object.entries(HOME_LEGACY_MATCH_DEVICES)) {
  const expected = HOME_LEGACY_MATCH_BINDINGS[deviceId];
  let compareCalls = 0;
  let credentialReads = 0;
  const audit = [];
  const consumed = new Set();
  const services = {
    now: () => 1_000_000,
    authorizeAdministrator: async () => ({ authenticated: true, role: "platform_admin",
      purpose: "HOME_TELEMETRY_LEGACY_MATCH", deviceId, siteId: HOME_LEGACY_MATCH_SITE_ID,
      tenantId, actorId: "synthetic-admin", approvalId: "synthetic-approval",
      issuedAt: 990_000, expiresAt: 1_030_000, revoked: false }),
    confirmApprovalActive: async () => true,
    consumeAttempt: async ({ requestId, maxAttempts }) => {
      assert.equal(maxAttempts, 2);
      if (consumed.has(requestId)) return false;
      consumed.add(requestId);
      return true;
    },
    compareBoundCredential: async binding => {
      compareCalls++;
      assert.deepEqual(binding, expected);
      credentialReads++;
      return "MATCH";
    },
    recordAudit: async event => { audit.push(event); return true; }
  };
  const run = (id = deviceId, dependencies = services, requestId = randomUUID()) =>
    evaluateHomeLegacyMatch({ deviceId: id, requestId }, dependencies);
  assert.equal(await run(), "MATCH"); checks++;
  assert.deepEqual(audit.map(event => event.phase), ["AUTHORIZED", "RESULT"]); checks++;
  assert.equal(audit[1].outcome, "MATCH"); checks++;
  assert.equal(JSON.stringify(audit).includes(credential), false); checks++;
  assert.equal(await run(deviceId, { ...services, compareBoundCredential: async () => "MISMATCH" }), "MISMATCH"); checks++;
  const reusedRequestId = randomUUID();
  assert.equal(await run(deviceId, services, reusedRequestId), "MATCH"); checks++;
  const replayReads = credentialReads;
  assert.equal(await run(deviceId, services, reusedRequestId), "UNKNOWN"); checks++;
  assert.equal(credentialReads, replayReads); checks++;
  assert.equal(audit.at(-1).phase, "DENIED"); checks++;
  const concurrentId = randomUUID();
  const concurrentReads = credentialReads;
  const concurrent = await Promise.all([run(deviceId, services, concurrentId), run(deviceId, services, concurrentId)]);
  assert.deepEqual(concurrent.sort(), ["MATCH", "UNKNOWN"]); checks++;
  assert.equal(credentialReads, concurrentReads + 1); checks++;
  let boundedAttempts = 0;
  const bounded = { ...services, consumeAttempt: async ({ maxAttempts }) => ++boundedAttempts <= maxAttempts };
  assert.equal(await run(deviceId, bounded), "MATCH"); checks++;
  assert.equal(await run(deviceId, bounded), "MATCH"); checks++;
  const readsAtLimit = credentialReads;
  assert.equal(await run(deviceId, bounded), "UNKNOWN"); checks++;
  assert.equal(credentialReads, readsAtLimit); checks++;
  for (const change of [
    { authorizeAdministrator: async () => ({ ...await services.authorizeAdministrator(), siteId: "wrong-site" }) },
    { authorizeAdministrator: async () => ({ ...await services.authorizeAdministrator(), role: "VIEWER" }) },
    { authorizeAdministrator: async () => ({ ...await services.authorizeAdministrator(), purpose: "OTHER" }) },
    { authorizeAdministrator: async () => ({ ...await services.authorizeAdministrator(), deviceId: "wrong-device" }) },
    { authorizeAdministrator: async () => ({ ...await services.authorizeAdministrator(), expiresAt: 1_000_000 }) },
    { authorizeAdministrator: async () => ({ ...await services.authorizeAdministrator(), expiresAt: 1_400_001 }) },
    { authorizeAdministrator: async () => ({ ...await services.authorizeAdministrator(), revoked: true }) },
    { authorizeAdministrator: async () => ({ ...await services.authorizeAdministrator(), tenantId: "wrong-tenant" }) },
    { confirmApprovalActive: async () => false },
    { consumeAttempt: async () => false },
    { recordAudit: async () => false }
  ]) {
    const before = compareCalls;
    assert.equal(await run(deviceId, { ...services, ...change }), "UNKNOWN");
    assert.equal(compareCalls, before);
    checks++;
  }
  assert.equal(await run(deviceId, { ...services, recordAudit: async event => event.phase !== "RESULT" }), "UNKNOWN"); checks++;
  assert.equal(await run(deviceId, { ...services, compareBoundCredential: async () => "UNTRUSTED" }), "UNKNOWN"); checks++;
  const beforeErrorAudit = audit.length;
  assert.equal(await run(deviceId, { ...services, compareBoundCredential: async () => { throw new Error(credential); } }), "UNKNOWN"); checks++;
  assert.equal(audit.at(-1).phase, "ERROR"); checks++;
  assert.equal(JSON.stringify(audit.slice(beforeErrorAudit)).includes(credential), false); checks++;
  let approvalChecks = 0;
  assert.equal(await run(deviceId, { ...services, confirmApprovalActive: async () => ++approvalChecks === 1 }), "UNKNOWN"); checks++;
  assert.equal(approvalChecks, 2); checks++;
  const beforeExpiry = credentialReads;
  assert.equal(await run(deviceId, { ...services, now: (() => { let calls = 0; return () => ++calls > 1 ? 1_030_000 : 1_000_000; })() }), "UNKNOWN"); checks++;
  assert.equal(credentialReads, beforeExpiry); checks++;
  const before = compareCalls;
  assert.equal(await run("00000000-0000-4000-8000-000000000000"), "UNKNOWN");
  assert.equal(compareCalls, before); checks++;
  assert.equal(await evaluateHomeLegacyMatch(null, services), "UNKNOWN"); checks++;
  assert.equal(await evaluateHomeLegacyMatch({ deviceId, requestId: "malformed" }, services), "UNKNOWN"); checks++;
  assert.equal(await evaluateHomeLegacyMatch({ deviceId }, null), "UNKNOWN"); checks++;
  assert.equal(expected.enrollmentId.length, 36); checks++;
}

console.log(`home legacy match service: ${checks}/${checks} synthetic checks PASS`);
