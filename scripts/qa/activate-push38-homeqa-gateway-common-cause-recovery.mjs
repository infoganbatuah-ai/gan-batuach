// Activate the exact AWS-signed Gateway common-cause recovery remediation only
// after a protected, pinned preflight. The installed OTA agent remains the
// sole downloader/installer and signed 0.2.11 remains the rollback target.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { chmodSync, existsSync, lstatSync, readFileSync, realpathSync, statfsSync,
  statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl } from "../../services/video-gateway/edge-release-object.mjs";
import { loadPinnedEdgeReleaseKeys,
  PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY
} from "../../services/video-gateway/push38-home-qa-gateway-common-cause-recovery.mjs";
import { PUSH38_GATEWAY_FINITE_STREAM_HANDOFF
} from "../../services/video-gateway/push38-home-qa-gateway-finite-stream-handoff.mjs";
import { PUSH38_GATEWAY_SUPERVISOR_RECOVERY
} from "../../services/video-gateway/push38-home-qa-gateway-supervisor-recovery.mjs";
import { PUSH38_GATEWAY_STABLE_HANDOFF
} from "../../services/video-gateway/push38-home-qa-gateway-stable-handoff.mjs";
import { PUSH38_GATEWAY_MEDIA_CADENCE
} from "../../services/video-gateway/push38-home-qa-gateway-media-cadence.mjs";
import { PUSH38_GATEWAY_MAINTENANCE_ISOLATION
} from "../../services/video-gateway/push38-home-qa-gateway-maintenance-isolation.mjs";
import { PUSH38_GATEWAY_SESSION_SWEEP
} from "../../services/video-gateway/push38-home-qa-gateway-session-sweep.mjs";
import { PUSH38_GATEWAY_HEARTBEAT_LOGIN
} from "../../services/video-gateway/push38-home-qa-gateway-heartbeat-login.mjs";
import { PUSH38_GATEWAY_IDLE_HANDOFF
} from "../../services/video-gateway/push38-home-qa-gateway-idle-handoff.mjs";
import { PUSH38_GATEWAY_BUFFERED_OUTPUT
} from "../../services/video-gateway/push38-home-qa-gateway-buffered-output.mjs";
import { PUSH38_GATEWAY_OUTPUT_RESCUE
} from "../../services/video-gateway/push38-home-qa-gateway-output-rescue.mjs";
import { PUSH38_GATEWAY_CONFIRMED_HANDOFF
} from "../../services/video-gateway/push38-home-qa-gateway-confirmed-handoff.mjs";
import { PUSH38_GATEWAY_STARTUP_WINDOW
} from "../../services/video-gateway/push38-home-qa-gateway-startup-window.mjs";
import { PUSH38_GATEWAY_HANDOFF_PROBATION
} from "../../services/video-gateway/push38-home-qa-gateway-handoff-probation.mjs";
import { PUSH38_GATEWAY_RETAINED_FALLBACK
} from "../../services/video-gateway/push38-home-qa-gateway-retained-fallback.mjs";
import { PUSH38_GATEWAY_CONTINUOUS_HANDOFF
} from "../../services/video-gateway/push38-home-qa-gateway-continuous-handoff.mjs";
import { PUSH38_GATEWAY_ROUTINE_PROVISIONAL
} from "../../services/video-gateway/push38-home-qa-gateway-routine-provisional.mjs";
import { PUSH38_CONNECTOR_RESTART_GRACE_RECOVERY as connectorRestartGraceItem
} from "../../services/video-gateway/push38-home-qa-connector-restart-grace.mjs";
import { PUSH38_CONNECTOR_LIVENESS_CONTINUITY as connectorLivenessContinuityItem
} from "../../services/video-gateway/push38-home-qa-connector-liveness-continuity.mjs";
import { PUSH38_CONNECTOR_HEALTH_OBSERVATION_RECOVERY as connectorHealthObservationItem
} from "../../services/video-gateway/push38-home-qa-connector-health-observation.mjs";
import { PUSH38_CONNECTOR_RTSP_CADENCE as connectorRtspCadenceItem
} from "../../services/video-gateway/push38-home-qa-connector-rtsp-cadence.mjs";
import { PUSH38_CONNECTOR_FINAL_STABILITY as connectorFinalStabilityItem
} from "../../services/video-gateway/push38-home-qa-connector-final-stability.mjs";
import { PUSH38_CONNECTOR_OUTPUT_RESCUE as connectorOutputRescueItem
} from "../../services/video-gateway/push38-home-qa-connector-output-rescue.mjs";

const root = join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota");
const connectorRoot = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const configPath = join(root, "agent-config.json");
const agentReleasePath = join(root, "agent/agent-release.json");
const restrictedRoot = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const finiteHandoff = process.argv.includes("--finite-stream-handoff");
const supervisorRecovery = process.argv.includes("--supervisor-recovery");
const stableHandoff = process.argv.includes("--stable-handoff");
const mediaCadence = process.argv.includes("--media-cadence");
const maintenanceIsolation = process.argv.includes("--maintenance-isolation");
const sessionSweep = process.argv.includes("--session-sweep");
const heartbeatLogin = process.argv.includes("--heartbeat-login");
const idleHandoff = process.argv.includes("--idle-handoff");
const bufferedOutput = process.argv.includes("--buffered-output");
const outputRescue = process.argv.includes("--output-rescue");
const confirmedHandoff = process.argv.includes("--confirmed-handoff");
const startupWindow = process.argv.includes("--startup-window");
const handoffProbation = process.argv.includes("--handoff-probation");
const retainedFallback = process.argv.includes("--retained-fallback");
const continuousHandoff = process.argv.includes("--continuous-handoff");
const routineProvisional = process.argv.includes("--routine-provisional");
if ([finiteHandoff, supervisorRecovery, stableHandoff, mediaCadence, maintenanceIsolation, sessionSweep,
  heartbeatLogin, idleHandoff, bufferedOutput, outputRescue, confirmedHandoff, startupWindow,
  handoffProbation, retainedFallback, continuousHandoff, routineProvisional]
  .filter(Boolean).length > 1)
  throw new Error("P38_GATEWAY_COMMON_CAUSE_MODE_INVALID");
const item = routineProvisional ? PUSH38_GATEWAY_ROUTINE_PROVISIONAL :
  continuousHandoff ? PUSH38_GATEWAY_CONTINUOUS_HANDOFF :
  retainedFallback ? PUSH38_GATEWAY_RETAINED_FALLBACK :
  handoffProbation ? PUSH38_GATEWAY_HANDOFF_PROBATION :
  startupWindow ? PUSH38_GATEWAY_STARTUP_WINDOW :
  confirmedHandoff ? PUSH38_GATEWAY_CONFIRMED_HANDOFF :
  outputRescue ? PUSH38_GATEWAY_OUTPUT_RESCUE :
  bufferedOutput ? PUSH38_GATEWAY_BUFFERED_OUTPUT :
  idleHandoff ? PUSH38_GATEWAY_IDLE_HANDOFF :
  heartbeatLogin ? PUSH38_GATEWAY_HEARTBEAT_LOGIN :
  sessionSweep ? PUSH38_GATEWAY_SESSION_SWEEP :
  maintenanceIsolation ? PUSH38_GATEWAY_MAINTENANCE_ISOLATION :
  mediaCadence ? PUSH38_GATEWAY_MEDIA_CADENCE :
  stableHandoff ? PUSH38_GATEWAY_STABLE_HANDOFF :
  supervisorRecovery ? PUSH38_GATEWAY_SUPERVISOR_RECOVERY :
  finiteHandoff ? PUSH38_GATEWAY_FINITE_STREAM_HANDOFF : PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY;
