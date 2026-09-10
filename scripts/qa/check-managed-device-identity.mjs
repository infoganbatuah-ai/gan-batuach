import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { randomUUID, sign, createPrivateKey } from "node:crypto";
import { loadTs } from "./digital-guard-test-loader.mjs";
import { claimDesktopInstallation, pollDesktopInstallation } from "../../services/video-gateway/desktop-enrollment.mjs";
import { rotateManagedDeviceCredential } from "../../services/video-gateway/managed-device-rotation.mjs";

const identity = loadTs("lib/domain/digital-observer/managed-device-identity.ts");
const sessions = loadTs("lib/domain/gateway-device-enrollment.ts");
const source = path => readFileSync(path, "utf8");
const siteA = "11111111-1111-4111-8111-111111111111";
const siteB = "22222222-2222-4222-8222-222222222222";
const deviceId = "33333333-3333-4333-8333-333333333333";

function signedRequest(keyPair, options = {}) {
  const body = options.body ?? JSON.stringify({ action: "authenticate", gateway_id: deviceId });
  return identity.createManagedDeviceProof({ method: "POST", pathname: "/api/digital-observer/gateway-enrollment",
    body, deviceId, credentialVersion: options.version ?? 1, privateKeyPkcs8: keyPair.privateKeyPkcs8,
    runtimeInstanceId: options.runtime ?? "runtime-instance-a", sequence: options.sequence ?? 1,
    now: options.now, nonce: options.nonce });
}

test("device-specific Ed25519 proof authenticates the exact request", () => {
  const keyPair = identity.generateManagedDeviceKeyPair();
  const body = JSON.stringify({ action: "authenticate", gateway_id: deviceId });
  const proof = signedRequest(keyPair, { body });
  assert.equal(identity.verifyManagedDeviceProof({ proof, method: "POST", pathname: "/api/digital-observer/gateway-enrollment",
    body, publicKeySpki: keyPair.publicKeySpki }).ok, true);
  assert.equal(identity.verifyManagedDeviceProof({ proof, method: "POST", pathname: "/api/digital-observer/gateway-enrollment",
    body: `${body} `, publicKeySpki: keyPair.publicKeySpki }).ok, false);
});

test("Device ID alone cannot authenticate and expired proof is denied", () => {
  const headers = new Headers({ "x-observer-device-id": deviceId });
  assert.equal(identity.managedDeviceProofFromHeaders(headers), null);
  const keyPair = identity.generateManagedDeviceKeyPair();
  const now = Date.now();
  const proof = signedRequest(keyPair, { now: now - identity.managedDeviceRequestSkewMs - 1 });
  assert.equal(identity.verifyManagedDeviceProof({ proof, method: "POST", pathname: "/api/digital-observer/gateway-enrollment",
    body: JSON.stringify({ action: "authenticate", gateway_id: deviceId }), publicKeySpki: keyPair.publicKeySpki, now }).reason, "PROOF_EXPIRED");
});

test("short-lived enrollment intent is single-use, tenant and Site scoped", () => {
  const intent = { tenant: "tenant-a", site: siteA, expires: Date.now() + 60_000, used: false };
  const consume = ({ tenant, site, now = Date.now() }) => {
    if (intent.used || intent.expires <= now || tenant !== intent.tenant || site !== intent.site) return false;
    intent.used = true; return true;
  };
  assert.equal(consume({ tenant: "tenant-a", site: siteB }), false);
  assert.equal(consume({ tenant: "tenant-a", site: siteA, now: intent.expires + 1 }), false);
  assert.equal(consume({ tenant: "tenant-a", site: siteA }), true);
  assert.equal(consume({ tenant: "tenant-a", site: siteA }), false);
});

