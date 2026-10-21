import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHomeLegacyAdminVerifier } from "../../services/video-gateway/home-legacy-admin-verifier.mjs";
import { bindHomeLegacyApproval, openHomeLegacyApprovalStore } from "../../services/video-gateway/home-legacy-approval-store.mjs";
import { evaluateHomeLegacyMatch, HOME_LEGACY_MATCH_DEVICES, HOME_LEGACY_MATCH_SITE_ID } from "../../services/video-gateway/home-legacy-match-service.mjs";

const dir = mkdtempSync(join(tmpdir(), "home-legacy-approval-"));
const path = join(dir, "approval.sqlite");
const deviceId = Object.keys(HOME_LEGACY_MATCH_DEVICES)[0];
const secondDevice = Object.keys(HOME_LEGACY_MATCH_DEVICES)[1];
const actorId = randomUUID(), tenantId = randomUUID(), enrollmentId = randomUUID();
const token = "synthetic-admin-session-token-not-production";
let at = 1_000_000, checks = 0, credentialReads = 0;
const user = { id: actorId, app_metadata: { digital_observer_admin: true } };
const profile = { id: actorId, active: true, role: "admin" };
const verifier = createHomeLegacyAdminVerifier({ getUser: async value => value === token ? user : null,
  getProfile: async () => profile });
