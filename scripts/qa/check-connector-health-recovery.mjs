import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { connectorHeartbeatHealth, retainVerifiedChannels } from "../../services/video-gateway/connector-health-recovery.mjs";

const prior = [{ channel: 1, status: "connected", gateway_stream_id: "same-source" }];
const failed = [{ channel: 1, status: "unavailable", gateway_stream_id: "same-source" }];
assert.deepEqual(retainVerifiedChannels(prior, failed), prior,
  "a failed probe may not erase the local monitor's verified source");
assert.deepEqual(retainVerifiedChannels(prior, [{ ...prior[0], status: "connected" }]), prior);
assert.deepEqual(retainVerifiedChannels([], failed), failed);

const stalled = connectorHeartbeatHealth({ ok: true, failedStreamCount: 1,
  mediaHeartbeat: { activeRelays: 0, progressingRelays: 0, stalledRelays: 0 } }, 1);
assert.equal(stalled.status, "DEGRADED");
assert.equal(stalled.streamingCount, 0);
assert.deepEqual(stalled.errorCodes, ["EXPECTED_RELAY_NOT_PROGRESSING", "DISCOVERY_PROBE_FAILED"]);

const activeWithProbeFailure = connectorHeartbeatHealth({ ok: true, failedStreamCount: 1,
  mediaHeartbeat: { progressingRelays: 1, stalledRelays: 0 } }, 1);
assert.equal(activeWithProbeFailure.status, "HEALTHY");
assert.deepEqual(activeWithProbeFailure.errorCodes, ["DISCOVERY_PROBE_FAILED"]);

const fullyHealthy = connectorHeartbeatHealth({ ok: true, failedStreamCount: 0,
  mediaHeartbeat: { progressingRelays: 1, stalledRelays: 0 } }, 1);
assert.equal(fullyHealthy.status, "HEALTHY");
assert.equal(fullyHealthy.streamingCount, 1);
assert.deepEqual(fullyHealthy.errorCodes, []);
assert.equal(connectorHeartbeatHealth({ ok: true, mediaHeartbeat: { progressingRelays: "invalid", stalledRelays: 0 } }, 1).status, "DEGRADED");

const runner = readFileSync("scripts/run-persistent-home-gateway.mjs", "utf8");
assert.match(runner, /channels = retainVerifiedChannels\(channels, mappedDiscovery\)/);
assert.match(runner, /channels: discovered, metadata:/);
assert.match(runner, /status: mediaHealth\.status/);
assert.match(runner, /streaming_count: mediaHealth\.streamingCount/);
assert.match(runner, /edgeDeviceType === "SOFTWARE_CONNECTOR" \? expectedChannelCount : connectorChannelFilter\.length/);
const server = readFileSync("services/video-gateway/server.mjs", "utf8");
assert.match(server, /ok: mediaHealth\.status === "HEALTHY"/);
assert.match(server, /health_reason_codes: mediaHealth\.errorCodes/);
assert.match(server, /edgeRuntimeIdentity\.device_type === "SOFTWARE_CONNECTOR"/);
console.log(JSON.stringify({ status: "PASS", cases: 13, liveRuntimeChanged: false }));
