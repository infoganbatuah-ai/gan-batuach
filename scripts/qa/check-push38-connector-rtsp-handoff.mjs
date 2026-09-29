import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPush38ConnectorRtspHandoffManifest as build,
  PUSH38_CONNECTOR_RTSP_HANDOFF_RECOVERY as item
} from "../../services/video-gateway/push38-home-qa-connector-rtsp-handoff.mjs";
import { DIRECT_RTSP_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS,
  DIRECT_RTSP_PROACTIVE_RELAY_HANDOFF_MS,
  shouldProactivelyHandoffDirectRtspRelay } from "../../services/video-gateway/rtsp-session-policy.mjs";

const manifest = build({ signingKeyId: "observer-kms-release-v1",
  artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
  releasedAt: new Date().toISOString() }).document;
assert.equal(manifest.release_id, item.releaseId);
assert.equal(manifest.version, "0.2.23-p38-health");
assert.equal(manifest.artifact_sha256, item.digest);
assert.equal(manifest.artifact_size, item.size);
assert.equal(manifest.build_sha, item.buildSha);
assert.deepEqual(manifest.rollout.explicit_device_ids, [item.deviceId]);
assert.equal(manifest.rollout.cohort_percent, 0);
assert.equal(manifest.release_id, "qa-p38-health-connector-rtsp-handoff-kg20-448381dc3792");
assert.equal(manifest.compatibility.minimum_current_version, "0.2.20-p38-health");
assert.equal(manifest.compatibility.maximum_current_version, "0.2.20-p38-health");
assert.equal(item.rollbackReleaseId, "qa-p38-health-connector-liveness-continuity-6efc70f798aa");
assert.equal(item.supersedesReleaseId, "qa-p38-health-connector-rtsp-handoff-448381dc3792");
assert.equal(DIRECT_RTSP_PROACTIVE_RELAY_HANDOFF_MS, 8 * 60 * 1000);
assert.equal(DIRECT_RTSP_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS, 4_000);
const now = Date.now();
const eligible = { progressing: true, recoveryStable: true, warming: false,
  startedAt: now - DIRECT_RTSP_PROACTIVE_RELAY_HANDOFF_MS };
assert.equal(shouldProactivelyHandoffDirectRtspRelay(eligible, now), true);
assert.equal(shouldProactivelyHandoffDirectRtspRelay({ ...eligible, warming: true }, now), false);
const server = readFileSync("services/video-gateway/server.mjs", "utf8");
assert.match(server, /async function maintainDirectRtspRelayHandoffs/);
assert.match(server, /relayIsProgressing\(replacement\)[\s\S]*relays\.set\(streamId, replacement\)[\s\S]*stopRelay\(streamId, previous, "WARM_HANDOFF"\)/);
for (const path of ["scripts/release/publish-push38-connector-pidfix-r2.mjs",
  "scripts/qa/install-push38-homeqa-ota-agent.mjs",
  "scripts/qa/register-push38-homeqa-connector-rtsp-session.mjs",
  "scripts/qa/activate-push38-homeqa-connector-rtsp-session.mjs",
  "scripts/qa/preflight-push38-homeqa-connector-liveness-agent.mjs"])
  assert.match(readFileSync(path, "utf8"), /rtsp-handoff/);
const phase = readFileSync("services/video-gateway/home-qa-transition-phase.mjs", "utf8");
assert.match(phase, new RegExp(item.releaseId));
const proxy = readFileSync("proxy.ts", "utf8");
for (const route of ["POST /api/digital-observer/gateway-enrollment",
  "GET /api/video-gateway/edge-updates", "POST /api/video-gateway/edge-updates/download"])
  assert.match(proxy, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.match(proxy, /if \(isPush38QualificationDeviceRoute\(request\)\)[\s\S]*NextResponse\.next\(\{ request \}\)[\s\S]*return response;[\s\S]*await updateSession\(request\)/);
console.log(JSON.stringify({ status: "PASS", release_id: item.releaseId,
  exact_device: true, broad_cohort: false, rollback: item.rollbackReleaseId,
  proactive_handoff_ms: DIRECT_RTSP_PROACTIVE_RELAY_HANDOFF_MS,
  failed_warmup_preserves_current_relay: true }));