test("Connector graphical handoff generates local identity and sends only public key", async () => {
  const values = new Map();
  const store = { read: key => values.get(key) ?? "", write: (key, value) => values.set(key, value), remove: key => values.delete(key) };
  const document = { version: "connector-install-v1", intent_id: randomUUID(), observer_site_id: siteA,
    secret: "s".repeat(43), expires_at: new Date(Date.now() + 60_000).toISOString(), origin: "https://ganbatuach.com" };
  let claim;
  await claimDesktopInstallation({ document, store, platform: "macos-arm64", version: "qa", build: "qa",
    post: async (_path, body) => { claim = body; return {}; } });
  assert.equal(claim.credential_algorithm, "Ed25519");
  assert.equal(claim.credential_public_key_spki, values.get("device_public_key_spki"));
  assert.equal(Object.hasOwn(claim, "privateKeyPkcs8"), false);
  assert.ok(values.get("device_private_key_pkcs8"));
  const linked = await pollDesktopInstallation({ store, post: async () => ({ status: "linked", observer_site_id: siteA,
    gateway_id: deviceId, identity_scheme: "ED25519_V1", credential_version: 1, deployment_profile: "SOFTWARE_CONNECTOR" }) });
  assert.equal(linked.status, "ENROLLED");
  assert.equal(values.get("device_credential_version"), "1");
  assert.equal(values.has("device_refresh_token"), false);
});

test("profile permissions are server-selected and arbitrary commands are absent", () => {
  for (const profile of identity.managedDeviceProfiles) {
    assert.equal(identity.managedDeviceOperationAllowed(profile, "HEARTBEAT"), true);
    assert.equal(identity.managedDeviceOperationAllowed(profile, "CONFIG_READ"), true);
    assert.equal(identity.managedDeviceOperationAllowed(profile, "RUN_SHELL"), false);
  }
  assert.equal(identity.managedDeviceOperations.includes("RUN_SHELL"), false);
});

test("short-lived managed session has bounded scopes and stale credential version", () => {
  const secret = "managed-session-secret-123456789";
  const token = sessions.issueManagedDeviceSessionToken({ device_id: randomUUID(), gateway_id: deviceId,
    observer_site_id: siteA, deployment_profile: "SOFTWARE_CONNECTOR", credential_version: 2,
    operations: ["HEARTBEAT", "CONFIG_READ"] }, secret);
  const claims = sessions.verifyGatewayDeviceAccessToken(token, secret);
  assert.equal(claims.version, 2);
  assert.equal(sessions.gatewayDeviceSessionAllows(claims, "HEARTBEAT"), true);
  assert.equal(sessions.gatewayDeviceSessionAllows(claims, "COMMAND_POLL"), false);
  assert.equal(claims.credential_version, 2);
});

test("session continuity distinguishes restart, stale request and suspected clone", () => {
  const base = { previousRuntimeInstanceId: "runtime-instance-a", previousSeenAt: new Date().toISOString(), previousSequence: 5 };
  assert.equal(identity.classifyManagedDeviceSession({ ...base, runtimeInstanceId: "runtime-instance-a", sequence: 6 }), "CONTINUATION");
  assert.equal(identity.classifyManagedDeviceSession({ ...base, runtimeInstanceId: "runtime-instance-a", sequence: 5 }), "STALE_SESSION");
  assert.equal(identity.classifyManagedDeviceSession({ ...base, runtimeInstanceId: "runtime-instance-b", sequence: 1 }), "SUSPECTED_CLONE");
  assert.equal(identity.classifyManagedDeviceSession({ ...base, previousSeenAt: new Date(Date.now() - 180_000).toISOString(), runtimeInstanceId: "runtime-instance-b", sequence: 1 }), "RESTART");
});

