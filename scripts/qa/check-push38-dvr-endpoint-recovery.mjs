import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPrivateNvrIdentityBinding, discoverAuthorizedPrivateNvrEndpoint,
  parsePrivateNvrIdentityBinding, privateNvrEndpointWithHost,
  privateNvrSubnetCandidates, probePrivateNvrIdentity,
  shouldAttemptPrivateNvrEndpointRecovery } from
  "../../services/video-gateway/private-nvr-endpoint-recovery.mjs";

const deviceInfo = { data: { mac_addr: "00:11:22:33:44:55", device_sn: "fixture-serial",
  model: "ERO-N7516HR", software: "8.2.4.1" } };
const binding = createPrivateNvrIdentityBinding({ deviceInfo, model: "ERO-N7516HR",
  software: "8.2.4.1", channelCapacity: 16, verifiedAt: "2026-10-06T00:00:00.000Z" });
assert.deepEqual(parsePrivateNvrIdentityBinding(JSON.stringify(binding)), binding);
assert.match(binding.stream_namespace, /^private-nvr-[a-f0-9]{24}$/);
const hardwareBinding = createPrivateNvrIdentityBinding({
  deviceInfo: { data: { mac_addr: "00:11:22:33:44:55", p2p_id: "fixture-p2p",
    model: "ERO-N7516HR", software: "8.2.4.1" } },
  model: "ERO-N7516HR", software: "8.2.4.1", channelCapacity: 16,
  verifiedAt: "2026-10-06T00:00:00.000Z" });
const changedConfigurationBinding = createPrivateNvrIdentityBinding({
  deviceInfo: { data: { mac_addr: "00:11:22:33:44:55", p2p_id: "fixture-p2p",
    model: "ERO-N7516HR", software: "8.2.4.1", local_ip: "192.168.10.24" } },
  model: "ERO-N7516HR", software: "8.2.4.1", channelCapacity: 16,
  verifiedAt: "2026-10-06T01:00:00.000Z" });
assert.equal(hardwareBinding.fingerprint_sha256, changedConfigurationBinding.fingerprint_sha256);
const fallbackBinding = createPrivateNvrIdentityBinding({
  deviceInfo: { data: { model: "ERO-N7516HR", software: "8.2.4.1" } },
  systemInfo: { data: { hardware_version: "DM-448", firmware_version: "V8.2.4.1-20240515" } },
  credentialAnchor: "a".repeat(64), model: "ERO-N7516HR", software: "8.2.4.1",
  channelCapacity: 16, verifiedAt: "2026-10-06T00:00:00.000Z" });
assert.match(fallbackBinding.fingerprint_sha256, /^[a-f0-9]{64}$/);
assert.equal(privateNvrEndpointWithHost("http://192.168.10.20", "192.168.10.24"),
  "http://192.168.10.24");
const candidates = privateNvrSubnetCandidates("http://192.168.10.20");
assert.equal(candidates.length, 253);
assert.equal(new Set(candidates).size, 253);
assert(!candidates.includes("192.168.10.20"));
assert(candidates.every(host => host.startsWith("192.168.10.")));

const profile = { endpoint: "http://192.168.10.20", username: "fixture-user" };
const identity = { host: "192.168.10.24", fingerprint_sha256: binding.fingerprint_sha256 };
let result = await discoverAuthorizedPrivateNvrEndpoint({ profile, password: "fixture-password",
  binding, concurrency: 32, probe: async ({ host }) => host === "192.168.10.24" ? identity : null });
assert.equal(result.status, "CHANGED");
assert.equal(result.host, "192.168.10.24");
result = await discoverAuthorizedPrivateNvrEndpoint({ profile, password: "fixture-password",
  binding, probe: async ({ host }) => host === "192.168.10.20" ? { ...identity, host } : null });
assert.equal(result.status, "CURRENT");
await assert.rejects(discoverAuthorizedPrivateNvrEndpoint({ profile, password: "fixture-password",
  binding, concurrency: 64, probe: async ({ host }) => ["192.168.10.24", "192.168.10.25"].includes(host)
    ? { ...identity, host } : null }), /MULTIPLE_IDENTITY_MATCHES/);

