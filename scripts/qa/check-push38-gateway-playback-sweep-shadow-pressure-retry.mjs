import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "scripts/qa/retry-push38-homeqa-gateway-playback-sweep-after-shadow-pressure.mjs", "utf8");
const activation = readFileSync(
  "scripts/qa/activate-push38-homeqa-gateway-common-cause-recovery.mjs", "utf8");

test("retry binds the exact signed bridge, successor, and rollback state", () => {
  for (const token of ["PUSH38_GATEWAY_PLAYBACK_SWEEP_SERIALIZATION",
    "PUSH38_GATEWAY_FINITE_RESPONSE_CONTINUITY", "EDGE_UPDATE_CRASH_LOOP",
    "manager.authorizeQuarantinedReleaseRetry", "prior_healthy_duration_ms",
    "pre_rollback_live_health_200_samples"])
    assert.match(source, new RegExp(token));
});

test("retry remains exact-device, fail-closed, and OTA-agent-owned", () => {
  for (const token of ["cohort_percent=0", "explicit_device_ids", "broad_cohort: false",
    "ota_agent_owns_install: true", "P38_GATEWAY_PLAYBACK_SWEEP_RETRY_HOST_BUSY",
    "shadow.runtime_mutation !== false", "shadow.qualification?.playback_failures !== 0"])
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(source, /manager\.apply|adapter\.install|launchctl\s+(?:bootout|bootstrap|kickstart)/);
});

test("retry preserves the physical Home truth and signed Connector prerequisite", () => {
  for (const token of ["sample.assigned === 10", "sample.connected === 9",
    "sample.failed === 1", "sample.empty === 6", "sample.progressing === 9",
    "PUSH38_CONNECTOR_RTSP_CADENCE", "connectorPrerequisiteSafe",
    "DISCOVERY_PROBE_FAILED", "sample.progressing === 1", "sample.stalled === 0"])
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("finite-response activation consumes its own failed-V8 proof", () => {
  assert.match(activation,
    /if \(recoveryContinuity \|\| routineConfirmation \|\| sessionRenewal \|\| explicitProactiveExclusive\)/);
  assert.doesNotMatch(activation,
    /if \(recoveryContinuity \|\| routineConfirmation \|\| sessionRenewal \|\| proactiveExclusive\)/);
});

test("activation accepts software fallback only with explicit output-stall and playback proof", () => {
  for (const token of ["HARDWARE_OUTPUT_STALL_OWNER_RELEASE", "OUTPUT_RESCUE",
    "last_handoff_output_advances", "firstSoftwareCheckpoint?.renewal?.playlist_status === 200",
    "firstSoftwareCheckpoint?.renewal?.segment_status === 200",
    "firstSoftwareCheckpoint?.renewal?.segment_bytes > 0"])
    assert.match(activation, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
