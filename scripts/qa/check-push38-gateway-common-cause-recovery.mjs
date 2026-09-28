import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildPush38GatewayCommonCauseRecoveryManifest,
  PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY } from
  "../../services/video-gateway/push38-home-qa-gateway-common-cause-recovery.mjs";
import { buildPush38GatewayFiniteStreamHandoffManifest,
  PUSH38_GATEWAY_FINITE_STREAM_HANDOFF } from
  "../../services/video-gateway/push38-home-qa-gateway-finite-stream-handoff.mjs";
import { PRIVATE_NVR_COMMON_CAUSE_HEARTBEAT_FAILURES,
  PRIVATE_NVR_PROACTIVE_IDLE_HANDOFF_MS, PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS,
  PRIVATE_NVR_PROACTIVE_RENEWAL_MS,
  PRIVATE_NVR_RELAY_HANDOFF_TICK_MS,
  relayMaySurvivePrivateNvrRenewal, shouldProactivelyHandoffPrivateNvrRelay,
  shouldPrioritizePrivateNvrSessionHandoff,
  shouldProactivelyRefreshPrivateNvrSession, shouldRefreshPrivateNvrSession } from
  "../../services/video-gateway/private-nvr-session-policy.mjs";

const installer = readFileSync("scripts/qa/install-push38-homeqa-ota-agent.mjs", "utf8");
const registration = readFileSync("scripts/qa/register-push38-homeqa-gateway-common-cause-recovery.mjs", "utf8");
const gateway = readFileSync("services/video-gateway/server.mjs", "utf8");
const installedAdapter = readFileSync("services/video-gateway/edge-macos-installed-adapter.mjs", "utf8");
const persistentInstaller = readFileSync("scripts/install-persistent-home-gateway.mjs", "utf8");
const activation = readFileSync("scripts/qa/activate-push38-homeqa-gateway-common-cause-recovery.mjs", "utf8");

test("Gateway common-cause recovery is an immutable exact-device release", () => {
  const manifest = buildPush38GatewayCommonCauseRecoveryManifest({ signingKeyId: "fixture-release-key",
    artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
    releasedAt: new Date().toISOString() }).document;
  assert.equal(manifest.release_id, PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.releaseId);
  assert.equal(manifest.artifact_sha256, PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.digest);
  assert.equal(manifest.artifact_size, PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.size);
  assert.equal(manifest.compatibility.minimum_current_version,
    PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.rollbackVersion);
  assert.equal(manifest.compatibility.maximum_current_version,
    PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.rollbackVersion);
  assert.equal(manifest.rollout.cohort_percent, 0);
  assert.deepEqual(manifest.rollout.explicit_device_ids,
    [PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.deviceId]);
});

test("Gateway finite-stream handoff is a new immutable release over signed 0.2.11", () => {
  const manifest = buildPush38GatewayFiniteStreamHandoffManifest({ signingKeyId: "fixture-release-key",
    artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
    releasedAt: new Date().toISOString() }).document;
  assert.equal(manifest.release_id, PUSH38_GATEWAY_FINITE_STREAM_HANDOFF.releaseId);
  assert.equal(manifest.version, "0.2.13-p38-health");
  assert.equal(manifest.artifact_sha256, PUSH38_GATEWAY_FINITE_STREAM_HANDOFF.digest);
  assert.equal(manifest.artifact_size, PUSH38_GATEWAY_FINITE_STREAM_HANDOFF.size);
  assert.equal(manifest.compatibility.minimum_current_version,
    PUSH38_GATEWAY_FINITE_STREAM_HANDOFF.rollbackVersion);
  assert.equal(manifest.compatibility.maximum_current_version,
    PUSH38_GATEWAY_FINITE_STREAM_HANDOFF.rollbackVersion);
  assert.equal(manifest.rollout.cohort_percent, 0);
  assert.deepEqual(manifest.rollout.explicit_device_ids,
    [PUSH38_GATEWAY_FINITE_STREAM_HANDOFF.deviceId]);
  assert.notEqual(PUSH38_GATEWAY_FINITE_STREAM_HANDOFF.releaseId,
    PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.releaseId);
});

test("only authentication rejection or corroborated common-cause loss may rotate the shared DVR session", () => {
  assert.equal(shouldRefreshPrivateNvrSession("authentication_rejected"), true);
  assert.equal(shouldRefreshPrivateNvrSession("source_not_media",
    { loginExclusivity: false, sessionAgeMs: Number.MAX_SAFE_INTEGER }), false);
  assert.equal(shouldRefreshPrivateNvrSession("source_not_media", {
    loginExclusivity: false, sessionAgeMs: Number.MAX_SAFE_INTEGER,
    heartbeatConsecutiveFailures: 3, commonCauseSourceFailures: 8
  }), true);
  assert.equal(shouldRefreshPrivateNvrSession("source_transport_error"), false);
});

