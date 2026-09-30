import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PUSH38_CONNECTOR_LIVENESS_ISOLATION as item } from
  "../../services/video-gateway/push38-home-qa-connector-liveness-isolation.mjs";

const source = readFileSync(new URL(
  "./retry-push38-homeqa-connector-liveness-isolation-after-host-recovery.mjs", import.meta.url), "utf8");

test("retry is bound to the exact signed 0.2.32 release and 0.2.26 rollback", () => {
  assert.match(source, /PUSH38_CONNECTOR_LIVENESS_ISOLATION/);
  assert.equal(item.releaseId, "qa-p38-health-connector-liveness-isolation-e46f2cb0daf6");
  assert.equal(item.digest, "e46f2cb0daf617cc80a5b8c2be1f448820ab391667992d390ab63de36afd1e53");
  assert.equal(item.rollbackReleaseId, "qa-p38-health-connector-rtsp-cadence-559bb01f78a2");
  assert.match(source, /EDGE_UPDATE_CRASH_LOOP/);
  assert.match(source, /manager\.verifySlot\(current\)/);
  assert.match(source, /manager\.verifySlot\(\{ version: item\.version/);
});

test("retry requires protected trust, fresh exact-device auth, stable health and measured host headroom", () => {
  for (const value of ["PROTECTED_EDGE_TRUST_REGISTRY_PATH", "fresh_proof", "ED25519_V1",
    "explicit_device_ids", "broad_active", "EXPECTED_RELAY_NOT_PROGRESSING",
    "STALE_INPUT", "sample.connected === 0", "sample.stalled === 1", "event_loop_p99_ms",
    "supervision_crash_loops", "sampleHostPressure", "cpu_idle_percent", "memory_free_percent",
    "uninterruptible_sample_counts", "persistent_uninterruptible_processes",
    "blockedSamples.slice(1).every", "host.load_1m > host.logical_cpus * 3 && host.cpu_idle_percent < 35"])
    assert.ok(source.includes(value), `missing retry safeguard: ${value}`);
  assert.match(source, /for \(let index = 0; index < 10; index \+= 1\)/);
});

test("apply uses canonical recovery and one-time retry while OTA remains sole installer", () => {
  assert.match(source, /recoverKnownGoodCrashLoopAfterStability\(\)/);
  assert.match(source, /reconcileVerifiedRecovery/);
  assert.match(source, /authorizeQuarantinedReleaseRetry/);
  assert.match(source, /ota_agent_owns_install: true/);
  assert.match(source, /functional_runtime_changed_by_command: false/);
  assert.doesNotMatch(source, /manager\.apply|adapter\.restart|launchctl", \["kickstart/);
  assert.doesNotMatch(source, /cohort_percent\s*=\s*100|cohort_percent=100/);
});

test("codec retry permits one evidence-bound interference retry and no active shadow", () => {
  for (const value of ["--qualification-interference-retry",
    "QUALIFICATION_INTERFERENCE_REMOVED", "activeShadowProcesses",
    "REAL_DVR_SHADOW_COMPLETE", "NO_ACTIVE_SHADOW_PROCESS",
    "retry_authorization_attempt", "interference_evidence_sha256"])
    assert.ok(source.includes(value), `missing interference retry safeguard: ${value}`);
});
