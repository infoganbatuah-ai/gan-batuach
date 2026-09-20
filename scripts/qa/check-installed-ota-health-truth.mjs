import assert from "node:assert/strict";
import { deriveInstalledEdgeHealth } from "../../services/video-gateway/edge-installed-ota-service.mjs";
import { edgeHealthGate } from "../../services/video-gateway/edge-update-manager.mjs";

const base = { ok: true, service: { running: true }, body: { deviceAuthorization: { status: "ready" } } };
const connector = { ...base, body: { ...base.body,
  lastDiscovery: { channelCount: 1, connectedCount: 1 },
  mediaHeartbeat: { progressingRelays: 0, stalledRelays: 1 } } };
const current = deriveInstalledEdgeHealth({ profile: "SOFTWARE_CONNECTOR", expected: 1,
  probe: connector, cloudReachable: true });
assert.equal(current.config_retrieved, true);
assert.equal(current.progressing_physical_cameras, 0);
assert.equal(edgeHealthGate(current).healthy, false);
const recovered = deriveInstalledEdgeHealth({ profile: "SOFTWARE_CONNECTOR", expected: 1,
  probe: { ...connector, body: { ...connector.body,
    mediaHeartbeat: { progressingRelays: 1, stalledRelays: 0 } } }, cloudReachable: true });
assert.equal(edgeHealthGate(recovered).healthy, true);
const gateway = deriveInstalledEdgeHealth({ profile: "PHYSICAL_GATEWAY", expected: 10,
  probe: { ...base, body: { ...base.body,
    lastDiscovery: { assignedCount: 10, connectedCount: 10, unassignedCount: 6 },
    mediaHeartbeat: { progressingRelays: 10, stalledRelays: 0 } } }, cloudReachable: true });
assert.equal(edgeHealthGate(gateway).healthy, true);
assert.equal(gateway.empty_slots, 6);
const falseProgress = deriveInstalledEdgeHealth({ profile: "PHYSICAL_GATEWAY", expected: 10,
  probe: { ...base, body: { ...base.body,
    lastDiscovery: { assignedCount: 10, connectedCount: 10, unassignedCount: 6 },
    mediaHeartbeat: { progressingRelays: 0, stalledRelays: 0 } } }, cloudReachable: true });
assert.equal(edgeHealthGate(falseProgress).healthy, false);
console.log(JSON.stringify({ result: "PASS", connector_stall_detected: true,
  connector_recovery_detected: true, gateway_progression_detected: true,
  connected_without_frames_rejected: true }));