test("heartbeat-maintained recorder login never rotates under progressing media", () => {
  const now = Date.now();
  const eligible = { loginExclusivity: false,
    updatedAt: now - PRIVATE_NVR_PROACTIVE_RENEWAL_MS };
  const idleAfterHeartbeatLoss = { activeProgressingRelays: 0,
    heartbeatConsecutiveFailures: PRIVATE_NVR_COMMON_CAUSE_HEARTBEAT_FAILURES };
  assert.equal(shouldProactivelyRefreshPrivateNvrSession(eligible,
    idleAfterHeartbeatLoss, now), true);
  assert.equal(shouldProactivelyRefreshPrivateNvrSession(eligible, {
    ...idleAfterHeartbeatLoss, activeProgressingRelays: 1
  }, now), false);
  assert.equal(shouldProactivelyRefreshPrivateNvrSession(eligible, {
    activeProgressingRelays: 0, heartbeatConsecutiveFailures: 0
  }, now), false);
  assert.equal(shouldProactivelyRefreshPrivateNvrSession({ ...eligible,
    loginExclusivity: true }, idleAfterHeartbeatLoss, now), false);
  assert.equal(shouldProactivelyRefreshPrivateNvrSession({ ...eligible,
    loginExclusivity: null }, idleAfterHeartbeatLoss, now), false);
  assert.equal(shouldProactivelyRefreshPrivateNvrSession({ ...eligible,
    updatedAt: now - PRIVATE_NVR_PROACTIVE_RENEWAL_MS + 1 },
  idleAfterHeartbeatLoss, now), false);
  assert.equal(shouldProactivelyRefreshPrivateNvrSession({ ...eligible,
    refreshPromise: Promise.resolve() }, idleAfterHeartbeatLoss, now), false);
  assert.match(gateway,
    /activeProgressingRelays[\s\S]*shouldProactivelyRefreshPrivateNvrSession\(session, \{[\s\S]*activeProgressingRelays,[\s\S]*heartbeatConsecutiveFailures/,
  "live renewal must be gated by media and heartbeat evidence");
});

test("proactive renewal preserves only progressing relays from the same recorder", () => {
  const priorRelay = { sameToken: false, sameSessionKey: true,
    relayProgressing: true, relayEpoch: 3, currentEpoch: 4,
    preserveRelayEpochsThrough: 3 };
  assert.equal(relayMaySurvivePrivateNvrRenewal(priorRelay), true);
  assert.equal(relayMaySurvivePrivateNvrRenewal({ ...priorRelay,
    relayProgressing: false }), false);
  assert.equal(relayMaySurvivePrivateNvrRenewal({ ...priorRelay,
    sameSessionKey: false }), false);
  assert.equal(relayMaySurvivePrivateNvrRenewal({ ...priorRelay,
    preserveRelayEpochsThrough: null }), false);
  assert.equal(relayMaySurvivePrivateNvrRenewal({ ...priorRelay,
    sameToken: true, sameSessionKey: false }), true);
});

test("finite recorder responses receive an early media-only warm handoff", () => {
  const now = Date.now();
  const eligible = { progressing: true, recoveryStable: true, warming: false,
    startedAt: now - PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS };
  assert.equal(PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS, 2 * 60 * 1000);
  assert.equal(shouldProactivelyHandoffPrivateNvrRelay(eligible, now), true);
  assert.equal(shouldProactivelyHandoffPrivateNvrRelay({ ...eligible,
    startedAt: now - PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS + 1 }, now), false);
  assert.equal(PRIVATE_NVR_PROACTIVE_IDLE_HANDOFF_MS, 12_000);
  assert.equal(shouldProactivelyHandoffPrivateNvrRelay({ ...eligible,
    startedAt: now - PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS + 1,
    lastInputAt: now - PRIVATE_NVR_PROACTIVE_IDLE_HANDOFF_MS }, now), true);
  assert.equal(shouldProactivelyHandoffPrivateNvrRelay({ ...eligible,
    startedAt: now - PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS + 1,
    lastInputAt: now - PRIVATE_NVR_PROACTIVE_IDLE_HANDOFF_MS + 1 }, now), false);
  assert.equal(shouldProactivelyHandoffPrivateNvrRelay({ ...eligible,
    progressing: false }, now), false);
  assert.equal(shouldProactivelyHandoffPrivateNvrRelay({ ...eligible,
    recoveryStable: false }, now), false);
  assert.equal(shouldProactivelyHandoffPrivateNvrRelay({ ...eligible,
    warming: true }, now), false);
  assert.match(gateway,
    /recorder's media response ends before[\s\S]*warmReplacePrivateNvrRelay/);
});

test("heartbeat, login renewal, and media handoffs use independent bounded schedulers", () => {
  assert.match(gateway, /privateNvrHeartbeatRun = privateNvrHeartbeat\.tick\(\)/);
  assert.match(gateway,
    /privateNvrSessionRenewalRun = maintainPrivateNvrSessionRenewals\(\)/);
  assert.match(gateway,
    /privateNvrRelayHandoffRun = maintainPrivateNvrRelayHandoffs\(\)/);
  assert.equal(PRIVATE_NVR_RELAY_HANDOFF_TICK_MS, 2_000);
  assert.ok(PRIVATE_NVR_RELAY_HANDOFF_TICK_MS * 16 < 50_000,
    "a one-at-a-time full recorder sweep must fit inside the observed prior-login overlap");
  assert.match(gateway,
    /\}, PRIVATE_NVR_RELAY_HANDOFF_TICK_MS\)\.unref\(\)/);
  assert.equal(shouldPrioritizePrivateNvrSessionHandoff({ relayEpoch: 3,
    currentEpoch: 4 }), true);
  assert.equal(shouldPrioritizePrivateNvrSessionHandoff({ relayEpoch: 4,
    currentEpoch: 4 }), false);
  assert.match(gateway,
    /if \(sessionSweep\.length\)[\s\S]*for \(const \[streamId, relay\] of sessionSweep\)[\s\S]*await warmReplacePrivateNvrRelay\(streamId, relay\)/,
    "a renewed-session sweep drains stale epochs without scheduler gaps");
  assert.match(gateway,
    /const \[streamId, relay\] = routine\[0\][\s\S]*await warmReplacePrivateNvrRelay\(streamId, relay\)/,
    "ordinary finite-response maintenance remains one-at-a-time");
  assert.doesNotMatch(gateway,
    /maintainPrivateNvrSessionRenewals[\s\S]{0,1000}warmReplacePrivateNvrRelays/,
    "a slow media sweep must not block heartbeat or login renewal");
  assert.match(gateway,
    /!relayIsProgressing\(previous\)[\s\S]*!relayRecoveryIsStable\(previous\)/,
    "a newly recovered relay must become stable before another warm handoff");
  assert.match(gateway, /startRelay\(streamId, \{ warming: true, previousRelay: previous \}\)/);
  assert.match(gateway, /relayLifecycle\.warmHandoffs/);
  assert.match(gateway, /previousDirectories/);
  assert.match(gateway, /"-start_number", String\(firstEvidenceSequence\)/);
  assert.match(gateway, /function readEvidenceSegment[\s\S]*relay\.previousDirectories/);
});

test("the supervised Site Edge prevents idle sleep for its exact lifetime", () => {
  for (const source of [installedAdapter, persistentInstaller]) {
    assert.match(source, /\/usr\/bin\/caffeinate/);
    for (const option of ["-i", "-m", "-s"]) {
      assert.equal(source.includes(`"${option}"`) || source.includes(`<string>${option}</string>`), true);
    }
  }
  assert.doesNotMatch(installedAdapter, /CAFFEINATE_OPTIONS = \[[^\]]*"-d"/);
});

test("managed crash-loop supervision tracks the launchd service PID, not workload children", () => {
  assert.match(installedAdapter,
    /resolve\(runner\)\.startsWith\(`\$\{join\(root, "slots"\)\}\/`\)[\s\S]*return owner\.pid/);
  assert.doesNotMatch(installedAdapter,
    /source\.ProgramArguments\?\.\[0\] !== CAFFEINATE_PATH[\s\S]*ppid === owner\.pid/);
});

test("common-cause recovery is pinned to the signed 0.2.11 known-good release", () => {
  assert.match(installer, /--gateway-common-cause-recovery-upgrade/);
  assert.match(installer, /qa-p38-health-gateway-common-cause-189e548bc104/);
  assert.match(installer, /qa-p38-health-gateway-session-e354546bdbf8/);
  assert.match(installer, /e354546bdbf8a222f98b9af5166de1b91ee353ff7d5e54111b4c5c931901cd0a/);
});

test("finite-stream handoff upgrades management and remains pinned to signed 0.2.11", () => {
  assert.match(installer, /--gateway-finite-stream-handoff-upgrade/);
  assert.match(installer, /qa-p38-health-gateway-finite-handoff-76781a8e0832/);
  assert.match(installer, /qa-p38-health-gateway-session-e354546bdbf8/);
  assert.match(installer, /qa-p38-health-gateway-common-cause-189e548bc104/);
  assert.match(installer, /189e548bc10428ac49615fd2e9f6da60553df24e9da960db9afe40678c15b6eb/);
  assert.match(activation, /FINITE_STREAM_COMMON_CAUSE_SHADOW_QUALIFIED/);
  assert.match(activation, /P38_GATEWAY_FINITE_HANDOFF_SHADOW_EVIDENCE_REQUIRED/);
  assert.match(activation, /warmHandoffFailures/);
});

test("registration requires verified managed identity and disables broad cohorts", () => {
  assert.match(registration, /MANAGED_IDENTITY_VERIFIED/);
  assert.match(registration, /cohort_percent<>0/);
  assert.match(registration, /deployment_profile='PHYSICAL_GATEWAY'/);
  assert.match(registration, /runtime_writes: 0/);
});