const connectorItem = (outputRescue || confirmedHandoff || startupWindow || handoffProbation || retainedFallback || continuousHandoff || routineProvisional)
  ? connectorOutputRescueItem :
  bufferedOutput ? connectorFinalStabilityItem :
  idleHandoff ? connectorRtspCadenceItem :
  heartbeatLogin ? connectorLivenessContinuityItem :
  sessionSweep ? connectorHealthObservationItem : connectorRestartGraceItem;
const predecessorReleaseId = (finiteHandoff || supervisorRecovery || stableHandoff || mediaCadence || maintenanceIsolation || sessionSweep || heartbeatLogin || idleHandoff || bufferedOutput || outputRescue || confirmedHandoff || startupWindow || handoffProbation || retainedFallback || continuousHandoff || routineProvisional)
  ? item.supersedesReleaseId : item.rollbackReleaseId;
const bundleValue = option("bundle");
if (!bundleValue) throw new Error("P38_GATEWAY_COMMON_CAUSE_BUNDLE_REQUIRED");
const bundle = resolve(bundleValue);
const artifact = routineProvisional
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-routine-provisional-167ad231/gateway-runtime.tar.gz"
  : continuousHandoff
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-continuous-handoff-4a63f881/gateway-runtime.tar.gz"
  : retainedFallback
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-retained-fallback-8f380af2/gateway-runtime.tar.gz"
  : handoffProbation
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-handoff-probation-06038e9a/gateway-runtime.tar.gz"
  : startupWindow
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-startup-window-4a3d3e39/gateway-runtime.tar.gz"
  : confirmedHandoff
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-confirmed-handoff-ab855c89/gateway-runtime.tar.gz"
  : outputRescue
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-output-rescue-9658853d/gateway-runtime.tar.gz"
  : bufferedOutput
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-buffered-output-fcd1ee80/gateway-runtime.tar.gz"
  : idleHandoff
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-idle-handoff-d63a53bd/gateway-runtime.tar.gz"
  : heartbeatLogin
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-heartbeat-login-6d515326/gateway-runtime.tar.gz"
  : sessionSweep
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-session-drain-6bf33d4b/gateway-runtime.tar.gz"
  : maintenanceIsolation
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-maintenance-isolation-04c58f24/gateway-runtime.tar.gz"
  : mediaCadence
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-media-cadence-f41715f9/gateway-runtime.tar.gz"
  : stableHandoff
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-stable-handoff-a7bd4c75/gateway-runtime.tar.gz"
  : supervisorRecovery
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-supervisor-recovery-4324fa11/gateway-runtime.tar.gz"
  : finiteHandoff
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-finite-handoff-e085c30f/gateway-runtime.tar.gz"
  : "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-common-cause-f7d237bf/gateway-runtime.tar.gz";
const publication = routineProvisional
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-routine-provisional-167ad231/r2-publication.json"
  : continuousHandoff
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-continuous-handoff-4a63f881/r2-publication.json"
  : retainedFallback
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-retained-fallback-8f380af2/r2-publication.json"
  : handoffProbation
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-handoff-probation-06038e9a/r2-publication.json"
  : startupWindow
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-startup-window-4a3d3e39/r2-publication.json"
  : confirmedHandoff
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-confirmed-handoff-ab855c89/r2-publication.json"
  : outputRescue
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-output-rescue-9658853d/r2-publication.json"
  : bufferedOutput
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-buffered-output-fcd1ee80/r2-publication.json"
  : idleHandoff
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-idle-handoff-d63a53bd/r2-publication.json"
  : heartbeatLogin
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-heartbeat-login-6d515326/r2-publication.json"
  : sessionSweep
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-session-drain-6bf33d4b/r2-publication.json"
  : maintenanceIsolation
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-maintenance-isolation-04c58f24/r2-publication.json"
  : mediaCadence
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-media-cadence-f41715f9/r2-publication.json"
  : stableHandoff
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-stable-handoff-a7bd4c75/r2-publication.json"
  : supervisorRecovery
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-supervisor-recovery-4324fa11/r2-publication.json"
  : finiteHandoff
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-finite-handoff-e085c30f/r2-publication.json"
  : "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-gateway-common-cause-f7d237bf/r2-publication.json";
const mode = process.argv.includes("--preflight") ? "PREFLIGHT" : process.argv.includes("--apply") ? "APPLY" : "";
const outputPath = resolve(option("output") || ".");
const planPath = option("plan") ? resolve(option("plan")) : "";
const planSha = option("plan-sha256");
const shadowEvidencePath = option("shadow-evidence") ? resolve(option("shadow-evidence")) : "";
const failedCanaryEvidencePath = option("failed-canary-evidence") ? resolve(option("failed-canary-evidence")) : "";
const failedPreSoakEvidencePath = option("failed-pre-soak-evidence")
  ? resolve(option("failed-pre-soak-evidence")) : "";
const warmHandoffEvidencePath =
  "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-dvr-warm-handoff-shadow-20260924T003032Z.json";
