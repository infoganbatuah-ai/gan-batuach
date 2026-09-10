import assert from "node:assert/strict";
import { createPrivateKey, randomBytes, randomUUID, sign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { hostname } from "node:os";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { createManagedDeviceProofHeaders, generateManagedDeviceKeyPair } from "../../services/video-gateway/managed-device-auth.mjs";

const [originValue, siteId] = process.argv.slice(2);
const origin = new URL(originValue);
assert.equal(origin.origin, "https://ganbatuach.com", "Exact Production origin required");
assert.match(siteId || "", /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i, "Valid site ID required");

const allowed = new Set(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "QA_DEMO_DIGITAL_OBSERVER_HOME_EMAIL", "QA_DEMO_DIGITAL_OBSERVER_HOME_PASSWORD", "QA_DEMO_DIGITAL_OBSERVER_PASSWORD"]);
const config = {};
for (const file of [".env.qa-demo.local", ".env.local"]) {
  if (!existsSync(file)) continue;
  const values = parseEnv(readFileSync(file, "utf8"));
  for (const key of allowed) if (!config[key] && values[key]) config[key] = values[key];
}
const publicKey = config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || config.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const homeEmail = config.QA_DEMO_DIGITAL_OBSERVER_HOME_EMAIL || "qa.digital.observer.home@demo.ganbatuach.com";
const password = config.QA_DEMO_DIGITAL_OBSERVER_HOME_PASSWORD || config.QA_DEMO_DIGITAL_OBSERVER_PASSWORD;
assert.ok(config.NEXT_PUBLIC_SUPABASE_URL && publicKey && password, "Authorized home Production QA configuration is missing");
const client = createClient(config.NEXT_PUBLIC_SUPABASE_URL, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
const login = await client.auth.signInWithPassword({ email: homeEmail, password });
assert.ok(!login.error && login.data.session, "Authorized home Production authentication failed");
const authorization = `Bearer ${login.data.session.access_token}`;

async function call(path, body, headers = {}) {
  const response = await fetch(new URL(path, origin), { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(30_000) });
  return { response, body: await response.json().catch(() => ({})) };
}

let gatewayId = "";
let accessToken = "";
let enrollmentId = "";
try {
  const installationId = `edge-prod-qa-${randomUUID()}`;
  const keyPair = generateManagedDeviceKeyPair();
  const created = await call("/api/digital-observer/gateway-enrollment", { action: "create_request", device_name: `Push 18 QA ${hostname()}`.slice(0, 80), device_platform: "production-qa", device_fingerprint: randomBytes(32).toString("hex"), device_type: "SOFTWARE_CONNECTOR", installation_id: installationId, software_version: "push18-qa", build_sha: "production-verification", credential_algorithm: "Ed25519", credential_public_key_spki: keyPair.publicKeySpki });
  assert.equal(created.response.status, 201, `Connector enrollment request failed with HTTP ${created.response.status}`);
  enrollmentId = created.body.data?.enrollment_request_id;
  const pollToken = created.body.data?.poll_token;
  assert.ok(enrollmentId && pollToken, "Connector enrollment request did not return private poll material");

  const approved = await call("/api/digital-observer/gateway-enrollment", { action: "approve", enrollment_request_id: enrollmentId, observer_site_id: siteId }, { authorization });
  assert.equal(approved.response.status, 200, `Connector approval failed with HTTP ${approved.response.status}`);

  const linked = await call("/api/digital-observer/gateway-enrollment", { action: "poll", enrollment_request_id: enrollmentId, poll_token: pollToken });
  assert.equal(linked.response.status, 200, `Connector identity delivery failed with HTTP ${linked.response.status}`);
  assert.equal(linked.body.data?.status, "linked");
  gatewayId = linked.body.data.gateway_id;
  assert.equal(linked.body.data.identity_scheme, "ED25519_V1");
  const runtimeInstanceId = `production-qa:${randomUUID()}`;
  let sequence = 0;
  const authenticate = async (pair, version, runtime = runtimeInstanceId) => {
    const body = { action: "authenticate", gateway_id: gatewayId };
    const raw = JSON.stringify(body), path = "/api/digital-observer/gateway-enrollment";
    return call(path, body, createManagedDeviceProofHeaders({ method: "POST", pathname: path, body: raw,
      deviceId: gatewayId, credentialVersion: version, privateKeyPkcs8: pair.privateKeyPkcs8,
      runtimeInstanceId: runtime, sequence: ++sequence }));
  };
  const authenticated = await authenticate(keyPair, 1);
  assert.equal(authenticated.response.status, 200, "Ed25519 device authentication failed");
  accessToken = authenticated.body.data.access_token;

  const heartbeatPayload = { heartbeat_id: `heartbeat-${randomUUID()}`, gateway_id: gatewayId, observer_site_id: siteId, observed_at: new Date().toISOString(), runtime: { contract: "observer-edge-runtime-v1", device_type: "SOFTWARE_CONNECTOR", installation_id: installationId, software_version: "push16-qa", build_sha: "production-verification", outbound_only: true, arbitrary_shell_commands: false }, health: { status: "HEALTHY", uptime_seconds: 1, cpu_percent: 1, memory_mb: 64, disk_free_mb: 1024, camera_count: 0, streaming_count: 0, last_frame_at: null, error_codes: [] } };
  const heartbeat = await call("/api/video-gateway/device-heartbeat", heartbeatPayload, { "x-video-gateway-device-token": accessToken, "x-video-gateway-id": gatewayId });
  assert.equal(heartbeat.response.status, 200, `Connector heartbeat failed with HTTP ${heartbeat.response.status}`);
  assert.equal(heartbeat.body.data?.device_type, "SOFTWARE_CONNECTOR");
  assert.equal(heartbeat.body.data?.commands?.length, 0);
  const replay = await call("/api/video-gateway/device-heartbeat", heartbeatPayload, { "x-video-gateway-device-token": accessToken, "x-video-gateway-id": gatewayId });
  assert.equal(replay.response.status, 200, "Identical Connector heartbeat retry was not idempotent");
  assert.equal(replay.body.data?.idempotent_replay, true);
  const identityMismatch = await call("/api/video-gateway/device-heartbeat", { ...heartbeatPayload, heartbeat_id: `heartbeat-${randomUUID()}`, runtime: { ...heartbeatPayload.runtime, device_type: "PHYSICAL_GATEWAY" } }, { "x-video-gateway-device-token": accessToken, "x-video-gateway-id": gatewayId });
  assert.equal(identityMismatch.response.status, 403, "Connector could change its enrolled device type");

  const replacement = generateManagedDeviceKeyPair();
  const prepareBody = { action: "rotate_prepare", gateway_id: gatewayId, new_credential_algorithm: "Ed25519", new_public_key_spki: replacement.publicKeySpki };
  const prepareRaw = JSON.stringify(prepareBody), identityPath = "/api/video-gateway/device-identity";
  const prepared = await call(identityPath, prepareBody, createManagedDeviceProofHeaders({ method: "POST", pathname: identityPath,
    body: prepareRaw, deviceId: gatewayId, credentialVersion: 1, privateKeyPkcs8: keyPair.privateKeyPkcs8,
    runtimeInstanceId, sequence: ++sequence }));
  assert.equal(prepared.response.status, 200, "Credential rotation prepare failed");
  const rotation = prepared.body.data;
  const canonical = ["observer-managed-device-rotation-v1", gatewayId, String(rotation.new_credential_version), rotation.rotation_id, rotation.challenge].join("\n");
  const confirmation = sign(null, Buffer.from(canonical), createPrivateKey({ key: Buffer.from(replacement.privateKeyPkcs8, "base64url"), format: "der", type: "pkcs8" })).toString("base64url");
  const confirmed = await call(identityPath, { action: "rotate_confirm", gateway_id: gatewayId, rotation_id: rotation.rotation_id,
    new_credential_version: rotation.new_credential_version, challenge: rotation.challenge, signature: confirmation });
  assert.equal(confirmed.response.status, 200, "Credential rotation confirmation failed");
  assert.equal((await authenticate(keyPair, 1)).response.status, 401, "Old credential remained valid after rotation");
  sequence = 0;
  const refreshed = await authenticate(replacement, 2, `production-qa-rotated:${randomUUID()}`);
  assert.equal(refreshed.response.status, 200, "Replacement credential could not authenticate");
  accessToken = refreshed.body.data.access_token;

  const revoked = await call("/api/digital-observer/gateway-enrollment", { action: "revoke", gateway_id: gatewayId, observer_site_id: siteId }, { authorization });
  assert.equal(revoked.response.status, 200, `Connector revocation failed with HTTP ${revoked.response.status}`);
  const afterRevoke = await call("/api/video-gateway/device-heartbeat", { ...heartbeatPayload, heartbeat_id: `heartbeat-${randomUUID()}`, observed_at: new Date().toISOString() }, { "x-video-gateway-device-token": accessToken, "x-video-gateway-id": gatewayId });
  assert.equal(afterRevoke.response.status, 401, "Revoked Connector retained cloud access");

  console.log(JSON.stringify({ status: "PASS", production_origin: origin.origin, device_type: "SOFTWARE_CONNECTOR", enrollment_id: enrollmentId, gateway_id: gatewayId, site_id: siteId, heartbeat: "accepted", heartbeat_replay: "idempotent", identity_type_change: "denied", identity_scheme: "ED25519_V1", rotation_protocol: "verify-new-then-retire-old", revoked_access: "denied", secrets_exposed: false }, null, 2));
} finally {
  if (gatewayId) await call("/api/digital-observer/gateway-enrollment", { action: "revoke", gateway_id: gatewayId, observer_site_id: siteId }, { authorization }).catch(() => null);
  await client.auth.signOut();
}
