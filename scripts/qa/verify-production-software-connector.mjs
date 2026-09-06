import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { hostname } from "node:os";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

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
const password = config.QA_DEMO_DIGITAL_OBSERVER_HOME_PASSWORD || config.QA_DEMO_DIGITAL_OBSERVER_PASSWORD;
assert.ok(config.NEXT_PUBLIC_SUPABASE_URL && publicKey && config.QA_DEMO_DIGITAL_OBSERVER_HOME_EMAIL && password, "Authorized home Production QA configuration is missing");
const client = createClient(config.NEXT_PUBLIC_SUPABASE_URL, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
const login = await client.auth.signInWithPassword({ email: config.QA_DEMO_DIGITAL_OBSERVER_HOME_EMAIL, password });
assert.ok(!login.error && login.data.session, "Authorized home Production authentication failed");
const authorization = `Bearer ${login.data.session.access_token}`;

async function call(path, body, headers = {}) {
  const response = await fetch(new URL(path, origin), { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(30_000) });
  return { response, body: await response.json().catch(() => ({})) };
}

let gatewayId = "";
let accessToken = "";
let refreshToken = "";
let enrollmentId = "";
try {
  const installationId = `edge-prod-qa-${randomUUID()}`;
  const created = await call("/api/digital-observer/gateway-enrollment", { action: "create_request", device_name: `Push 16 QA ${hostname()}`.slice(0, 80), device_platform: "production-qa", device_fingerprint: randomBytes(32).toString("hex"), device_type: "SOFTWARE_CONNECTOR", installation_id: installationId, software_version: "push16-qa", build_sha: "production-verification" });
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
  accessToken = linked.body.data.access_token;
  refreshToken = linked.body.data.refresh_token;

  const heartbeatPayload = { heartbeat_id: `heartbeat-${randomUUID()}`, gateway_id: gatewayId, observer_site_id: siteId, observed_at: new Date().toISOString(), runtime: { contract: "observer-edge-runtime-v1", device_type: "SOFTWARE_CONNECTOR", installation_id: installationId, software_version: "push16-qa", build_sha: "production-verification", outbound_only: true, arbitrary_shell_commands: false }, health: { status: "HEALTHY", uptime_seconds: 1, cpu_percent: 1, memory_mb: 64, disk_free_mb: 1024, camera_count: 0, streaming_count: 0, last_frame_at: null, error_codes: [] } };
  const heartbeat = await call("/api/video-gateway/device-heartbeat", heartbeatPayload, { "x-video-gateway-device-token": accessToken, "x-video-gateway-id": gatewayId });
  assert.equal(heartbeat.response.status, 200, `Connector heartbeat failed with HTTP ${heartbeat.response.status}`);
  assert.equal(heartbeat.body.data?.device_type, "SOFTWARE_CONNECTOR");
  assert.equal(heartbeat.body.data?.commands?.length, 0);

  const nextRefreshToken = randomBytes(32).toString("base64url");
  const refreshed = await call("/api/digital-observer/gateway-enrollment", { action: "refresh", gateway_id: gatewayId, refresh_token: refreshToken, next_refresh_token: nextRefreshToken });
  assert.equal(refreshed.response.status, 200, `Connector token rotation failed with HTTP ${refreshed.response.status}`);
  assert.equal(refreshed.body.data?.rotation_protocol, 2);
  accessToken = refreshed.body.data.access_token;
  refreshToken = nextRefreshToken;

  const revoked = await call("/api/digital-observer/gateway-enrollment", { action: "revoke", gateway_id: gatewayId, observer_site_id: siteId }, { authorization });
  assert.equal(revoked.response.status, 200, `Connector revocation failed with HTTP ${revoked.response.status}`);
  const afterRevoke = await call("/api/video-gateway/device-heartbeat", { ...heartbeatPayload, heartbeat_id: `heartbeat-${randomUUID()}`, observed_at: new Date().toISOString() }, { "x-video-gateway-device-token": accessToken, "x-video-gateway-id": gatewayId });
  assert.equal(afterRevoke.response.status, 401, "Revoked Connector retained cloud access");

  console.log(JSON.stringify({ status: "PASS", production_origin: origin.origin, device_type: "SOFTWARE_CONNECTOR", enrollment_id: enrollmentId, gateway_id: gatewayId, site_id: siteId, heartbeat: "accepted", rotation_protocol: 2, revoked_access: "denied", secrets_exposed: false }, null, 2));
} finally {
  if (gatewayId) await call("/api/digital-observer/gateway-enrollment", { action: "revoke", gateway_id: gatewayId, observer_site_id: siteId }, { authorization }).catch(() => null);
  await client.auth.signOut();
}
