import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PGlite } from "@electric-sql/pglite";
import { createHomeLegacyAdminVerifier } from "../../services/video-gateway/home-legacy-admin-verifier.mjs";
import { openHomeLegacyApprovalStore } from "../../services/video-gateway/home-legacy-approval-store.mjs";
import { createHomeLegacyPrivateExecutor } from "../../services/video-gateway/home-legacy-private-executor.mjs";
import { createHomeLegacyKeychainCredentialSource } from "../../services/video-gateway/home-legacy-keychain-source.mjs";
import { createHomeLegacyScopedReader } from "../../services/video-gateway/home-legacy-scoped-reader.mjs";
import { HOME_LEGACY_MATCH_BINDINGS } from "../../services/video-gateway/home-legacy-match-service.mjs";

const db = new PGlite();
const dir = mkdtempSync(join(tmpdir(), "home-legacy-private-executor-"));
const bindings = Object.values(HOME_LEGACY_MATCH_BINDINGS);
const tokens = ["synthetic-gateway-credential-over-32-characters",
  "synthetic-connector-credential-over-32-characters"];
const actorId = randomUUID(), adminToken = "synthetic-admin-token-over-32-characters";
let now = 1_000_000, checks = 0, queryCalls = 0, credentialReads = 0;
const maps = bindings.map((binding, index) => ({
  device_gateway_id: binding.deviceId,
  device_observer_site_id: binding.siteId,
  device_cloud_base_url: "https://gan-batuach.vercel.app/",
  device_credential_version: "",
  device_public_key_spki: "",
  device_refresh_token: tokens[index]
}));
const syntheticStore = map => ({ kind: "macos_keychain", read(account) {
  if (account === "device_refresh_token") credentialReads++;
  return map[account] ?? "";
} });
let approvalStore;
try {
  await db.exec(`create table public.video_gateway_device_enrollments (
      id uuid primary key, gateway_id uuid, observer_site_id uuid, tenant_id uuid,
      deployment_profile text, config_version integer, status text,
      lifecycle_state text, identity_scheme text, refresh_token_hash text);
    create table public.synthetic_side_effects (id integer);
    create function public.synthetic_unsafe_notify() returns void
      language plpgsql volatile security definer set search_path=pg_catalog as $$
      begin insert into public.synthetic_side_effects values (1); end $$;`);
  for (const [index, binding] of bindings.entries()) {
    await db.query(`insert into public.video_gateway_device_enrollments values
      ($1,$2,$3,$4,$5,$6,'delivered','ACTIVE','LEGACY_HMAC',$7)`,
    [binding.enrollmentId, binding.deviceId, binding.siteId, binding.tenantId,
      binding.deploymentProfile, binding.configVersion,
      createHash("sha256").update(tokens[index]).digest("hex")]);
  }
  const before = (await db.query("select * from public.video_gateway_device_enrollments order by id")).rows;
  const verifyAdministrator = createHomeLegacyAdminVerifier({
    getUser: async token => token === adminToken ? { id: actorId,
      app_metadata: { digital_observer_admin: true } } : null,
    getProfile: async () => ({ id: actorId, active: true, role: "admin" })
  });
  approvalStore = openHomeLegacyApprovalStore({ path: join(dir, "approval.sqlite"),
    verifyAdministrator, now: () => now });
  const loadProtectedCredential = createHomeLegacyKeychainCredentialSource({
    gatewayStore: syntheticStore(maps[0]), connectorStore: syntheticStore(maps[1]) });
  const comparator = createHomeLegacyScopedReader({
    query: (sql, values) => {
      queryCalls++;
      assert.match(sql, /^select id, gateway_id, observer_site_id, tenant_id,/);
      assert.doesNotMatch(sql, /synthetic_unsafe_notify|\brefresh\s*\(/i);
      assert.equal(values.length, 4);
      return db.query(sql, values);
    }, loadProtectedCredential
  });
  const executor = createHomeLegacyPrivateExecutor({ approvalStore, comparator, now: () => now });
  assert.deepEqual(Object.keys(executor), ["compare"]); checks++;
  assert.deepEqual(Object.keys(comparator), ["compareBoundCredential"]); checks++;
  const issue = binding => approvalStore.issueApproval({ accessToken: adminToken,
    deviceId: binding.deviceId, tenantId: binding.tenantId,
    purpose: "HOME_TELEMETRY_LEGACY_MATCH", ttlMs: 60_000 });
  const compare = (binding, approvalId, requestId = randomUUID(), overrides = {}) => executor.compare({
    deviceId: binding.deviceId, approvalId, requestId,
    administratorToken: adminToken, ...overrides
  });
  for (const binding of bindings) {
    const approval = await issue(binding);
    assert.equal(typeof approval?.approvalId, "string"); checks++;
    assert.equal(await compare(binding, approval.approvalId), "MATCH"); checks++;
    const replayId = randomUUID();
    assert.equal(await compare(binding, approval.approvalId, replayId), "MATCH"); checks++;
    const beforeReplay = queryCalls;
    assert.equal(await compare(binding, approval.approvalId, replayId), "UNKNOWN"); checks++;
    assert.equal(queryCalls, beforeReplay); checks++;
    assert.equal(await compare(binding, approval.approvalId), "UNKNOWN"); checks++;
    assert.equal(await approvalStore.revokeApproval(approval.approvalId, adminToken), true); checks++;
    assert.equal(await compare(binding, approval.approvalId), "UNKNOWN"); checks++;
  }
  const gateway = bindings[0], connector = bindings[1];
  assert.equal(await approvalStore.issueApproval({ accessToken: adminToken, deviceId: gateway.deviceId,
    tenantId: randomUUID(), purpose: "HOME_TELEMETRY_LEGACY_MATCH" }), null); checks++;
  const approval = await issue(gateway);
  const deniedInputs = [
    { deviceId: connector.deviceId }, { deviceId: randomUUID() },
    { administratorToken: "wrong" }, { injectedSql: "select *" }
  ];
  for (const override of deniedInputs) {
    const beforeDenied = credentialReads;
    assert.equal(await compare(gateway, approval.approvalId, randomUUID(), override), "UNKNOWN"); checks++;
    assert.equal(credentialReads, beforeDenied); checks++;
  }
  maps[0].device_observer_site_id = randomUUID();
  assert.equal(await compare(gateway, (await issue(gateway)).approvalId), "UNKNOWN"); checks++;
  maps[0].device_observer_site_id = gateway.siteId;
  maps[0].device_gateway_id = connector.deviceId;
  assert.equal(await compare(gateway, (await issue(gateway)).approvalId), "UNKNOWN"); checks++;
  maps[0].device_gateway_id = gateway.deviceId;
  maps[0].device_cloud_base_url = "https://127.0.0.1:3101/";
  assert.equal(await compare(gateway, (await issue(gateway)).approvalId), "UNKNOWN"); checks++;
  maps[0].device_cloud_base_url = "https://gan-batuach.vercel.app/";
  maps[0].device_credential_version = "1";
  assert.equal(await compare(gateway, (await issue(gateway)).approvalId), "UNKNOWN"); checks++;
  maps[0].device_credential_version = "";
  await db.query("update public.video_gateway_device_enrollments set tenant_id=$1 where id=$2",
    [randomUUID(), gateway.enrollmentId]);
  assert.equal(await compare(gateway, (await issue(gateway)).approvalId), "UNKNOWN"); checks++;
  await db.query("update public.video_gateway_device_enrollments set tenant_id=$1 where id=$2",
    [gateway.tenantId, gateway.enrollmentId]);
  await db.query("update public.video_gateway_device_enrollments set observer_site_id=$1 where id=$2",
    [randomUUID(), gateway.enrollmentId]);
  assert.equal(await compare(gateway, (await issue(gateway)).approvalId), "UNKNOWN"); checks++;
  await db.query("update public.video_gateway_device_enrollments set observer_site_id=$1 where id=$2",
    [gateway.siteId, gateway.enrollmentId]);
  const beforeEnrollment = queryCalls;
  await db.query("update public.video_gateway_device_enrollments set id=$1 where id=$2",
    [randomUUID(), gateway.enrollmentId]);
  assert.equal(await compare(gateway, (await issue(gateway)).approvalId), "UNKNOWN"); checks++;
  assert.equal(queryCalls, beforeEnrollment + 1); checks++;
  await db.query("update public.video_gateway_device_enrollments set id=$1 where gateway_id=$2",
    [gateway.enrollmentId, gateway.deviceId]);
  const expiring = await issue(gateway);
  now += 60_001;
  assert.equal(await compare(gateway, expiring.approvalId), "UNKNOWN"); checks++;
  const another = await issue(gateway);
  maps[0].device_refresh_token = tokens[0] + "-wrong";
  assert.equal(await compare(gateway, another.approvalId), "MISMATCH"); checks++;
  assert.equal(await approvalStore.revokeApproval(another.approvalId, adminToken), true); checks++;
  assert.equal(await compare(gateway, another.approvalId), "UNKNOWN"); checks++;
  assert.deepEqual((await db.query("select * from public.video_gateway_device_enrollments order by id")).rows, before); checks++;
  assert.equal((await db.query("select count(*)::int n from public.synthetic_side_effects")).rows[0].n, 0); checks++;
  const auditReader = new DatabaseSync(join(dir, "approval.sqlite"));
  try {
    const auditText = JSON.stringify(auditReader.prepare("select * from audit").all());
    assert.equal(tokens.some(token => auditText.includes(token)), false); checks++;
    assert.equal(before.some(row => auditText.includes(row.refresh_token_hash)), false); checks++;
    assert.equal(auditReader.prepare("select count(*) n from audit where phase='RESULT'").get().n > 0, true); checks++;
  } finally { auditReader.close(); }
} finally {
  approvalStore?.close();
  await db.close();
  rmSync(dir, { recursive: true, force: true });
}
console.log(`home legacy private executor: ${checks}/${checks} isolated checks PASS`);