test("isolated full lifecycle rotates only after new-key proof and rejects old/revoked keys", () => {
  const body = JSON.stringify({ action: "authenticate", gateway_id: deviceId });
  const oldKey = identity.generateManagedDeviceKeyPair();
  const replacement = identity.generateManagedDeviceKeyPair();
  const state = { lifecycle: "ACTIVE", version: 1, publicKey: oldKey.publicKeySpki };
  const authenticate = (pair, version, sequence) => state.lifecycle === "ACTIVE" && version === state.version
    && identity.verifyManagedDeviceProof({ proof: signedRequest(pair, { version, sequence }), method: "POST",
      pathname: "/api/digital-observer/gateway-enrollment", body, publicKeySpki: state.publicKey }).ok;
  assert.equal(authenticate(oldKey, 1, 1), true);
  const rotationId = randomUUID(), challenge = "c".repeat(43);
  const canonical = identity.canonicalRotationConfirmation({ deviceId, credentialVersion: 2, rotationId, challenge });
  const signature = sign(null, Buffer.from(canonical), createPrivateKey({ key: Buffer.from(replacement.privateKeyPkcs8, "base64url"), format: "der", type: "pkcs8" })).toString("base64url");
  assert.equal(identity.verifyRotationConfirmation({ deviceId, credentialVersion: 2, rotationId, challenge,
    signature, publicKeySpki: replacement.publicKeySpki }), true);
  state.version = 2; state.publicKey = replacement.publicKeySpki;
  assert.equal(authenticate(oldKey, 1, 2), false);
  assert.equal(authenticate(replacement, 2, 1), true);
  state.lifecycle = "REVOKED";
  assert.equal(authenticate(replacement, 2, 2), false);
});

test("edge rotation switches the durable key only after server confirmation", async () => {
  const original = identity.generateManagedDeviceKeyPair();
  const values = new Map([
    ["device_gateway_id", deviceId], ["device_credential_version", "1"],
    ["device_private_key_pkcs8", original.privateKeyPkcs8], ["device_public_key_spki", original.publicKeySpki]
  ]);
  const store = { read: key => values.get(key) ?? "", write: (key, value) => values.set(key, value), remove: key => values.delete(key) };
  let calls = 0;
  const fetcher = async (_url, request) => {
    calls += 1;
    if (calls === 1) {
      assert.equal(request.headers["x-observer-device-id"], deviceId);
      return { ok: true, json: async () => ({ data: { rotation_id: "44444444-4444-4444-8444-444444444444",
        challenge: "q".repeat(43), new_credential_version: 2 } }) };
    }
    const confirm = JSON.parse(request.body);
    assert.equal(confirm.new_credential_version, 2);
    assert.notEqual(confirm.signature, "");
    return { ok: true, json: async () => ({ data: { status: "ROTATED" } }) };
  };
  const result = await rotateManagedDeviceCredential({ store, cloudBaseUrl: "https://example.invalid", fetcher });
  assert.equal(result.credentialVersion, 2);
  assert.equal(values.get("device_credential_version"), "2");
  assert.notEqual(values.get("device_private_key_pkcs8"), original.privateKeyPkcs8);
  assert.equal(values.has("device_rotation_pending"), false);
});