if (!mode || outputPath === resolve(".") || !outputPath.startsWith(restrictedRoot) || existsSync(outputPath))
  throw new Error("P38_GATEWAY_COMMON_CAUSE_MODE_OR_OUTPUT_INVALID");

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function protectedFile(path) {
  if (!path || !existsSync(path) || !realpathSync(path).startsWith(restrictedRoot) ||
    lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() || (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_GATEWAY_COMMON_CAUSE_PROTECTED_EVIDENCE_REQUIRED");
  return readFileSync(path);
}
function protectedLocalFile(path) {
  if (!path || !existsSync(path) || lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() ||
    realpathSync(path) !== resolve(path) || (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_GATEWAY_COMMON_CAUSE_LOCAL_FILE_UNSAFE");
  return readFileSync(path);
}
function persist(value) {
  writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  chmodSync(outputPath, 0o600);
  return sha(readFileSync(outputPath));
}
function docker(args, input) {
  return execFileSync("docker", ["--context", "colima-push38t", ...args], {
    encoding: "utf8", timeout: 45_000, input,
    stdio: [input ? "pipe" : "ignore", "pipe", "pipe"]
  }).trim();
}
function psql(sql) {
  return docker(["exec", "supabase_db_gan-batuach-push38t", "psql", "-X", "-A", "-t",
    "-U", "postgres", "-d", "postgres", "-c", sql]);
}
function service(label) {
  const text = execFileSync("/bin/launchctl", ["print", `gui/${process.getuid()}/${label}`],
    { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
  return { running: text.includes("state = running"),
    pid: Number(/\bpid = (\d+)/.exec(text)?.[1] || 0) || null };
}
function tlsProbe(path) {
  return new Promise((accept, reject) => {
    const req = httpsRequest({ hostname: "127.0.0.1", port: 3101, path, method: "GET",
      ca: readFileSync(config.qaTlsCaPath), rejectUnauthorized: true, timeout: 8_000 }, response => {
      response.resume(); response.on("end", () => accept(response.statusCode));
    });
    req.on("timeout", () => req.destroy(new Error("P38_GATEWAY_COMMON_CAUSE_TLS_TIMEOUT")));
    req.on("error", reject); req.end();
  });
}
async function healthSample(port, label) {
  const live = service(label);
  const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error("P38_GATEWAY_COMMON_CAUSE_RUNTIME_UNAVAILABLE");
  const health = await response.json();
  return { pid: live.pid, running: live.running, ok: health.ok === true,
    status: health.status || null, assigned: health.lastDiscovery?.assignedCount ??
      health.lastDiscovery?.channelCount ?? null, connected: health.lastDiscovery?.connectedCount ?? null,
    failed: health.lastDiscovery?.failedAssignedCount ?? null,
    empty: health.lastDiscovery?.unassignedCount ?? null,
    progressing: health.mediaHeartbeat?.progressingRelays ?? null,
    stalled: health.mediaHeartbeat?.stalledRelays ?? null,
    rotations: health.recorderSessionLifecycle?.rotations ?? null,
    last_rotation_reason: health.recorderSessionLifecycle?.last_rotation_reason ?? null };
}

function verifiedShadowEvidence(path, { recent = false, warmHandoff = false,
  confirmedWarmHandoff = false, verifyPlaybackRenewals = false, boundedWarmupFailure = false,
  expectedRelease = null, expectedChannel = 1 } = {}) {
  const value = JSON.parse(protectedFile(path));
  const checkpoints = Array.isArray(value.checkpoints) ? value.checkpoints : [];
  const endedAt = Date.parse(value.ended_at || "");
  const streamProof = checkpoints.length >= (warmHandoff ? 20 : 4) && checkpoints.every(point =>
    point.shadow?.http === 200 && point.shadow?.discovery?.assigned === 1 &&
    point.shadow?.discovery?.connected === 1 && point.shadow?.discovery?.failed === 0 &&
    point.shadow?.media?.progressing === 1 && point.shadow?.media?.stalled === 0);
  const renewals = checkpoints.map(point => point.renewal).filter(Boolean);
  const playbackProof = !verifyPlaybackRenewals || renewals.length >= Math.floor(checkpoints.length / 2) &&
    renewals.every(renewal => renewal.status === 200 && renewal.playlist_status === 200 &&
      renewal.segment_status === 200 && renewal.segment_bytes > 0);
  const lifecycle = checkpoints.at(-1)?.shadow?.media?.lifecycle || {};
  // A failed warmup is not a media outage when the authoritative relay stays
  // current and the next bounded attempt succeeds. The continuous-handoff
  // proof permits exactly one such contained retry, but still rejects every
  // missing checkpoint, playback failure, request-time stale teardown, socket
  // error, or unbounded failure count.
  const boundedFailureProof = !boundedWarmupFailure ||
    lifecycle.warmHandoffFailures <= 1 &&
    lifecycle.warmHandoffConfirmationFailures === lifecycle.warmHandoffFailures &&
    lifecycle.warmHandoffs >= 1 && lifecycle.staleOnRequest === 0 &&
    lifecycle.inputSocketError === 0;
  if (value.contract !== "observer-push38-bounded-dvr-shadow-v1" || value.result !== "PASS" ||
    value.mode !== "READ_ONLY_ONE_CHANNEL_SHADOW" || value.channel !== expectedChannel ||
    value.endpoint_redacted !== true || value.credentials_recorded !== false ||
    value.cloud_access_enabled !== false || value.runtime_mutation !== false ||
    (expectedRelease && (value.signed_release?.release_id !== expectedRelease.releaseId ||
      value.signed_release?.artifact_sha256 !== expectedRelease.digest ||
      value.signed_release?.signature_verified !== true || value.signed_release?.artifact_verified !== true)) ||
    !Number.isFinite(value.duration_ms) || value.duration_ms < (warmHandoff ? 6 * 60_000 : 60_000) ||
    !Number.isFinite(endedAt) || (recent && (endedAt > Date.now() || Date.now() - endedAt > 10 * 60_000)) ||
    !streamProof || !playbackProof || !boundedFailureProof || (warmHandoff &&
      (lifecycle.warmHandoffs < 1 ||
        !boundedWarmupFailure && lifecycle.warmHandoffFailures !== 0)) ||
    (confirmedWarmHandoff &&
      lifecycle.warmHandoffConfirmationFailures !== 0))
    throw new Error("P38_GATEWAY_FINITE_HANDOFF_SHADOW_EVIDENCE_INVALID");
  return { sha256: sha(protectedFile(path)), ended_at: value.ended_at,
    duration_ms: value.duration_ms, checkpoints: checkpoints.length };
}

for (const path of [bundle, artifact, publication]) protectedFile(path);
const config = JSON.parse(protectedLocalFile(configPath).toString("utf8"));
if (config.profile !== item.profile || config.deviceId !== item.deviceId || config.channel !== "HOME_QA" ||
  config.managedRoot !== root || config.port !== 18082 || config.configVersion !== 1 ||
  !config.secretDir || !config.qaTlsCaPath || !/^[a-f0-9]{64}$/.test(config.qaTlsCaSha256 || ""))
  throw new Error("P38_GATEWAY_COMMON_CAUSE_CONFIG_MISMATCH");
if (sha(protectedLocalFile(config.qaTlsCaPath)) !== config.qaTlsCaSha256)
  throw new Error("P38_GATEWAY_COMMON_CAUSE_TLS_PIN_MISMATCH");
const agentRelease = JSON.parse(protectedLocalFile(agentReleasePath));
const expectedAgentReleaseId = (idleHandoff || bufferedOutput || outputRescue || confirmedHandoff)
  ? item.agentPredecessorReleaseId : item.releaseId;
const expectedAgentDigest = (idleHandoff || bufferedOutput || outputRescue || confirmedHandoff)
  ? item.priorManagementArtifactSha256 : item.digest;
if (agentRelease.release_id !== expectedAgentReleaseId || agentRelease.artifact_sha256 !== expectedAgentDigest)
  throw new Error("P38_GATEWAY_COMMON_CAUSE_AGENT_RELEASE_MISMATCH");

const manifest = JSON.parse(execFileSync("unzip", ["-p", bundle,
  routineProvisional ? "gateway_remediation_routine_provisional.json" :
  continuousHandoff ? "gateway_remediation_continuous_handoff.json" :
  retainedFallback ? "gateway_remediation_retained_fallback.json" :
  handoffProbation ? "gateway_remediation_handoff_probation.json" :
  startupWindow ? "gateway_remediation_startup_window.json" :
  confirmedHandoff ? "gateway_remediation_confirmed_handoff.json" :
  outputRescue ? "gateway_remediation_output_rescue.json" :
  bufferedOutput ? "gateway_remediation_buffered_output.json" :
  idleHandoff ? "gateway_remediation_idle_handoff.json" :
  heartbeatLogin ? "gateway_remediation_heartbeat_login.json" :
  sessionSweep ? "gateway_remediation_session_sweep.json" :
  maintenanceIsolation ? "gateway_remediation_maintenance_isolation.json" :
  mediaCadence ? "gateway_remediation_media_cadence.json" :
  stableHandoff ? "gateway_remediation_stable_handoff.json" :
    supervisorRecovery ? "gateway_remediation_supervisor_recovery.json" :
    finiteHandoff ? "gateway_remediation_finite_stream_handoff.json" :
    "gateway_remediation_common_cause_recovery.json"],
{ encoding: "utf8", timeout: 15_000, maxBuffer: 16_384 }));
const trusted = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const publicationProof = JSON.parse(readFileSync(publication, "utf8"));
const expectedObject = `home-qa/${item.releaseId}/${item.digest}.tar.gz`;
if (!verifyEdgeUpdateManifest(manifest, trusted).ok || manifest.release_id !== item.releaseId ||
  manifest.version !== item.version || manifest.build_sha !== item.buildSha ||
  manifest.artifact_sha256 !== item.digest || manifest.artifact_size !== item.size ||
  manifest.profile !== item.profile || manifest.channel !== "HOME_QA" ||
  JSON.stringify(manifest.rollout?.explicit_device_ids) !== JSON.stringify([item.deviceId]) ||
  manifest.rollout?.cohort_percent !== 0 || manifest.signing_key_id !== "observer-kms-release-v1" ||
  manifest.compatibility?.minimum_current_version !== item.rollbackVersion ||
  manifest.compatibility?.maximum_current_version !== item.rollbackVersion ||
  assertEdgeReleaseObjectUrl(manifest,
    "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com") !== expectedObject ||
  statSync(artifact).size !== item.size || sha(readFileSync(artifact)) !== item.digest ||
  publicationProof.release_id !== item.releaseId || publicationProof.object_key !== expectedObject ||
  publicationProof.artifact_sha256 !== item.digest || publicationProof.bytes !== item.size ||
  publicationProof.round_trip !== "PASS" || publicationProof.anonymous_access_denied !== true)
  throw new Error("P38_GATEWAY_COMMON_CAUSE_RELEASE_INVALID");

const labels = JSON.parse(docker(["inspect", "--format", "{{json .Config.Labels}}",
  "supabase_db_gan-batuach-push38t"]));
const network = docker(["network", "inspect", "push38t-loopback", "--format",
  "{{index .Options \"com.docker.network.bridge.host_binding_ipv4\"}}"]).trim();
if (labels["com.supabase.cli.project"] !== "gan-batuach-push38t" || network !== "127.0.0.1")
  throw new Error("P38_GATEWAY_COMMON_CAUSE_DATABASE_NOT_ISOLATED");

const manager = new EdgeUpdateManager({ root, trustedPublicKeys: trusted,
  device: { deviceId: item.deviceId, profile: item.profile, platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: item.rollbackVersion,
    configVersion: 1, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
const current = manager.current(), knownGood = manager.knownGood();
if (current.release_id !== item.rollbackReleaseId ||
  !knownGood.some(entry => entry.release_id === item.rollbackReleaseId &&
    entry.artifact_sha256 === current.artifact_sha256) ||
  manager.quarantine().some(entry => entry.release_id === item.releaseId))
  throw new Error("P38_GATEWAY_COMMON_CAUSE_ROLLBACK_STATE_INVALID");
manager.verifySlot(current);

const connectorManager = new EdgeUpdateManager({ root: connectorRoot, trustedPublicKeys: trusted,
  device: { deviceId: connectorItem.deviceId, profile: connectorItem.profile, platform: "darwin",
    architecture: "arm64", channel: "HOME_QA", currentVersion: connectorItem.version,
    configVersion: 4, revoked: false }, adapter: {}, healthCheck: async () => ({}) });
const connectorCurrent = connectorManager.current();
if (connectorCurrent.release_id !== connectorItem.releaseId ||
  connectorCurrent.artifact_sha256 !== connectorItem.digest ||
  !connectorManager.knownGood().some(entry => entry.release_id === connectorItem.releaseId))
  throw new Error("P38_GATEWAY_COMMON_CAUSE_CONNECTOR_PREREQUISITE_INVALID");
connectorManager.verifySlot(connectorCurrent);

const rollout = JSON.parse(psql(`select jsonb_build_object(
  'devices',(select count(*) from public.video_gateway_device_enrollments),
  'releases',(select count(*) from public.observer_edge_releases where channel='HOME_QA'),
  'new_status',(select o.status from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${item.releaseId}'),
  'new_cohort',(select o.cohort_percent from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${item.releaseId}'),
  'new_targets',(select o.target_filters from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${item.releaseId}'),
  'prior_status',(select o.status from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${predecessorReleaseId}'),
  'prior_cohort',(select o.cohort_percent from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${predecessorReleaseId}'),
  'prior_targets',(select o.target_filters from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id where r.release_id='${predecessorReleaseId}'),
  'broad_active',(select count(*) from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0),
  'managed_phase',(select metadata->>'home_qa_phase' from public.video_gateway_device_enrollments where gateway_id='${item.deviceId}'),
  'managed_identity',(select identity_scheme from public.video_gateway_device_enrollments where gateway_id='${item.deviceId}'),
  'fresh_proof',(select count(*) from public.video_gateway_device_enrollments e join public.observer_managed_device_credentials c on c.enrollment_id=e.id and c.credential_version=e.credential_version where e.gateway_id='${item.deviceId}' and e.lifecycle_state='ACTIVE' and e.status='delivered' and e.active_runtime_instance_id is not null and e.last_seen_at>=now()-interval '2 minutes' and exists(select 1 from public.observer_managed_device_auth_nonces n where n.enrollment_id=e.id and n.credential_version=e.credential_version and n.observed_at>=now()-interval '2 minutes')));`));
// The Connector restart-grace successor is a separately signed, exact-device
// HOME_QA release registered after the Gateway maintenance-isolation release.
// Count it in the cumulative inventory without changing Gateway eligibility.
const exactTargets = { explicit_device_ids: [item.deviceId] };
const normalHandoffState = rollout.new_status === "DRAFT" && rollout.prior_status === "PAUSED";
const activeBridgeHandoffState = heartbeatLogin && rollout.new_status === "PAUSED" &&
  rollout.prior_status === "ACTIVE" && rollout.prior_cohort === 0 &&
  JSON.stringify(rollout.prior_targets) === JSON.stringify(exactTargets);
if (rollout.devices !== 2 || rollout.releases !== (routineProvisional ? 40 : continuousHandoff ? 39 : retainedFallback ? 38 : handoffProbation ? 37 : startupWindow ? 36 : confirmedHandoff ? 35 : outputRescue ? 34 : bufferedOutput ? 32 : idleHandoff ? 31 : heartbeatLogin ? 28 : sessionSweep ? 27 : maintenanceIsolation ? 22 : mediaCadence ? 20 : stableHandoff ? 19 : supervisorRecovery ? 17 : finiteHandoff ? 15 : 12) ||
  (!normalHandoffState && !activeBridgeHandoffState) ||
  rollout.new_cohort !== 0 ||
  JSON.stringify(rollout.new_targets) !== JSON.stringify(exactTargets) || rollout.broad_active !== 0 ||
  rollout.managed_phase !== "MANAGED_IDENTITY_VERIFIED" || rollout.managed_identity !== "ED25519_V1" ||
  rollout.fresh_proof !== 1)
  throw new Error("P38_GATEWAY_COMMON_CAUSE_HOME_QA_STATE_INVALID");

const gatewayService = service("com.ganbatuach.video-gateway");
const gatewayAgent = service("com.ganbatuach.video-gateway.ota-agent");
const connectorService = service("com.ganbatuach.software-connector.tapo");
if (!gatewayService.running || !gatewayService.pid || !gatewayAgent.running || !gatewayAgent.pid ||
  !connectorService.running || !connectorService.pid)
  throw new Error("P38_GATEWAY_COMMON_CAUSE_SERVICE_MANAGER_INVALID");
const gatewaySamples = [], connectorSamples = [];
for (let index = 0; index < 3; index += 1) {
  gatewaySamples.push(await healthSample(18082, "com.ganbatuach.video-gateway"));
  connectorSamples.push(await healthSample(18083, "com.ganbatuach.software-connector.tapo"));
  if (index < 2) await new Promise(resolveWait => setTimeout(resolveWait, 2_000));
}
const gatewayPidStable = gatewaySamples.every(sample => sample.running && sample.pid) &&
  new Set(gatewaySamples.map(sample => sample.pid)).size === 1;
const expectsNineSources = stableHandoff || mediaCadence || maintenanceIsolation || sessionSweep ||
  heartbeatLogin || idleHandoff || bufferedOutput || outputRescue || handoffProbation || retainedFallback || continuousHandoff || routineProvisional;
const normalRuntimeTruth = gatewaySamples.every(sample => sample.status === "degraded" || sample.status === "healthy") &&
  gatewaySamples.every(sample =>
    sample.assigned === 10 && sample.connected === (expectsNineSources ? 9 : 8) &&
    sample.failed === (expectsNineSources ? 1 : 2) && sample.empty === 6 &&
    sample.progressing === (expectsNineSources ? 9 : 8) && sample.stalled === 0);
const idleHandoffTargetTruth = idleHandoff && gatewaySamples.every(sample =>
  (sample.status === "degraded" || sample.status === "healthy") && sample.assigned === 10 &&
  sample.connected === 9 && sample.failed === 1 && sample.empty === 6 &&
  Number.isInteger(sample.progressing) && sample.progressing >= 7 && sample.progressing <= 9 &&
  Number.isInteger(sample.stalled) && sample.stalled >= 0 && sample.stalled <= 2 &&
  sample.rotations === 0);
const bufferedOutputTargetTruth = bufferedOutput && gatewaySamples.every(sample =>
  (sample.status === "degraded" || sample.status === "healthy") && sample.assigned === 10 &&
  sample.connected === 9 && sample.failed === 1 && sample.empty === 6 &&
  Number.isInteger(sample.progressing) && sample.progressing >= 7 && sample.progressing <= 9 &&
  Number.isInteger(sample.stalled) && sample.stalled >= 0 && sample.stalled <= 2 &&
  sample.rotations === 0);
const outputRescueTargetTruth = outputRescue && gatewaySamples.every(sample =>
  (sample.status === "degraded" || sample.status === "healthy") && sample.assigned === 10 &&
  sample.connected === 9 && sample.failed === 1 && sample.empty === 6 &&
  Number.isInteger(sample.progressing) && sample.progressing >= 7 && sample.progressing <= 9 &&
  Number.isInteger(sample.stalled) && sample.stalled >= 0 && sample.stalled <= 2 &&
  sample.rotations === 0);
const confirmedHandoffTargetTruth = confirmedHandoff && gatewaySamples.every(sample =>
  (sample.status === "degraded" || sample.status === "healthy") && sample.assigned === 10 &&
  Number.isInteger(sample.connected) && sample.connected >= 8 && sample.connected <= 9 &&
  Number.isInteger(sample.failed) && sample.failed >= 1 && sample.failed <= 2 && sample.empty === 6 &&
  Number.isInteger(sample.progressing) && sample.progressing >= 7 && sample.progressing <= 9 &&
  Number.isInteger(sample.stalled) && sample.stalled >= 0 && sample.stalled <= 2 &&
  sample.rotations === 0);
const startupWindowTargetTruth = startupWindow && gatewaySamples.every(sample =>
  (sample.status === "degraded" || sample.status === "healthy") && sample.assigned === 10 &&
  Number.isInteger(sample.connected) && sample.connected >= 8 && sample.connected <= 9 &&
  Number.isInteger(sample.failed) && sample.failed >= 1 && sample.failed <= 2 && sample.empty === 6 &&
  Number.isInteger(sample.progressing) && sample.progressing >= 7 && sample.progressing <= 9 &&
  Number.isInteger(sample.stalled) && sample.stalled >= 0 && sample.stalled <= 2 &&
  sample.rotations === 0);
const handoffProbationTargetTruth = handoffProbation && gatewaySamples.every(sample =>
  (sample.status === "degraded" || sample.status === "healthy") && sample.assigned === 10 &&
  Number.isInteger(sample.connected) && sample.connected >= 8 && sample.connected <= 9 &&
  Number.isInteger(sample.failed) && sample.failed >= 1 && sample.failed <= 2 && sample.empty === 6 &&
  Number.isInteger(sample.progressing) && sample.progressing >= 7 && sample.progressing <= 9 &&
  Number.isInteger(sample.stalled) && sample.stalled >= 0 && sample.stalled <= 2 &&
  sample.rotations === 0);
const retainedFallbackTargetTruth = (retainedFallback || continuousHandoff || routineProvisional) && gatewaySamples.every(sample =>
  (sample.status === "degraded" || sample.status === "healthy") && sample.assigned === 10 &&
  Number.isInteger(sample.connected) && sample.connected >= 8 && sample.connected <= 9 &&
  Number.isInteger(sample.failed) && sample.failed >= 1 && sample.failed <= 2 && sample.empty === 6 &&
  Number.isInteger(sample.progressing) && sample.progressing >= 7 && sample.progressing <= 9 &&
  Number.isInteger(sample.stalled) && sample.stalled >= 0 && sample.stalled <= 2 &&
  sample.rotations === 0);
const finiteCommonCauseTruth = (finiteHandoff || supervisorRecovery) && gatewaySamples.every(sample => sample.status === "degraded" &&
  sample.assigned === 10 && sample.connected === 0 && sample.failed === 10 && sample.empty === 6 &&
  sample.progressing === 0 && sample.stalled === 0);
let shadowEvidence = null, warmHandoffEvidence = null;
let failedCanaryEvidence = null;
let failedPreSoakEvidence = null;
if (sessionSweep) {
  const rows = protectedFile(failedCanaryEvidencePath).toString("utf8").trim().split("\n").map(line => JSON.parse(line));
  const failed = rows.find(point => point.release?.gateway?.software_version === item.supersedesVersion &&
    point.dvr?.lifecycle?.inputSocketError > 0);
  const rollbackCheckpoint = rows.at(-1);
  if (rows.length < 7 || rows.some(point => point.qualification_stage !== "CANARY") ||
    !rows.some(point => point.release?.gateway?.software_version === item.supersedesVersion) ||
    !failed || failed.release?.gateway?.software_version !== item.supersedesVersion ||
    failed.dvr?.session_lifecycle?.proactive_succeeded < 1 ||
    failed.dvr?.lifecycle?.inputSocketError < 1 ||
    rollbackCheckpoint?.release?.gateway?.software_version !== item.rollbackVersion ||
    !Number.isFinite(Date.parse(rollbackCheckpoint?.sampled_at || "")) ||
    Date.parse(rollbackCheckpoint.sampled_at) > Date.now() ||
    Date.now() - Date.parse(rollbackCheckpoint.sampled_at) > 7 * 24 * 60 * 60_000)
    throw new Error("P38_GATEWAY_SESSION_SWEEP_FAILED_CANARY_EVIDENCE_INVALID");
  failedCanaryEvidence = { sha256: sha(protectedFile(failedCanaryEvidencePath)),
    checkpoints: rows.length, minimum_progressing: Math.min(...rows.map(point => point.dvr.progressing)),
    rollback_checkpoint_progressing: rollbackCheckpoint.dvr.progressing,
    live_recovery_required: true,
    proactive_session_renewal: true, input_socket_errors: failed.dvr.lifecycle.inputSocketError };
}
if (heartbeatLogin) {
  const bytes = protectedFile(failedPreSoakEvidencePath);
  const rows = bytes.toString("utf8").trim().split("\n").map(line => JSON.parse(line));
  const stable = rows.find(point => point.dvr?.progressing === 9 &&
    point.release?.gateway?.software_version === item.supersedesVersion);
  const outage = rows.find(point => point.dvr?.progressing === 0 &&
    point.release?.gateway?.software_version === item.supersedesVersion &&
    point.dvr?.session_lifecycle?.last_rotation_reason === "proactive_nonexclusive_renewal" &&
    point.dvr?.recorder_session?.authentication_rejected === 0 &&
    point.dvr?.liveness?.ok === true);
  if (rows.length < 25 || rows.some(point => point.qualification_stage !== "PRE_SOAK") ||
    !stable || !outage || stable.sequence >= outage.sequence ||
    outage.dvr?.recorder_session?.responses_ok < 1 ||
    !Number.isFinite(Date.parse(outage.sampled_at || "")) ||
    !Number.isFinite(Date.parse(outage.dvr?.session_lifecycle?.last_rotation_at || "")) ||
    Date.parse(outage.sampled_at) - Date.parse(outage.dvr.session_lifecycle.last_rotation_at) > 5 * 60_000)
    throw new Error("P38_GATEWAY_HEARTBEAT_LOGIN_FAILED_PRE_SOAK_EVIDENCE_INVALID");
  failedPreSoakEvidence = { sha256: sha(bytes), checkpoints: rows.length,
    prior_progressing: stable.dvr.progressing,
    minimum_progressing: Math.min(...rows.map(point => point.dvr.progressing)),
    outage_sequence: outage.sequence, heartbeat_responses_ok: outage.dvr.recorder_session.responses_ok,
    authentication_rejected: outage.dvr.recorder_session.authentication_rejected,
    last_rotation_reason: outage.dvr.session_lifecycle.last_rotation_reason,
    live_recovery_required: true };
}
if (idleHandoff) {
  const bytes = protectedFile(failedCanaryEvidencePath);
  const result = JSON.parse(bytes);
  const affected = Object.entries(result.per_camera || {}).filter(([name, camera]) =>
    name.startsWith("dvr-") && camera.qualification_denominator === true && camera.availability < 1);
  if (result.contract !== "observer-reliability-qualification-v1" ||
    result.qualification_stage !== "CANARY" || result.status !== "NOT_DONE" ||
    result.dvr_source_available !== 9 || result.dvr_known_upstream_unavailable?.length !== 1 ||
    result.dvr_known_upstream_unavailable[0] !== 8 || result.gateway?.unavailable_checkpoints < 2 ||
    result.gateway?.stale_input_delta < 1 || result.gateway?.socket_error_delta !== 0 ||
    result.gateway?.recorder_session_failure_delta !== 0 ||
    result.gateway?.recorder_auth_rejection_delta !== 0 || result.playback?.failures !== 0 ||
    result.ai?.failures !== 0 || result.release?.gateway?.software_version !== item.supersedesVersion ||
    result.release?.gateway?.build_sha !== "6d515326502dbd9d3d7ca0e0249bd7a696324fca" ||
    affected.length < 1 || !affected.some(([, camera]) => camera.input_idle_ms?.p95 >= 12_000))
    throw new Error("P38_GATEWAY_IDLE_HANDOFF_FAILED_CANARY_EVIDENCE_INVALID");
  failedCanaryEvidence = { sha256: sha(bytes), checkpoints: result.checkpoints,
    unavailable_checkpoints: result.gateway.unavailable_checkpoints,
    affected_channels: affected.map(([name]) => name), stale_input_delta: result.gateway.stale_input_delta,
    recorder_session_failure_delta: result.gateway.recorder_session_failure_delta,
    recorder_auth_rejection_delta: result.gateway.recorder_auth_rejection_delta,
    socket_error_delta: result.gateway.socket_error_delta, live_recovery_required: true };
}
if (confirmedHandoff) {
  const bytes = protectedFile(failedCanaryEvidencePath);
  const result = JSON.parse(bytes);
  const affected = Object.entries(result.per_camera || {}).filter(([name, camera]) =>
    name.startsWith("dvr-") && camera.qualification_denominator === true && camera.availability < 1);
  if (result.contract !== "observer-reliability-qualification-v1" ||
    result.qualification_stage !== "CANARY" || result.status !== "NOT_DONE" ||
    result.dvr_source_available !== 8 ||
    JSON.stringify(result.dvr_known_upstream_unavailable) !== JSON.stringify([2, 8]) ||
    result.gateway?.unavailable_checkpoints !== 1 || result.gateway?.relay_start_delta < 100 ||
    result.gateway?.stale_input_delta < 1 || result.gateway?.socket_error_delta !== 0 ||
    result.gateway?.recorder_session_failure_delta !== 0 ||
    result.gateway?.recorder_auth_rejection_delta !== 0 || result.playback?.failures !== 0 ||
    result.ai?.failures !== 0 || result.release?.gateway?.software_version !== item.supersedesVersion ||
    result.release?.gateway?.build_sha !== "9658853d9b75c86674aa4955527a50618c294b5d" ||
    affected.length !== 1 || affected[0][0] !== "dvr-7" ||
    affected[0][1].input_idle_ms?.max < 20_000)
    throw new Error("P38_GATEWAY_CONFIRMED_HANDOFF_FAILED_CANARY_EVIDENCE_INVALID");
  failedCanaryEvidence = { sha256: sha(bytes), checkpoints: result.checkpoints,
    unavailable_checkpoints: result.gateway.unavailable_checkpoints,
    affected_channels: affected.map(([name]) => name), relay_start_delta: result.gateway.relay_start_delta,
    stale_input_delta: result.gateway.stale_input_delta,
    recorder_session_failure_delta: result.gateway.recorder_session_failure_delta,
    recorder_auth_rejection_delta: result.gateway.recorder_auth_rejection_delta,
    socket_error_delta: result.gateway.socket_error_delta, playback_failures: result.playback.failures,
    ai_failures: result.ai.failures, live_recovery_required: true };
}
if (handoffProbation || retainedFallback || continuousHandoff) {
  const bytes = protectedFile(failedCanaryEvidencePath);
  const result = JSON.parse(bytes);
  const affected = Object.entries(result.per_camera || {}).filter(([name, camera]) =>
    name.startsWith("dvr-") && camera.qualification_denominator === true && camera.availability < 1);
  if (result.contract !== "observer-reliability-qualification-v1" ||
    result.qualification_stage !== "CANARY" || result.status !== "NOT_DONE" ||
    result.dvr_source_available !== 8 ||
    JSON.stringify(result.dvr_known_upstream_unavailable) !== JSON.stringify([2, 8]) ||
    result.gateway?.unavailable_checkpoints !== 1 || result.gateway?.relay_start_delta < 100 ||
    result.gateway?.stale_input_delta < 1 || result.gateway?.socket_error_delta !== 0 ||
    result.gateway?.recorder_session_failure_delta !== 0 ||
    result.gateway?.recorder_auth_rejection_delta !== 0 || result.playback?.failures !== 0 ||
    result.ai?.failures !== 0 || result.release?.gateway?.software_version !== item.supersedesVersion ||
    result.release?.gateway?.build_sha !== "4a3d3e39d082f11a636145f606f96557c397a157" ||
    affected.length !== 1 || affected[0][0] !== "dvr-11" ||
    affected[0][1].available_samples !== 14 || affected[0][1].expected_samples !== 15 ||
    affected[0][1].input_idle_ms?.max < 20_000)
    throw new Error(continuousHandoff ? "P38_GATEWAY_CONTINUOUS_HANDOFF_FAILED_CANARY_EVIDENCE_INVALID" :
      retainedFallback ? "P38_GATEWAY_RETAINED_FALLBACK_FAILED_CANARY_EVIDENCE_INVALID" :
      "P38_GATEWAY_HANDOFF_PROBATION_FAILED_CANARY_EVIDENCE_INVALID");
  failedCanaryEvidence = { sha256: sha(bytes), checkpoints: result.checkpoints,
    unavailable_checkpoints: result.gateway.unavailable_checkpoints,
    affected_channels: affected.map(([name]) => name), relay_start_delta: result.gateway.relay_start_delta,
    stale_input_delta: result.gateway.stale_input_delta,
    recorder_session_failure_delta: result.gateway.recorder_session_failure_delta,
    recorder_auth_rejection_delta: result.gateway.recorder_auth_rejection_delta,
    socket_error_delta: result.gateway.socket_error_delta, playback_failures: result.playback.failures,
    ai_failures: result.ai.failures, live_recovery_required: true };
}
if (bufferedOutput || outputRescue || confirmedHandoff || startupWindow || handoffProbation || retainedFallback || continuousHandoff || routineProvisional) {
  if (!shadowEvidencePath)
    throw new Error("P38_GATEWAY_OUTPUT_RESCUE_SHADOW_EVIDENCE_INVALID");
  try {
    shadowEvidence = verifiedShadowEvidence(shadowEvidencePath, { recent: true,
      warmHandoff: true,
      confirmedWarmHandoff: confirmedHandoff || startupWindow || handoffProbation || retainedFallback || routineProvisional,
      verifyPlaybackRenewals: continuousHandoff || routineProvisional,
      boundedWarmupFailure: continuousHandoff,
      expectedRelease: item, expectedChannel: 1 });
  } catch {
    throw new Error("P38_GATEWAY_OUTPUT_RESCUE_SHADOW_EVIDENCE_INVALID");
  }
}
if (stableHandoff || mediaCadence || maintenanceIsolation) {
  if (!shadowEvidencePath) throw new Error("P38_GATEWAY_STABLE_HANDOFF_SHADOW_EVIDENCE_REQUIRED");
  shadowEvidence = verifiedShadowEvidence(shadowEvidencePath, { recent: true, warmHandoff: true,
    expectedRelease: item, expectedChannel: maintenanceIsolation ? 1 : 3 });
}
if (finiteCommonCauseTruth) {
  if (!shadowEvidencePath) throw new Error("P38_GATEWAY_FINITE_HANDOFF_SHADOW_EVIDENCE_REQUIRED");
  shadowEvidence = verifiedShadowEvidence(shadowEvidencePath, { recent: true,
    expectedRelease: supervisorRecovery ? item : null });
  warmHandoffEvidence = verifiedShadowEvidence(warmHandoffEvidencePath, { warmHandoff: true });
}
if (!gatewayPidStable || (!normalRuntimeTruth && !finiteCommonCauseTruth &&
  !idleHandoffTargetTruth && !bufferedOutputTargetTruth && !outputRescueTargetTruth &&
  !confirmedHandoffTargetTruth && !startupWindowTargetTruth && !handoffProbationTargetTruth &&
  !retainedFallbackTargetTruth))
  throw new Error("P38_GATEWAY_COMMON_CAUSE_RUNTIME_TRUTH_INVALID");
if (connectorSamples.some(sample => !sample.running || !sample.pid || !sample.ok ||
  sample.assigned !== 1 || sample.progressing !== 1 || sample.stalled !== 0) ||
  new Set(connectorSamples.map(sample => sample.pid)).size !== 1)
  throw new Error("P38_GATEWAY_COMMON_CAUSE_CONNECTOR_HEALTH_INVALID");
const disk = statfsSync(root);
if (Number(disk.bavail) * Number(disk.bsize) < item.size * 3)
  throw new Error("P38_GATEWAY_COMMON_CAUSE_DISK_INSUFFICIENT");
const [anonymous, wrongRoute] = await Promise.all([
  tlsProbe(`/api/video-gateway/edge-updates?platform=darwin&architecture=arm64&profile=PHYSICAL_GATEWAY&current_version=${encodeURIComponent(item.rollbackVersion)}&config_version=1&channel=HOME_QA`),
  tlsProbe("/api/video-gateway/not-exposed")
]);
if (anonymous !== 401 || wrongRoute !== 404)
  throw new Error("P38_GATEWAY_COMMON_CAUSE_INGRESS_INVALID");

const plan = { protocol: routineProvisional ? "observer-push38-gateway-routine-provisional-activation-v1" :
  continuousHandoff ? "observer-push38-gateway-continuous-handoff-activation-v1" :
  retainedFallback ? "observer-push38-gateway-retained-fallback-activation-v1" :
  handoffProbation ? "observer-push38-gateway-handoff-probation-activation-v1" :
  startupWindow ? "observer-push38-gateway-startup-window-activation-v1" :
  confirmedHandoff ? "observer-push38-gateway-confirmed-handoff-activation-v1" :
  outputRescue ? "observer-push38-gateway-output-rescue-activation-v1" :
  bufferedOutput ? "observer-push38-gateway-buffered-output-activation-v1" :
  idleHandoff ? "observer-push38-gateway-idle-handoff-activation-v1" :
  heartbeatLogin ? "observer-push38-gateway-heartbeat-login-activation-v1" :
  sessionSweep ? "observer-push38-gateway-session-sweep-activation-v1" :
  "observer-push38-gateway-common-cause-recovery-activation-v1",
  generated_at: new Date().toISOString(), mode: "PREFLIGHT", release_id: item.releaseId,
  version: item.version, build_sha: item.buildSha, artifact_sha256: item.digest,
  artifact_size: item.size, r2_object_key: expectedObject, exact_device_id: item.deviceId,
  cohort_percent: 0, signed_manifest: "PASS", live_trust: "PASS", r2_round_trip: "PASS",
  private_r2: "PASS", managed_device_auth: "PASS", https_control: "PASS",
  current_release_id: current.release_id, rollback_target: item.rollbackReleaseId,
  runtime_pid: gatewayService.pid, ota_agent_pid: gatewayAgent.pid,
  connector_release_id: connectorCurrent.release_id,
  gateway_runtime_samples: gatewaySamples, connector_runtime_samples: connectorSamples,
  gateway_runtime_truth: normalRuntimeTruth ? (expectsNineSources ? "9_OF_9_PROGRESSING" : "8_OF_8_PROGRESSING") :
    retainedFallbackTargetTruth ? (routineProvisional ? "CONTINUOUS_HANDOFF_GAP_SHADOW_ROUTINE_PROVISIONAL_QUALIFIED" :
      continuousHandoff ? "RETAINED_FALLBACK_GAP_SHADOW_CONTINUOUS_HANDOFF_QUALIFIED" :
      "FAILED_HANDOFF_PROBATION_SHADOW_RETAINED_FALLBACK_QUALIFIED") :
    handoffProbationTargetTruth ? "FAILED_STARTUP_WINDOW_CANARY_HANDOFF_PROBATION_SHADOW_QUALIFIED" :
    startupWindowTargetTruth ? "FAILED_STARTUP_WINDOW_CONFIRMED_HANDOFF_SHADOW_QUALIFIED" :
    confirmedHandoffTargetTruth ? "FAILED_CANARY_CONFIRMED_HANDOFF_SHADOW_QUALIFIED" :
    outputRescueTargetTruth ? "KNOWN_OUTPUT_STALLS_QUALIFIED_FOR_SIGNED_REMEDIATION" :
    bufferedOutputTargetTruth ? "KNOWN_BUFFERED_OUTPUT_GAPS_QUALIFIED_FOR_SIGNED_REMEDIATION" :
    idleHandoffTargetTruth ? "KNOWN_PER_CHANNEL_IDLE_GAP_QUALIFIED_FOR_SIGNED_REMEDIATION" :
      "FINITE_STREAM_COMMON_CAUSE_SHADOW_QUALIFIED",
  ...(shadowEvidence ? { current_shadow_evidence: shadowEvidence,
    warm_handoff_evidence: warmHandoffEvidence } : {}),
  ...(failedCanaryEvidence ? { failed_canary_evidence: failedCanaryEvidence } : {}),
  ...(failedPreSoakEvidence ? { failed_pre_soak_evidence: failedPreSoakEvidence } : {}),
  ...((failedCanaryEvidence || failedPreSoakEvidence) ? { live_recovery_evidence: {
    release_id: current.release_id,
    progressing: gatewaySamples.at(-1).progressing,
    connected: gatewaySamples.at(-1).connected,
    failed: gatewaySamples.at(-1).failed,
    empty: gatewaySamples.at(-1).empty,
    service_pid_stable: gatewayPidStable
  } } : {}),
  dvr_truth: { expected: 10,
    source_available: (startupWindow || handoffProbation || retainedFallback || continuousHandoff || routineProvisional) ? gatewaySamples.at(-1).connected : confirmedHandoff ? 8 : expectsNineSources ? 9 : 8,
    upstream_unavailable: (startupWindow || handoffProbation || retainedFallback || continuousHandoff || routineProvisional) ? gatewaySamples.at(-1).failed : confirmedHandoff ? 2 : expectsNineSources ? 1 : 2,
    empty: 6 },
  actions: ["PAUSE_OTHER_GATEWAY_ROLLOUTS", "ACTIVATE_EXACT_GATEWAY_REMEDIATION_ROLLOUT",
    "OTA_AGENT_DISCOVERS", "SHORT_LIVED_R2_DOWNLOAD", "SIGNED_INSTALL", "HEALTH_GATE",
    "PROMOTE_OR_EXISTING_MANAGER_ROLLBACK"], runtime_writes: 0 };
if (mode === "PREFLIGHT") {
  const evidenceSha = persist(plan);
  console.log(JSON.stringify({ status: routineProvisional ? "GATEWAY_ROUTINE_PROVISIONAL_PREFLIGHT_PASS" :
    continuousHandoff ? "GATEWAY_CONTINUOUS_HANDOFF_PREFLIGHT_PASS" :
    retainedFallback ? "GATEWAY_RETAINED_FALLBACK_PREFLIGHT_PASS" :
    handoffProbation ? "GATEWAY_HANDOFF_PROBATION_PREFLIGHT_PASS" :
    startupWindow ? "GATEWAY_STARTUP_WINDOW_PREFLIGHT_PASS" :
    confirmedHandoff ? "GATEWAY_CONFIRMED_HANDOFF_PREFLIGHT_PASS" :
    outputRescue ? "GATEWAY_OUTPUT_RESCUE_PREFLIGHT_PASS" :
    bufferedOutput ? "GATEWAY_BUFFERED_OUTPUT_PREFLIGHT_PASS" :
    idleHandoff ? "GATEWAY_IDLE_HANDOFF_PREFLIGHT_PASS" :
    heartbeatLogin ? "GATEWAY_HEARTBEAT_LOGIN_PREFLIGHT_PASS" :
    sessionSweep ? "GATEWAY_SESSION_SWEEP_PREFLIGHT_PASS" :
    maintenanceIsolation ? "GATEWAY_MAINTENANCE_ISOLATION_PREFLIGHT_PASS" :
    mediaCadence ? "GATEWAY_MEDIA_CADENCE_PREFLIGHT_PASS" :
    stableHandoff ? "GATEWAY_STABLE_HANDOFF_PREFLIGHT_PASS" :
    supervisorRecovery ? "GATEWAY_SUPERVISOR_RECOVERY_PREFLIGHT_PASS" :
    finiteHandoff ? "GATEWAY_FINITE_HANDOFF_PREFLIGHT_PASS" : "GATEWAY_SESSION_PREFLIGHT_PASS",
    evidence_sha256: evidenceSha, release_id: item.releaseId, exact_device: true,
    broad_cohort: false, dvr_progressing: gatewaySamples.at(-1).progressing, runtime_writes: 0 }));
  process.exit(0);
}

const savedBytes = protectedFile(planPath);
if (!/^[a-f0-9]{64}$/.test(planSha) || sha(savedBytes) !== planSha)
  throw new Error("P38_GATEWAY_COMMON_CAUSE_PLAN_PIN_MISMATCH");
const saved = JSON.parse(savedBytes);
if (saved.protocol !== plan.protocol || saved.release_id !== item.releaseId ||
  saved.artifact_sha256 !== item.digest || saved.current_release_id !== item.rollbackReleaseId ||
  saved.rollback_target !== item.rollbackReleaseId || saved.runtime_pid !== gatewayService.pid ||
  saved.ota_agent_pid !== gatewayAgent.pid || Date.now() - Date.parse(saved.generated_at) > 10 * 60_000)
  throw new Error("P38_GATEWAY_COMMON_CAUSE_PLAN_STALE");
const sql = `begin;
  update public.observer_edge_rollouts set status='PAUSED',updated_at=now()
  where release_id in (select id from public.observer_edge_releases where channel='HOME_QA' and deployment_profile='PHYSICAL_GATEWAY')
    and status in ('DRAFT','ACTIVE');
  update public.observer_edge_rollouts set status='ACTIVE',paused_reason=null,updated_at=now()
  where release_id=(select id from public.observer_edge_releases where release_id='${item.releaseId}')
    and cohort_percent=0 and target_filters->'explicit_device_ids'=jsonb_build_array('${item.deviceId}');
  do $$ begin
    if not exists(select 1 from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
      where r.release_id='${item.releaseId}' and o.status='ACTIVE' and o.cohort_percent=0
      and o.target_filters->'explicit_device_ids'=jsonb_build_array('${item.deviceId}')) or
      exists(select 1 from public.observer_edge_rollouts where status='ACTIVE' and cohort_percent<>0) or
      exists(select 1 from public.observer_edge_rollouts o join public.observer_edge_releases r on r.id=o.release_id
        where r.deployment_profile='PHYSICAL_GATEWAY' and r.release_id<>'${item.releaseId}' and o.status='ACTIVE')
    then raise exception 'P38_GATEWAY_COMMON_CAUSE_ACTIVATION_VERIFY_FAILED'; end if;
  end $$;
commit;`;
docker(["exec", "-i", "supabase_db_gan-batuach-push38t", "psql", "-X", "-q",
  "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], sql);
const result = { ...plan, mode: "APPLY", applied_at: new Date().toISOString(),
  exact_rollout_active: true, broad_cohort: false, ota_agent_owns_install: true,
  functional_runtime_changed_by_command: false, runtime_writes: 0 };
const evidenceSha = persist(result);
console.log(JSON.stringify({ status: routineProvisional ? "EXACT_GATEWAY_ROUTINE_PROVISIONAL_ROLLOUT_ACTIVE" :
  continuousHandoff ? "EXACT_GATEWAY_CONTINUOUS_HANDOFF_ROLLOUT_ACTIVE" :
  retainedFallback ? "EXACT_GATEWAY_RETAINED_FALLBACK_ROLLOUT_ACTIVE" :
  handoffProbation ? "EXACT_GATEWAY_HANDOFF_PROBATION_ROLLOUT_ACTIVE" :
  startupWindow ? "EXACT_GATEWAY_STARTUP_WINDOW_ROLLOUT_ACTIVE" :
  confirmedHandoff ? "EXACT_GATEWAY_CONFIRMED_HANDOFF_ROLLOUT_ACTIVE" :
  outputRescue ? "EXACT_GATEWAY_OUTPUT_RESCUE_ROLLOUT_ACTIVE" :
  bufferedOutput ? "EXACT_GATEWAY_BUFFERED_OUTPUT_ROLLOUT_ACTIVE" :
  idleHandoff ? "EXACT_GATEWAY_IDLE_HANDOFF_ROLLOUT_ACTIVE" :
  heartbeatLogin ? "EXACT_GATEWAY_HEARTBEAT_LOGIN_ROLLOUT_ACTIVE" :
  sessionSweep ? "EXACT_GATEWAY_SESSION_SWEEP_ROLLOUT_ACTIVE" :
  maintenanceIsolation ? "EXACT_GATEWAY_MAINTENANCE_ISOLATION_ROLLOUT_ACTIVE" :
  mediaCadence ? "EXACT_GATEWAY_MEDIA_CADENCE_ROLLOUT_ACTIVE" :
  stableHandoff ? "EXACT_GATEWAY_STABLE_HANDOFF_ROLLOUT_ACTIVE" :
  supervisorRecovery ? "EXACT_GATEWAY_SUPERVISOR_RECOVERY_ROLLOUT_ACTIVE" :
  finiteHandoff ? "EXACT_GATEWAY_FINITE_HANDOFF_ROLLOUT_ACTIVE" :
  "EXACT_GATEWAY_COMMON_CAUSE_ROLLOUT_ACTIVE",
  evidence_sha256: evidenceSha, release_id: item.releaseId, exact_device: true,
  broad_cohort: false, ota_agent_owns_install: true, runtime_writes: 0 }));
