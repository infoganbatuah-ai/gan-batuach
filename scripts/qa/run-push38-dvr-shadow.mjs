import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import { verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { inspectArchive } from "../../services/video-gateway/edge-macos-installed-adapter.mjs";
import { PRIVATE_NVR_ROUTINE_HANDOFF_RETRY_BACKOFF_MS } from
  "../../services/video-gateway/private-nvr-session-policy.mjs";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const requestedEndpoint = String(process.env.DVR_SHADOW_ENDPOINT || "").trim();
const channel = Number(process.env.DVR_SHADOW_CHANNEL || 1);
const durationMs = Number(process.env.DVR_SHADOW_DURATION_MS || 30 * 60_000);
const intervalMs = Number(process.env.DVR_SHADOW_INTERVAL_MS || 30_000);
const port = Number(process.env.DVR_SHADOW_PORT || 18084);
const outputPath = String(process.env.DVR_SHADOW_OUTPUT || "").trim();
const service = String(process.env.DVR_SHADOW_KEYCHAIN_SERVICE || "com.ganbatuach.video-gateway.runtime");
const requestedSignedSlot = String(process.env.DVR_SHADOW_SIGNED_SLOT || "").trim();
const requestedSignedArtifact = String(process.env.DVR_SHADOW_SIGNED_ARTIFACT || "").trim();
const requestedSignedBundle = String(process.env.DVR_SHADOW_SIGNED_BUNDLE || "").trim();
const requestedManifestMember = String(process.env.DVR_SHADOW_MANIFEST_MEMBER ||
  "gateway_remediation_supervisor_recovery.json").trim();
const playbackEveryCheckpoint = process.env.DVR_SHADOW_PLAYBACK_EVERY_CHECKPOINT === "1";
if (!Number.isInteger(channel) || channel < 1 || channel > 64) throw new Error("DVR_SHADOW_CHANNEL is invalid");
if (!Number.isFinite(durationMs) || durationMs < 60_000 || durationMs > 35 * 60_000) throw new Error("DVR_SHADOW_DURATION_MS is outside the bounded qualification window");
if (!Number.isFinite(intervalMs) || intervalMs < 10_000 || intervalMs > 60_000) throw new Error("DVR_SHADOW_INTERVAL_MS is invalid");
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("DVR_SHADOW_PORT is invalid");
if (!outputPath) throw new Error("DVR_SHADOW_OUTPUT is required");

function resolveRuntimeSource() {
  const artifactMode = Boolean(requestedSignedArtifact || requestedSignedBundle);
  if (Boolean(requestedSignedSlot) && artifactMode ||
    artifactMode && (!requestedSignedArtifact || !requestedSignedBundle) ||
    !/^[A-Za-z0-9._-]+\.json$/.test(requestedManifestMember))
    throw new Error("DVR_SHADOW_SIGNED_SOURCE_MODE_INVALID");
  if (!requestedSignedSlot && !artifactMode)
    return { root: repoRoot, signedRelease: null, cleanupRoot: null,
      sourceClass: "QUALIFICATION_WORKTREE" };
  let slot, manifest, artifact, runtime, cleanupRoot = null;
  if (artifactMode) {
    const restrictedRoot = realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted");
    const artifactPath = realpathSync(resolve(requestedSignedArtifact));
    const bundlePath = realpathSync(resolve(requestedSignedBundle));
    if (![artifactPath, bundlePath].every(path => path.startsWith(`${restrictedRoot}/`) &&
      !lstatSync(path).isSymbolicLink() && lstatSync(path).isFile()))
      throw new Error("DVR_SHADOW_SIGNED_BUNDLE_SCOPE_INVALID");
    manifest = JSON.parse(execFileSync("unzip", ["-p", bundlePath, requestedManifestMember], {
      encoding: "utf8", timeout: 15_000, maxBuffer: 16_384
    }));
    artifact = readFileSync(artifactPath);
    inspectArchive(artifactPath);
    cleanupRoot = mkdtempSync(join(tmpdir(), "observer-p38-signed-shadow-runtime-"));
    execFileSync("tar", ["-xzf", artifactPath, "-C", cleanupRoot]);
    runtime = realpathSync(cleanupRoot);
  } else {
  const slotsRoot = realpathSync(join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota/slots"));
  slot = realpathSync(resolve(requestedSignedSlot));
  if (!slot.startsWith(`${slotsRoot}/`) || lstatSync(slot).isSymbolicLink())
    throw new Error("DVR_SHADOW_SIGNED_SLOT_SCOPE_INVALID");
  const manifestPath = join(slot, "release.json"), artifactPath = join(slot, "artifact.bin");
  runtime = realpathSync(join(slot, "runtime"));
  if (![manifestPath, artifactPath].every(path => existsSync(path) && !lstatSync(path).isSymbolicLink()) ||
    !runtime.startsWith(`${slot}/`) || !existsSync(join(runtime, "services/video-gateway/server.mjs")))
    throw new Error("DVR_SHADOW_SIGNED_SLOT_INCOMPLETE");
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  artifact = readFileSync(artifactPath);
  }
  const trusted = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
  if (!verifyEdgeUpdateManifest(manifest, trusted).ok || !verifyEdgeArtifact(artifact, manifest).ok ||
    manifest.profile !== "PHYSICAL_GATEWAY" || manifest.platform !== "darwin" ||
    manifest.architecture !== process.arch)
    throw new Error("DVR_SHADOW_SIGNED_SLOT_UNTRUSTED");
  return { root: runtime, cleanupRoot,
    sourceClass: artifactMode ? "SIGNED_RELEASE_BUNDLE" : "INSTALLED_SIGNED_SLOT",
    signedRelease: { release_id: manifest.release_id, version: manifest.version,
    build_sha: manifest.build_sha, artifact_sha256: manifest.artifact_sha256,
    artifact_size: manifest.artifact_size, signing_key_id: manifest.signing_key_id,
    signature_verified: true, artifact_verified: true } };
}

const runtimeSource = resolveRuntimeSource();

const store = createEdgeSecretStoreSync({ keychainService: service });
const profile = JSON.parse(store.read("dvr_profile_json"));
const password = store.read("dvr_password");
if (!profile || !password) throw new Error("The installed DVR profile is incomplete");
const installedEndpoint = String(profile.endpoint || profile.host || "").trim();
const endpointValue = requestedEndpoint || installedEndpoint;
const endpoint = endpointValue.includes("://") ? endpointValue : `http://${endpointValue}`;
if (!/^https?:\/\/(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(endpoint)) {
  throw new Error("An installed or explicit private-LAN DVR_SHADOW_ENDPOINT is required");
}
const qualificationProfile = {
  ...profile,
  endpoint,
  password,
  metadata: {
    ...(profile.metadata || {}),
    vendor: profile.metadata?.vendor || profile.vendor,
    channel_filter: [channel],
    expected_channel_count: Number(profile.metadata?.expected_channel_count || profile.channel_count || 16),
    shadow_qualification: true,
    read_only_requested: true
  }
};

const hlsRoot = mkdtempSync(join(tmpdir(), "observer-p38-dvr-shadow-"));
const base = `http://127.0.0.1:${port}`;
const shadowSecret = randomBytes(32).toString("base64url");
const startedAt = Date.now();
const evidence = {
  contract: "observer-push38-bounded-dvr-shadow-v1",
  started_at: new Date(startedAt).toISOString(),
  mode: "READ_ONLY_ONE_CHANNEL_SHADOW",
  channel,
  endpoint_redacted: true,
  credentials_recorded: false,
  cloud_access_enabled: false,
  runtime_mutation: false,
  runtime_source: runtimeSource.sourceClass,
  signed_release: runtimeSource.signedRelease,
  playback_every_checkpoint: playbackEveryCheckpoint,
  checkpoints: []
};
let child;

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function jsonFetch(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20_000) });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}
async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const result = await jsonFetch(`${base}/health/live`).catch(() => null);
    if (result?.status === 200) return;
    await sleep(250);
  }
  throw new Error("Shadow Gateway did not start");
}
async function playback(streamId) {
  const grant = await jsonFetch(`${base}/camera/${encodeURIComponent(streamId)}/playback`, {
    headers: { "x-video-gateway-secret": shadowSecret }
  }).catch(() => null);
  if (grant?.status !== 200 || !grant.data?.playback?.hls_url) return {
    status: grant?.status || 0, playlist_status: 0, segment_status: 0, segment_bytes: 0,
    media_sequence: null, latest_segment_sequence: null, playlist_sha256: null,
    segment_sha256: null
  };
  const playlistResponse = await fetch(grant.data.playback.hls_url, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
  const playlist = playlistResponse?.ok ? await playlistResponse.text() : "";
  const playlistLines = playlist.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const segmentName = playlistLines.filter(line => /^segment-\d+\.ts\?token=/.test(line)).at(-1);
  const mediaSequence = Number(/^#EXT-X-MEDIA-SEQUENCE:(\d+)$/.exec(
    playlistLines.find(line => line.startsWith("#EXT-X-MEDIA-SEQUENCE:")) || "")?.[1]);
  const latestSegmentSequence = Number(/^segment-(\d+)\.ts/.exec(segmentName || "")?.[1]);
  const segmentUrl = segmentName ? new URL(segmentName, grant.data.playback.hls_url).toString() : "";
  const segmentResponse = segmentUrl ? await fetch(segmentUrl, { signal: AbortSignal.timeout(20_000) }).catch(() => null) : null;
  const segment = segmentResponse?.ok ? Buffer.from(await segmentResponse.arrayBuffer()) : Buffer.alloc(0);
  return { status: grant.status, playlist_status: playlistResponse?.status || 0,
    segment_status: segmentResponse?.status || 0, segment_bytes: segment.byteLength,
    media_sequence: Number.isInteger(mediaSequence) ? mediaSequence : null,
    latest_segment_sequence: Number.isInteger(latestSegmentSequence) ? latestSegmentSequence : null,
    playlist_sha256: playlist ? createHash("sha256").update(playlist).digest("hex") : null,
    segment_sha256: segment.length ? createHash("sha256").update(segment).digest("hex") : null };
}
async function health(url) {
  const result = await jsonFetch(url).catch(() => null);
  const body = result?.data || {};
  return {
    http: result?.status || 0,
    status: body.status || "unavailable",
    discovery: body.lastDiscovery ? {
      assigned: body.lastDiscovery.assignedCount,
      connected: body.lastDiscovery.connectedCount,
      failed: body.lastDiscovery.failedAssignedCount,
      empty: body.lastDiscovery.unassignedCount
    } : null,
    media: body.mediaHeartbeat ? {
      active: body.mediaHeartbeat.activeRelays,
      candidate_handoffs: body.mediaHeartbeat.candidateHandoffs ?? 0,
      provisional_handoffs: body.mediaHeartbeat.provisionalHandoffs ?? 0,
      progressing: body.mediaHeartbeat.progressingRelays,
      stalled: body.mediaHeartbeat.stalledRelays,
      lifecycle: body.mediaHeartbeat.lifecycle,
      source_diagnostics: Array.isArray(body.mediaHeartbeat.source_diagnostics)
        ? body.mediaHeartbeat.source_diagnostics.map((source) => ({
          channel: source.channel,
          source_kind: source.source_kind,
          starts: source.starts ?? 0,
          exits: source.exits ?? 0,
          last_start_reason: source.last_start_reason ?? null,
          last_handoff_mode: source.last_handoff_mode ?? null,
          last_handoff_result: source.last_handoff_result ?? null,
          last_handoff_failure: source.last_handoff_failure ?? null,
          last_handoff_first_output_latency_ms:
            source.last_handoff_first_output_latency_ms ?? null,
          last_handoff_output_advances: source.last_handoff_output_advances ?? null,
          last_handoff_duration_ms: source.last_handoff_duration_ms ?? null,
          last_failure_reason: source.last_failure_reason ?? null,
          last_failure_at: source.last_failure_at ?? null,
          retry_failures: source.retry_failures ?? 0
        })) : [],
      inputs: Array.isArray(body.mediaHeartbeat.inputs) ? body.mediaHeartbeat.inputs.map((input) => ({
        channel: input.channel,
        encoder: input.encoder ?? null,
        bytes: input.bytes ?? input.input_bytes,
        chunks: input.chunks ?? input.input_chunks,
        progressing: input.progressing,
        owner_state: input.owner_state ?? null,
        canonical_owner_progressing: input.canonical_owner_progressing ?? null,
        candidate_progressing: input.candidate_progressing ?? null,
        input_idle_ms: input.input_idle_ms ?? null,
        relay_age_ms: input.relay_age_ms ?? null,
        output_idle_ms: input.output_idle_ms ?? null
      })) : []
    } : null,
    recorder_session: body.recorderSessionLifecycle ? {
      login_attempts: body.recorderSessionLifecycle.login_attempts,
      login_succeeded: body.recorderSessionLifecycle.login_succeeded,
      rotations: body.recorderSessionLifecycle.rotations,
      last_rotation_reason: body.recorderSessionLifecycle.last_rotation_reason,
      active_sessions: body.recorderSessionLifecycle.active_sessions
    } : null
  };
}
function persist() {
  mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });
  const temporary = `${outputPath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, outputPath);
  chmodSync(outputPath, 0o600);
}
function stopChild() {
  if (child?.exitCode === null && !child.killed) child.kill("SIGTERM");
}

try {
  child = spawn(process.execPath, [join(runtimeSource.root, "services/video-gateway/server.mjs")], {
    cwd: runtimeSource.root,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
      HOST: "127.0.0.1",
      VIDEO_GATEWAY_PORT: String(port),
      VIDEO_GATEWAY_SHADOW_MODE: "1",
      VIDEO_GATEWAY_SHADOW_HLS_ROOT: hlsRoot,
      VIDEO_GATEWAY_SIGNING_SECRET: shadowSecret,
      DVR_EXPECTED_CHANNEL_COUNT: String(qualificationProfile.metadata.expected_channel_count)
    },
    stdio: ["ignore", "ignore", "ignore"]
  });
  await waitForServer();
  const discovery = await jsonFetch(`${base}/dvr/connect`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-video-gateway-secret": shadowSecret },
    body: JSON.stringify(qualificationProfile)
  });
  const selected = discovery.data?.channels?.find((item) => item.channel === channel);
  if (discovery.status !== 200 || selected?.status !== "connected" || !selected.stream_id) {
    throw new Error(`Selected Shadow channel did not connect: HTTP ${discovery.status}, ${selected?.status || "missing"}, ${selected?.reason || "no_reason"}`);
  }
  evidence.discovery = {
    status: discovery.status,
    selected_channel_status: selected.status,
    codec: selected.codec,
    width: selected.width,
    height: selected.height,
    total_slots: discovery.data.channel_count,
    assigned: discovery.data.channel_count - discovery.data.unassigned_channel_count,
    unassigned: discovery.data.unassigned_channel_count
  };
  let sequence = 0;
  while (Date.now() - startedAt < durationMs) {
    const renewal = playbackEveryCheckpoint || sequence % 2 === 0
      ? await playback(selected.stream_id) : null;
    const point = {
      sequence: ++sequence,
      observed_at: new Date().toISOString(),
      elapsed_ms: Date.now() - startedAt,
      renewal,
      shadow: await health(`${base}/health`),
      legacy: await health("http://127.0.0.1:18082/health")
    };
    evidence.checkpoints.push(point);
    persist();
    process.stdout.write(`${JSON.stringify({ sequence: point.sequence, observed_at: point.observed_at, shadow: point.shadow, legacy: point.legacy })}\n`);
    await sleep(intervalMs);
  }
  evidence.ended_at = new Date().toISOString();
  evidence.duration_ms = Date.now() - startedAt;
  evidence.final_health = await health(`${base}/health`);
  const finalPoint = { shadow: evidence.final_health };
  const lifecycle = evidence.final_health?.media?.lifecycle || {};
  const playbackFailures = playbackEveryCheckpoint
    ? evidence.checkpoints.filter((point) => point.renewal?.status !== 200
      || point.renewal?.playlist_status !== 200
      || point.renewal?.segment_status !== 200
      || !(point.renewal?.segment_bytes > 0)).length
    : 0;
  const failures = [];
  const warnings = [];
  const routineHandoffFailures = Number(
    lifecycle.warmHandoffFailuresByMode?.routineFiniteResponse || 0);
  const outputRescueFailures = Number(
    lifecycle.warmHandoffFailuresByMode?.outputRescue || 0);
  const maximumBoundedRoutineFailures = Math.max(1,
    Math.ceil(evidence.duration_ms / PRIVATE_NVR_ROUTINE_HANDOFF_RETRY_BACKOFF_MS));
  if (!evidence.checkpoints.every((point) => point.shadow.http === 200
    && point.shadow.discovery?.assigned === 1
    && point.shadow.discovery?.connected === 1
    && point.shadow.media?.progressing === 1)) failures.push("SHADOW_PROGRESSION");
  if (playbackFailures > 0) failures.push("PLAYBACK_CONTINUITY");
  if (outputRescueFailures > 0) failures.push("OUTPUT_RESCUE_FAILURE");
  if (routineHandoffFailures > maximumBoundedRoutineFailures)
    failures.push("ROUTINE_HANDOFF_RETRY_STORM");
  else if (routineHandoffFailures > 0)
    warnings.push("BOUNDED_ROUTINE_CANDIDATE_REJECTED_WITHOUT_MEDIA_GAP");
  if (durationMs >= 2 * 60_000 && (lifecycle.warmHandoffs || 0) < 1)
    failures.push("NO_SUCCESSFUL_HANDOFF_OBSERVED");
  if ((lifecycle.stalePlaylist || 0) > 0) failures.push("STALE_PLAYLIST");
  if ((lifecycle.staleInput || 0) > 0) failures.push("STALE_INPUT");
  if ((lifecycle.staleOnRequest || 0) > 0) failures.push("STALE_ON_REQUEST");
  if ((lifecycle.inputSocketError || 0) > 0) failures.push("INPUT_SOCKET");
  if ((lifecycle.startsByReason?.recovery || 0) > 0) failures.push("RELAY_RECOVERY_GAP");
  if ((evidence.final_health?.media?.candidate_handoffs || 0) > 0
    || (evidence.final_health?.media?.provisional_handoffs || 0) > 0)
    failures.push("HANDOFF_NOT_SETTLED");
  if ((finalPoint?.shadow.recorder_session?.rotations || 0) > 0)
    failures.push("SESSION_ROTATION");
  evidence.qualification = {
    playback_failures: playbackFailures,
    lifecycle_final: lifecycle,
    recorder_session_final: finalPoint?.shadow.recorder_session || null,
    source_diagnostics_final: finalPoint?.shadow.media?.source_diagnostics || [],
    routine_handoff_failures: routineHandoffFailures,
    output_rescue_failures: outputRescueFailures,
    maximum_bounded_routine_failures: maximumBoundedRoutineFailures,
    warnings,
    failures
  };
  evidence.result = failures.length === 0 ? "PASS" : "FAIL";
  persist();
  process.stdout.write(`${JSON.stringify({ result: evidence.result, duration_ms: evidence.duration_ms, checkpoints: evidence.checkpoints.length, output: outputPath })}\n`);
  if (evidence.result !== "PASS") process.exitCode = 1;
} finally {
  stopChild();
  await sleep(500);
  rmSync(hlsRoot, { recursive: true, force: true });
  if (runtimeSource.cleanupRoot) rmSync(runtimeSource.cleanupRoot, { recursive: true, force: true });
}
