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
const managedAgentAuth = deriveInstalledEdgeHealth({ profile: "SOFTWARE_CONNECTOR", expected: 1,
  probe: { ...connector, body: { ...connector.body, deviceAuthorization: { status: "approval_required" } } },
  cloudReachable: true, managedDeviceAuthenticated: true });
assert.equal(managedAgentAuth.device_authenticated, true);
assert.equal(edgeHealthGate(managedAgentAuth).reason, "EDGE_UPDATE_CAMERA_PROGRESSION_FAILED");
const unauthenticated = deriveInstalledEdgeHealth({ profile: "SOFTWARE_CONNECTOR", expected: 1,
  probe: { ...connector, body: { ...connector.body, deviceAuthorization: { status: "approval_required" } } },
  cloudReachable: false, managedDeviceAuthenticated: false });
assert.equal(edgeHealthGate(unauthenticated).reason, "EDGE_UPDATE_HEALTH_DEVICE_AUTHENTICATED_FAILED");
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
const knownUpstreamFailure = deriveInstalledEdgeHealth({ profile: "PHYSICAL_GATEWAY", expected: 8,
  configured: 10, probe: { ...base, body: { ...base.body,
    lastDiscovery: { assignedCount: 10, connectedCount: 8, failedAssignedCount: 2, unassignedCount: 6 },
    mediaHeartbeat: { progressingRelays: 8, stalledRelays: 0 } } }, cloudReachable: true });
assert.equal(knownUpstreamFailure.config_retrieved, true);
assert.equal(edgeHealthGate(knownUpstreamFailure).healthy, true);
const hiddenConfiguredSources = deriveInstalledEdgeHealth({ profile: "PHYSICAL_GATEWAY", expected: 8,
  configured: 8, probe: { ...base, body: { ...base.body,
    lastDiscovery: { assignedCount: 10, connectedCount: 8, failedAssignedCount: 2, unassignedCount: 6 },
    mediaHeartbeat: { progressingRelays: 8, stalledRelays: 0 } } }, cloudReachable: true });
assert.equal(hiddenConfiguredSources.config_retrieved, false);
assert.equal(edgeHealthGate(hiddenConfiguredSources).healthy, false);
console.log(JSON.stringify({ result: "PASS", connector_stall_detected: true,
  managed_agent_authentication_accepted: true, unauthenticated_runtime_rejected: true,
  connector_recovery_detected: true, gateway_progression_detected: true,
  connected_without_frames_rejected: true, known_upstream_failure_bounded: true,
  configured_sources_cannot_be_hidden: true }));