const channelInfo = { data: Array.from({ length: 16 }, (_, index) => ({ name: `CH${index + 1}` })) };
const json = value => new Response(JSON.stringify(value), { status: 200,
  headers: { "content-type": "application/json" } });
const fetchImpl = async (url, options = {}) => {
  if (url.endsWith("/API/Login/Range")) return json({ data: { login_exclusivity: false } });
  if (url.endsWith("/API/Web/Login") && !options.headers?.authorization) {
    return new Response("", { status: 401, headers: {
      "www-authenticate": "Digest realm=\"fixture\", nonce=\"abc\", qop=\"auth\", algorithm=MD5"
    } });
  }
  if (url.endsWith("/API/Web/Login")) return new Response("{}", { status: 200,
    headers: { "x-csrftoken": "fixture-token", "set-cookie": "sid=fixture; HttpOnly" } });
  if (url.endsWith("/API/Login/DeviceInfo/Get")) return json(deviceInfo);
  if (url.endsWith("/API/SystemInfo/Base/Get")) return json({ data: {
    hardware_version: "fixture-hardware", firmware_version: "fixture-firmware" } });
  if (url.endsWith("/API/Login/ChannelInfo/Get")) return json(channelInfo);
  if (url.endsWith("/API/Web/Logout")) return json({ result: "success" });
  throw new Error("unexpected fixture URL");
};
const probed = await probePrivateNvrIdentity({ profile, password: "fixture-password",
  host: "192.168.10.20", binding, fetchImpl });
assert.equal(probed.fingerprint_sha256, binding.fingerprint_sha256);
assert.equal(probed.channel_capacity, 16);
assert.equal(await probePrivateNvrIdentity({ profile, password: "fixture-password",
  host: "192.168.10.20", binding: { ...binding, fingerprint_sha256: "0".repeat(64) },
  fetchImpl }), null);

const unhealthy = { lastDiscovery: { assignedCount: 10 }, mediaHeartbeat: {
  availableRelays: 0, renewingRelays: 0 }, recorderSessionHeartbeat: { consecutive_failures: 3 } };
let decision = shouldAttemptPrivateNvrEndpointRecovery({ deviceType: "PHYSICAL_GATEWAY",
  health: unhealthy, now: 100_000 });
assert.equal(decision.ready, false);
decision = shouldAttemptPrivateNvrEndpointRecovery({ deviceType: "PHYSICAL_GATEWAY",
  health: unhealthy, outageStartedAt: 100_000, now: 130_000 });
assert.equal(decision.ready, true);
decision = shouldAttemptPrivateNvrEndpointRecovery({ deviceType: "PHYSICAL_GATEWAY",
  health: unhealthy, outageStartedAt: 100_000, lastAttemptAt: 129_000, now: 130_000 });
assert.equal(decision.ready, false);
assert.equal(shouldAttemptPrivateNvrEndpointRecovery({ deviceType: "SOFTWARE_CONNECTOR",
  health: unhealthy, now: 130_000 }).eligible, false);

const runner = readFileSync(new URL("../run-persistent-home-gateway.mjs", import.meta.url), "utf8");
assert.match(runner, /PRIVATE_NVR_IDENTITY_BINDING_ACCOUNT/);
assert.match(runner, /discoverAuthorizedPrivateNvrEndpoint/);
assert.match(runner, /PRIVATE_NVR_ENDPOINT_RECOVERY_PENDING_ACCOUNT/);
assert.match(runner, /source_identity_changed: false/);
assert.match(runner, /child\.kill\("SIGTERM"\)/);
assert.match(runner, /assigned > 0 && connected > 0 && recorderFailures === 0/);
assert.match(runner, /endpointRecoveryRestartRequested \? 0 : code \|\| 1/);
assert.doesNotMatch(runner, /console\.(?:log|error)\([^\n]*(?:updated\.endpoint|discovered\.host)/);

console.log(JSON.stringify({ status: "PASS", contract: "observer-push38-dvr-endpoint-recovery-qa-v1",
  identity_binding: "PASS", private_subnet_scope: "PASS", exact_identity_match: "PASS",
  wrong_identity_rejected: "PASS", duplicate_identity_rejected: "PASS",
  outage_and_cooldown_gate: "PASS", endpoint_not_logged: "PASS" }));