let store;
try {
  store = openHomeLegacyApprovalStore({ path, verifyAdministrator: verifier, now: () => at });
  const issue = (id = deviceId) => store.issueApproval({ accessToken: token, deviceId: id,
    tenantId, purpose: "HOME_TELEMETRY_LEGACY_MATCH", ttlMs: 60_000 });
  assert.equal((await verifier(token))?.actorId, actorId); checks++;
  assert.equal(await verifier("bad"), null); checks++;
  assert.equal(await createHomeLegacyAdminVerifier({ getUser: async () => ({ ...user, app_metadata: {} }),
    getProfile: async () => profile })(token), null); checks++;
  assert.equal(await createHomeLegacyAdminVerifier({ getUser: async () => user,
    getProfile: async () => ({ ...profile, active: false }) })(token), null); checks++;
  assert.equal(await createHomeLegacyAdminVerifier({ getUser: async () => user,
    getProfile: async () => ({ ...profile, role: "viewer" }) })(token), null); checks++;
  assert.equal(await store.issueApproval({ accessToken: "bad", deviceId, tenantId,
    purpose: "HOME_TELEMETRY_LEGACY_MATCH" }), null); checks++;
  assert.equal(await store.issueApproval({ accessToken: token, deviceId: randomUUID(), tenantId,
    purpose: "HOME_TELEMETRY_LEGACY_MATCH" }), null); checks++;
  assert.equal(await store.issueApproval({ accessToken: token, deviceId, tenantId, purpose: "OTHER" }), null); checks++;
  assert.equal(await store.issueApproval({ accessToken: token, deviceId, tenantId,
    purpose: "HOME_TELEMETRY_LEGACY_MATCH", ttlMs: 300_001 }), null); checks++;

  const first = await issue();
  assert.equal(typeof first?.approvalId, "string"); checks++;
  assert.equal((await store.authorizeAdministrator(first.approvalId, deviceId, token))?.actorId, actorId); checks++;
  assert.equal(await store.authorizeAdministrator(first.approvalId, secondDevice, token), null); checks++;
  assert.equal(await store.authorizeAdministrator(first.approvalId, deviceId, "bad"), null); checks++;
  const request = randomUUID();
  const scope = { approvalId: first.approvalId, deviceId, tenantId, actorId,
    siteId: HOME_LEGACY_MATCH_SITE_ID, requestId: request, maxAttempts: 2 };
  assert.equal(await store.consumeAttempt({ ...scope, tenantId: randomUUID() }), false); checks++;
  assert.deepEqual(await Promise.all([store.consumeAttempt(scope), store.consumeAttempt(scope)]).then(x => x.sort()), [false, true]); checks++;
  assert.equal(await store.consumeAttempt({ ...scope, requestId: randomUUID() }), true); checks++;
  assert.equal(await store.consumeAttempt({ ...scope, requestId: randomUUID() }), false); checks++;
  const competingStore = openHomeLegacyApprovalStore({ path, verifyAdministrator: verifier, now: () => at });
  assert.equal(await competingStore.consumeAttempt({ ...scope, requestId: randomUUID() }), false); checks++;
  competingStore.close();
  assert.equal(await store.confirmApprovalActive({ ...scope, actorId: randomUUID() }, token), false); checks++;
  assert.equal(await store.confirmApprovalActive(scope, token), true); checks++;
  assert.equal(await store.revokeApproval(first.approvalId, "bad"), false); checks++;
  assert.equal(await store.revokeApproval(first.approvalId, token), true); checks++;
  assert.equal(await store.confirmApprovalActive(scope, token), false); checks++;
  assert.equal(await store.consumeAttempt({ ...scope, requestId: randomUUID() }), false); checks++;

  const second = await issue(secondDevice);
  at = second.expiresAt;
  assert.equal(await store.authorizeAdministrator(second.approvalId, secondDevice, token), null); checks++;
  at = 1_000_000;
  const approved = await issue();
  const reader = {
    resolveApprovedBinding: async () => ({ deviceId, siteId: HOME_LEGACY_MATCH_SITE_ID,
      tenantId, enrollmentId, deploymentProfile: HOME_LEGACY_MATCH_DEVICES[deviceId], configVersion: 1 }),
    loadScopedRows: async () => [{ id: enrollmentId, gateway_id: deviceId,
      observer_site_id: HOME_LEGACY_MATCH_SITE_ID, tenant_id: tenantId,
      deployment_profile: HOME_LEGACY_MATCH_DEVICES[deviceId], config_version: 1,
      status: "delivered", lifecycle_state: "ACTIVE", identity_scheme: "LEGACY_HMAC",
      refresh_token_hash: "0".repeat(64) }]
  };
  const dependencies = bindHomeLegacyApproval({ store, approvalId: approved.approvalId,
    deviceId, accessToken: token, reader, now: () => at,
    loadProtectedCredential: async () => { credentialReads++; return "synthetic-credential-over-32-characters"; } });
  user.app_metadata.digital_observer_admin = false;
  assert.equal(await evaluateHomeLegacyMatch({ deviceId, requestId: randomUUID() }, dependencies), "UNKNOWN"); checks++;
  assert.equal(credentialReads, 0); checks++;
  user.app_metadata.digital_observer_admin = true;
  assert.equal(await evaluateHomeLegacyMatch({ deviceId, requestId: randomUUID() }, dependencies), "MISMATCH"); checks++;
  const beforeReplay = credentialReads, replayId = randomUUID();
  assert.equal(await evaluateHomeLegacyMatch({ deviceId, requestId: replayId }, dependencies), "MISMATCH"); checks++;
  assert.equal(await evaluateHomeLegacyMatch({ deviceId, requestId: replayId }, dependencies), "UNKNOWN"); checks++;
  assert.equal(credentialReads, beforeReplay + 1); checks++;
  const inspector = new DatabaseSync(path);
  assert.equal(inspector.prepare("select count(*) as n from audit where phase='RESULT'").get().n, 2); checks++;
  assert.equal(inspector.prepare("select count(*) as n from audit where phase='DENIED'").get().n, 2); checks++;
  await assert.rejects(async () => inspector.exec("delete from audit"), /AUDIT_APPEND_ONLY/); checks++;
  await assert.rejects(async () => inspector.exec("update audit set phase='RESULT'"), /AUDIT_APPEND_ONLY/); checks++;
  assert.equal(inspector.prepare("select count(*) as n from attempts where approval_id=?").get(approved.approvalId).n, 2); checks++;
  inspector.close();
  store.close(); store = null;
  const reopened = openHomeLegacyApprovalStore({ path, verifyAdministrator: verifier, now: () => at });
  assert.equal(await reopened.consumeAttempt({ ...scope, approvalId: approved.approvalId, requestId: randomUUID() }), false); checks++;
  reopened.close();
} finally {
  store?.close();
  rmSync(dir, { recursive: true, force: true });
}
console.log(`home legacy approval store: ${checks}/${checks} isolated checks PASS`);
