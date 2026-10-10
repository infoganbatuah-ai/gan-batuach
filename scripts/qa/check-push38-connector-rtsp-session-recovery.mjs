import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPush38ConnectorRtspSessionRecoveryManifest,
  PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY } from "../../services/video-gateway/push38-home-qa-connector-rtsp-session.mjs";
import { DIRECT_RTSP_MINIMUM_OUTPUT_RESCUE_AGE_MS,
  DIRECT_RTSP_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS,
  DIRECT_RTSP_PROACTIVE_RELAY_HANDOFF_MS,
  shouldProactivelyHandoffDirectRtspRelay } from "../../services/video-gateway/rtsp-session-policy.mjs";

const manifest = buildPush38ConnectorRtspSessionRecoveryManifest({ signingKeyId: "fixture-release-key",
  artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
  releasedAt: new Date().toISOString() }).document;
assert.equal(manifest.release_id, PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.releaseId);
assert.equal(manifest.artifact_sha256, PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.digest);
assert.equal(manifest.artifact_size, PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.size);
assert.equal(manifest.build_sha, PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.buildSha);
assert.equal(manifest.compatibility.minimum_current_version,
  PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.rollbackVersion);
assert.equal(manifest.compatibility.maximum_current_version,
  PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.rollbackVersion);
assert.equal(manifest.compatibility.security_floor_version,
  PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.rollbackVersion);
assert.equal(manifest.rollout.cohort_percent, 0);
assert.deepEqual(manifest.rollout.explicit_device_ids,
  [PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.deviceId]);
const source = readFileSync("services/video-gateway/server.mjs", "utf8");
assert.match(source, /active_relay_verified/);
assert.match(source, /function protectedRtspInput/);
assert.doesNotMatch(source, /spawn\([^\n]+(?:source\.url|source\.rtspUrl)/);
const now = Date.now();
const eligible = { progressing: true, recoveryStable: true, warming: false,
  startedAt: now - DIRECT_RTSP_PROACTIVE_RELAY_HANDOFF_MS };
assert.equal(shouldProactivelyHandoffDirectRtspRelay(eligible, now), true);
assert.equal(shouldProactivelyHandoffDirectRtspRelay({ ...eligible,
  startedAt: eligible.startedAt + 1 }, now), false);
assert.equal(shouldProactivelyHandoffDirectRtspRelay({ ...eligible,
  recoveryStable: false,
  startedAt: now - DIRECT_RTSP_MINIMUM_OUTPUT_RESCUE_AGE_MS,
  lastOutputAt: now - DIRECT_RTSP_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS }, now), true);
assert.equal(shouldProactivelyHandoffDirectRtspRelay({ ...eligible,
  recoveryStable: false,
  startedAt: now - DIRECT_RTSP_MINIMUM_OUTPUT_RESCUE_AGE_MS,
  lastOutputAt: now - DIRECT_RTSP_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS + 1 }, now), false);
assert.equal(shouldProactivelyHandoffDirectRtspRelay({ ...eligible,
  progressing: false }, now), false);
assert.equal(shouldProactivelyHandoffDirectRtspRelay({ ...eligible,
  recoveryStable: false, startedAt: now,
  lastOutputAt: now - DIRECT_RTSP_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS }, now), false);
assert.equal(shouldProactivelyHandoffDirectRtspRelay({ ...eligible,
  warming: true }, now), false);
assert.match(source, /async function maintainDirectRtspRelayHandoffs/);
assert.match(source, /source\?\.kind !== "rtsp"/);
assert.match(source, /warmReplaceDirectRtspRelay\(streamId, relay\)/);
assert.match(source, /async function warmReplaceRelay[\s\S]*relayIsProgressing\(replacement\)[\s\S]*relays\.set\(streamId, replacement\)[\s\S]*stopRelay\(streamId, previous, "WARM_HANDOFF"\)/);
const installer = readFileSync("scripts/qa/install-push38-homeqa-ota-agent.mjs", "utf8");
assert.match(installer, /--rtsp-session-recovery-upgrade/);
const phase = readFileSync("services/video-gateway/home-qa-transition-phase.mjs", "utf8");
assert.match(phase, new RegExp(PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.releaseId));
console.log(JSON.stringify({ result: "PASS", immutable_release: manifest.release_id,
  exact_device: true, broad_cohort_disabled: true, exact_predecessor_version: true,
  credentials_absent_from_child_argv_contract: true,
  direct_rtsp_proactive_handoff_ms: DIRECT_RTSP_PROACTIVE_RELAY_HANDOFF_MS,
  failed_warmup_preserves_current_relay: true }));