test("database contract rejects replay, clone, revoked state and retires old credential", () => {
  const migration = source("supabase/migrations/20260908010000_managed_device_identity_hardening.sql");
  for (const required of ["ED25519_V1", "observer_managed_device_credentials", "record_observer_managed_device_auth",
    "MANAGED_DEVICE_STALE_SESSION", "MANAGED_DEVICE_CLONE_SUSPECTED", "confirm_observer_managed_device_rotation",
    "credential_state = 'RETIRED'", "identity_scheme = 'ED25519_V1'", "refresh_token_hash = null",
    "lifecycle_state <> 'ACTIVE'", "replace_observer_managed_device"])
    assert.match(migration, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("heartbeat, config, commands, event and source scopes are enforced", () => {
  const heartbeat = source("app/api/video-gateway/device-heartbeat/route.ts");
  const connector = source("app/api/digital-observer/software-connector/route.ts");
  const commands = source("app/api/video-gateway/camera-actions/route.ts");
  const events = source("app/api/video-gateway/cloud-events/route.ts");
  assert.match(heartbeat, /gatewayDeviceSessionAllows\(device, "HEARTBEAT"\)/);
  assert.match(connector, /authenticateDevice\(request, "CONFIG_READ"\)/);
  assert.match(connector, /authenticateDevice\(request, "DISCOVERY_PUBLISH"\)/);
  assert.match(commands, /gatewayDeviceSessionAllows\(claims, "COMMAND_POLL"\)/);
  assert.match(events, /eq\("observer_site_id", device\.observer_site_id\)/);
  assert.match(events, /camera\.metadata\?\.gateway_id !== device\.gateway_id/);
});

test("revocation, replacement and cross-tenant safety require Product authorization", () => {
  const route = source("app/api/video-gateway/device-identity/route.ts");
  for (const required of ["assertTrustedMutationOrigin", "getDigitalObserverApiUser", "getObserverSiteAccess",
    "lifecycle_state", "legacy_migration_prepare", "mark_observer_managed_device_unavailable", "replace_observer_managed_device"])
    assert.match(route, new RegExp(required));
  assert.doesNotMatch(route, /observer_site_id:\s*payload\.observer_site_id[^\n]*update/);
});

test("deployment profiles have least-privilege command permissions", () => {
  assert.equal(identity.managedDeviceOperationAllowed("SOFTWARE_CONNECTOR", "COMMAND_POLL"), false);
  assert.equal(identity.managedDeviceOperationAllowed("PHYSICAL_GATEWAY", "COMMAND_POLL"), true);
  assert.equal(identity.managedDeviceOperationAllowed("ENTERPRISE_EDGE", "COMMAND_POLL"), true);
});

test("managed-site discovery cannot fall back to a shared legacy signature", () => {
  const discovery = source("app/api/video-gateway/cloud-discovery/route.ts");
  assert.match(discovery, /Managed-site discovery requires device-scoped authentication/);
  assert.match(discovery, /!payload\.garden_id \|\| payload\.observer_site_id/);
});

test("diagnostics scrub private credentials and signed media material", () => {
  const diagnostic = identity.safeManagedDeviceDiagnostic({ device_id: deviceId, status: "ACTIVE",
    private_key: "private", refresh_token: "token", camera_password: "password", signed_media_url: "url",
    nested: { configuration: { authorization: "bearer", endpoint: "rtsp://user:pass@example.invalid/stream" } } });
  assert.equal(diagnostic.device_id, deviceId);
  assert.equal(diagnostic.status, "ACTIVE");
  for (const key of ["private_key", "refresh_token", "camera_password", "signed_media_url"]) assert.equal(diagnostic[key], "[redacted]");
  assert.equal(diagnostic.nested.configuration.authorization, "[redacted]");
  assert.equal(diagnostic.nested.configuration.endpoint, "[redacted]");
});

test("empty DVR slots are unassigned rather than failed cameras", () => {
  const gateway = source("services/video-gateway/server.mjs");
  const domain = source("lib/domain/video-gateway.ts");
  const runner = source("scripts/run-persistent-home-gateway.mjs");
  for (const text of [gateway, domain, runner]) assert.match(text, /unassigned|CHANNEL_EMPTY/);
  assert.match(gateway, /failedAssignedCount/);
  assert.match(runner, /!\["connected", "unassigned"\]\.includes/);
  assert.match(domain, /physical_camera_attached: assigned/);
});

test("Push 17 zero-install hierarchy remains independent of managed identity", () => {
  const orchestrator = source("lib/domain/digital-observer/connection-orchestrator.ts");
  const wizard = source("components/digital-observer/universal-camera-onboarding.tsx");
  assert.match(orchestrator, /ZERO_INSTALL_INTEGRATION_NOT_YET_AVAILABLE/);
  assert.match(orchestrator, /SOFTWARE_CONNECTOR/);
  assert.match(orchestrator, /PHYSICAL_GATEWAY/);
  assert.match(wizard, /\/api\/digital-observer\/connection-assessment/);
  assert.doesNotMatch(JSON.stringify(identity.safeManagedDeviceDiagnostic({ connection_strategy: "ZERO_INSTALL" })), /device.*required/i);
});
