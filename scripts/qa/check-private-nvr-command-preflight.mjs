import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createPrivateNvrPreflightDriver } from "../../services/video-gateway/private-nvr-command-preflight.mjs";

let clock = Date.now(), calls = 0;
const site = randomUUID(), camera = randomUUID();
const identity = { gatewayId: "fixture-gateway", siteId: site };
const source = { kind: "private_nvr_http_mp4", channel: 4, sessionKey: "never-export-this" };
const request = overrides => ({ id: randomUUID(), task_kind: "capability_snapshot", camera_id: camera, site_id: site, stream_id: "fixture-stream", channel: 4, requested_at: new Date(clock).toISOString(), expires_at: new Date(clock + 60000).toISOString(), ...overrides });
const driver = createPrivateNvrPreflightDriver({ now: () => clock, resolveSource: id => id === "fixture-stream" ? source : null, probe: async () => {
  calls++;
  return { adapter: "private_nvr_http_api_v1", ptz: { tested: true, supported: true }, talkback: { tested: false, supported: true }, light: { tested: true, supported: false }, siren: { tested: true, supported: true }, password: "never-export-this" };
} });
const first = request();
const [snapshot, duplicate] = await Promise.all([driver(first, identity), driver(first, identity)]);
assert.deepEqual(snapshot, duplicate);
assert.equal(calls, 1, "Duplicate polls must share the read-only probe");
assert.deepEqual(snapshot.outcome_payload.capabilities, { ptz: true, twoWayAudio: false, siren: true, lighting: false });
assert.equal(snapshot.outcome_payload.executor_installed, false);
assert.doesNotMatch(JSON.stringify(snapshot), /never-export|sessionKey|password|baseUrl|token/);
assert.equal(snapshot.outcome_payload.details.twoWayAudio.tested_at, null);
const preflight = await driver(request({ task_kind: "command_preflight", action: "ptz", payload_digest: "a".repeat(64) }), identity);
assert.equal(preflight.outcome_payload.supported, true);
assert.equal(preflight.outcome_payload.executed, false);
assert.equal(preflight.outcome_payload.ack_kind, "preflight_only");
assert.equal(preflight.outcome_payload.requires_immediate_confirmation, true);
assert.equal(preflight.outcome_payload.executor_installed, false);
const untestedAction = await driver(request({ task_kind: "command_preflight", action: "talk", payload_digest: "a".repeat(64) }), identity);
assert.equal(untestedAction.result_code, "unavailable", "Evidence for a different action must not verify this one");
assert.equal(untestedAction.outcome_payload.verified_at, null);
const beforeInvalid = calls;
for (const [change, expected] of [
  [{ task_kind: "execute" }, "physical_dispatch_blocked"],
  [{ site_id: randomUUID() }, "source_scope_mismatch"],
  [{ channel: 5 }, "source_mapping_unavailable"],
  [{ channel: 0 }, "invalid_stream_mapping"],
  [{ stream_id: "https://example.invalid" }, "invalid_stream_mapping"],
  [{ stream_id: "another-stream" }, "source_mapping_unavailable"],
  [{ password: "not-accepted" }, "invalid_preflight_request"],
  [{ action: "ptz" }, "snapshot_action_blocked"],
  [{ requested_at: new Date(clock + 10000).toISOString() }, "preflight_expired"],
  [{ expires_at: new Date(clock - 1).toISOString() }, "preflight_expired"],
  [{ expires_at: new Date(clock + 120001).toISOString() }, "preflight_expired"],
  [{ task_kind: "command_preflight", action: "constructor", payload_digest: "a".repeat(64) }, "invalid_preflight_action"],
  [{ task_kind: "command_preflight", action: "siren", payload_digest: "invalid" }, "invalid_preflight_action"]
]) await assert.rejects(driver(request(change), identity), error => error.code === expected);
await assert.rejects(driver({ ...first, camera_id: randomUUID() }, identity), error => error.code === "request_replay_mismatch");
assert.equal(calls, beforeInvalid, "Invalid/replayed/scope-mismatched requests must not contact the recorder");
const unavailable = createPrivateNvrPreflightDriver({ now: () => clock, resolveSource: () => source, probe: async () => { throw Error("sensitive upstream error"); } });
const failed = await unavailable(request(), identity);
assert.equal(failed.result_code, "unavailable");
assert.equal(failed.outcome_payload.verified_at, null);
assert.equal(Object.values(failed.outcome_payload.capabilities).some(Boolean), false);
assert.doesNotMatch(JSON.stringify(failed), /sensitive/);
const wrongAdapter = createPrivateNvrPreflightDriver({ now: () => clock, resolveSource: () => source, probe: async () => ({ adapter: "unknown", ptz: { tested: true, supported: true } }) });
assert.equal((await wrongAdapter(request(), identity)).outcome_payload.capabilities.ptz, false);
await assert.rejects(driver(request(), { siteId: site }), error => error.code === "source_scope_mismatch");
const slow = createPrivateNvrPreflightDriver({ now: () => clock, resolveSource: () => source, probe: async () => { clock += 60001; return {}; } });
await assert.rejects(slow(request(), identity), error => error.code === "preflight_expired");

// Exercise the actual cloud poll and report functions with synthetic network
// responses. Failed ACK delivery must not trigger another device probe.
const server = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
const functions = server.slice(server.indexOf("async function reportCameraActionResult("), server.indexOf("\nif (GATEWAY_KEYCHAIN_SERVICE)"));
assert.ok(functions.includes("async function pollCloudCameraActions()"));
const network = [];
let rejectAck = true, queued = request(), driverCalls = 0;
const context = {
  pendingCameraActionResult: null, GATEWAY_KEYCHAIN_SERVICE: "fixture-service", CLOUD_AUTH_TIMEOUT_MS: 10,
  Date: class extends Date { static now() { return clock; } }, JSON, String, Number, Math, AbortSignal,
  keychainSecret: async key => ({ device_cloud_base_url: "https://cloud.invalid", device_gateway_id: identity.gatewayId, device_observer_site_id: site }[key] || ""),
  refreshGatewayDeviceAccess: async () => "synthetic-auth",
  preflightDriver: async (value, scope) => { driverCalls++; return driver(value, scope); },
  fetch: async (url, init) => {
    assert.equal(url, "https://cloud.invalid/api/video-gateway/camera-actions");
    const body = JSON.parse(init.body);
    network.push(body);
    return { ok: body.action === "poll" || !rejectAck, json: async () => ({ data: { action_request: queued } }) };
  }
};
runInNewContext(`${functions}\nthis.poll = pollCloudCameraActions;`, context);
await context.poll();
assert.equal(driverCalls, 1);
assert.ok(context.pendingCameraActionResult);
rejectAck = false;
await context.poll();
assert.equal(driverCalls, 1);
assert.equal(context.pendingCameraActionResult, null);
assert.deepEqual(network.map(value => value.action), ["poll", "result", "result"]);
assert.deepEqual(network[1], network[2]);
assert.equal(network[1].outcome_payload.executor_installed, false);
queued = { id: randomUUID(), action_type: "siren", parameters: { enabled: true } };
await context.poll();
assert.equal(driverCalls, 1, "Legacy physical actions must never enter the read-only driver");
assert.equal(network.at(-1).outcome, "failed");
assert.equal(network.at(-1).result_code, "adapter_executor_not_installed");
console.log("PASS: scoped read-only snapshot, preflight-only ACK, expiry, replay, unsupported evidence and secret redaction");
