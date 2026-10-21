import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { evaluateHomeLegacyMatch, HOME_LEGACY_MATCH_DEVICES, HOME_LEGACY_MATCH_SITE_ID } from "../../services/video-gateway/home-legacy-match-service.mjs";

const tenantId = "52d9848d-4977-493c-a321-e45fb812d0a3";
const credential = "synthetic-legacy-credential-for-isolated-qa-only-123456";
let checks = 0;

for (const [deviceId, deploymentProfile] of Object.entries(HOME_LEGACY_MATCH_DEVICES)) {
  const expected = { id: crypto.randomUUID(), gateway_id: deviceId,
    observer_site_id: HOME_LEGACY_MATCH_SITE_ID, tenant_id: tenantId,
    deployment_profile: deploymentProfile, config_version: 1 };
  const row = { ...expected, status: "delivered", lifecycle_state: "ACTIVE",
    identity_scheme: "LEGACY_HMAC", refresh_token_hash: createHash("sha256").update(credential).digest("hex") };
  let compareCalls = 0;
  const audit = [];
  const services = {
    now: () => 1_000_000,
    authorizeAdministrator: async () => ({ authenticated: true, role: "platform_admin",
      purpose: "HOME_TELEMETRY_LEGACY_MATCH", deviceId, siteId: HOME_LEGACY_MATCH_SITE_ID,
      tenantId, actorId: "synthetic-admin", approvalId: "synthetic-approval", expiresAt: 1_030_000 }),
    resolveApprovedBinding: async () => ({ deviceId, enrollmentId: expected.id,
      siteId: HOME_LEGACY_MATCH_SITE_ID, tenantId, deploymentProfile, configVersion: 1 }),
    consumeAttempt: async () => true,
    loadScopedRows: async binding => {
      compareCalls++;
      assert.deepEqual(binding, { deviceId, enrollmentId: expected.id, siteId: HOME_LEGACY_MATCH_SITE_ID,
        tenantId, deploymentProfile, configVersion: 1 });
      return [row];
    },
    loadProtectedCredential: async () => credential,
    recordAudit: async event => { audit.push(event); return true; }
  };
  const run = (id = deviceId, dependencies = services) => evaluateHomeLegacyMatch({ deviceId: id }, dependencies);
  assert.equal(await run(), "MATCH"); checks++;
  assert.equal(audit.length, 1); checks++;
  assert.equal(Object.values(audit[0]).some(value => value === credential || value === row.refresh_token_hash), false); checks++;
  assert.equal(await run(deviceId, { ...services, loadProtectedCredential: async () => credential + "wrong" }), "MISMATCH"); checks++;
  for (const change of [
    { authorizeAdministrator: async () => ({ ...await services.authorizeAdministrator(), tenantId: "wrong-tenant" }) },
    { authorizeAdministrator: async () => ({ ...await services.authorizeAdministrator(), siteId: "wrong-site" }) },
    { authorizeAdministrator: async () => ({ ...await services.authorizeAdministrator(), role: "VIEWER" }) },
    { authorizeAdministrator: async () => ({ ...await services.authorizeAdministrator(), deviceId: "wrong-device" }) },
    { authorizeAdministrator: async () => ({ ...await services.authorizeAdministrator(), expiresAt: 1_000_000 }) },
    { resolveApprovedBinding: async () => ({ ...await services.resolveApprovedBinding(), enrollmentId: "" }) },
    { consumeAttempt: async () => false },
    { recordAudit: async () => false }
  ]) {
    const before = compareCalls;
    assert.equal(await run(deviceId, { ...services, ...change }), "UNKNOWN");
    if (!Object.hasOwn(change, "recordAudit")) assert.equal(compareCalls, before);
    checks++;
  }
  const before = compareCalls;
  assert.equal(await run("00000000-0000-4000-8000-000000000000"), "UNKNOWN");
  assert.equal(compareCalls, before); checks++;
  assert.equal(await evaluateHomeLegacyMatch(null, services), "UNKNOWN"); checks++;
  assert.equal(await evaluateHomeLegacyMatch({ deviceId }, null), "UNKNOWN"); checks++;
  assert.equal(await run(deviceId, { ...services, loadScopedRows: async () => [{ ...row, tenant_id: "wrong-tenant" }] }), "UNKNOWN"); checks++;
  assert.equal(await run(deviceId, { ...services, loadScopedRows: async () => [row, row] }), "UNKNOWN"); checks++;
}

console.log(`home legacy match service: ${checks}/${checks} synthetic checks PASS`);
