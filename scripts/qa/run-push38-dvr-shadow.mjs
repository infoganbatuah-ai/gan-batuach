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
import { PRIVATE_NVR_OUTPUT_RESCUE_PROBATION_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_RETRY_BACKOFF_MS } from
  "../../services/video-gateway/private-nvr-session-policy.mjs";
import { classifyBoundedOutputRescueRejection, classifyContainedOwnerRecovery,
  classifyContinuousSessionRenewal, evaluateHlsRenewalContinuity,
  evaluateShadowMeasurementReadiness
} from "./push38-shadow-qualification-policy.mjs";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const requestedEndpoint = String(process.env.DVR_SHADOW_ENDPOINT || "").trim();
const requestedChannels = String(process.env.DVR_SHADOW_CHANNELS ||
  process.env.DVR_SHADOW_CHANNEL || "1").split(",").map(value => Number(value.trim()));
const channels = [...new Set(requestedChannels)];
const isolatedMultiChannel = process.env.DVR_SHADOW_ISOLATED === "1";
const homeSourceAvailableChannels = [1, 2, 3, 4, 5, 6, 7, 10, 11];
const channel = channels[0];
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
const expectReactiveOnly = process.env.DVR_SHADOW_EXPECT_REACTIVE_ONLY === "1";
const requestedTransport = String(process.env.DVR_SHADOW_TRANSPORT || "native_http_mp4").trim();
if (!["native_http_mp4", "private_rtsp"].includes(requestedTransport))
  throw new Error("DVR_SHADOW_TRANSPORT is invalid");
if (channels.length < 1 || channels.length > (isolatedMultiChannel ? 9 : 2) ||
  channels.some(value => !Number.isInteger(value) || value < 1 || value > 64))
  throw new Error("DVR_SHADOW_CHANNELS exceeds the bounded qualification scope");
if (channels.length > 2 && (!isolatedMultiChannel ||
  channels.length !== homeSourceAvailableChannels.length ||
  channels.some((value, index) => value !== homeSourceAvailableChannels[index])))
  throw new Error("DVR_SHADOW_ISOLATED requires the exact nine source-available Home channels");
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
    // The installed Gateway keeps its canonical profile untouched. The
    // explicit qualification-only vendor class makes the existing RTSP
    // adapter run against this private recorder instead of the native HTTP
    // MP4 adapter, so transport can be compared side-by-side without a live
    // configuration or ownership change.
    vendor: requestedTransport === "private_rtsp"
      ? "xmeye_rtsp" : profile.metadata?.vendor || profile.vendor,
    channel_filter: channels,
    expected_channel_count: Number(profile.metadata?.expected_channel_count || profile.channel_count || 16),
    shadow_qualification: true,
    read_only_requested: true
  }
};

const hlsRoot = mkdtempSync(join(tmpdir(), "observer-p38-dvr-shadow-"));
const base = `http://127.0.0.1:${port}`;
const shadowSecret = randomBytes(32).toString("base64url");
const processStartedAt = Date.now();
let measurementStartedAt = processStartedAt;
const evidence = {
  contract: "observer-push38-bounded-dvr-shadow-v1",
  started_at: new Date(processStartedAt).toISOString(),
  mode: channels.length === 1 ? "READ_ONLY_ONE_CHANNEL_SHADOW"
    : channels.length === 2 ? "READ_ONLY_TWO_CHANNEL_SHADOW"
      : "READ_ONLY_ISOLATED_NINE_CHANNEL_SHADOW",
  transport: requestedTransport,
  channel,
  channels,
  endpoint_redacted: true,
  credentials_recorded: false,
  cloud_access_enabled: false,
  runtime_mutation: false,
  runtime_source: runtimeSource.sourceClass,
  discovery_attempts: [],
  signed_release: runtimeSource.signedRelease,
  expected_relay_policy: expectReactiveOnly ? "REACTIVE_OUTPUT_RESCUE_ONLY" : "HANDOFF_REQUIRED",
  playback_every_checkpoint: playbackEveryCheckpoint,
  checkpoints: []
};
let child;

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function jsonFetch(url, options = {}) {
  const { timeoutMs = 20_000, ...requestOptions } = options;
  const response = await fetch(url, { ...requestOptions,
    signal: AbortSignal.timeout(timeoutMs) });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}
async function waitForServer() {
  // The nine-source isolated proof runs immediately after a five-minute DVR
  // session drain and performs the full local readiness warm-up on a host that
  // is also restoring protected Edge state. The single-source path normally
  // listens inside twenty seconds; give the exact isolated nine-source mode a
  // bounded ninety-second startup window without weakening measurement
  // readiness or extending any relay/health threshold.
  const deadline = Date.now() + (isolatedMultiChannel ? 90_000 : 20_000);
  while (Date.now() < deadline) {
    if (child?.exitCode !== null)
      throw new Error("Shadow Gateway exited before startup");
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
  const segmentName = playlistLines.filter(line => /^segment-\d+\.ts\?/.test(line)).at(-1);
  const mediaSequence = Number(/^#EXT-X-MEDIA-SEQUENCE:(\d+)$/.exec(
    playlistLines.find(line => line.startsWith("#EXT-X-MEDIA-SEQUENCE:")) || "")?.[1]);
  const targetDurationSeconds = Number(/^#EXT-X-TARGETDURATION:(\d+)$/.exec(
    playlistLines.find(line => line.startsWith("#EXT-X-TARGETDURATION:")) || "")?.[1]);
  const latestSegmentSequence = Number.isInteger(mediaSequence)
    ? mediaSequence + playlistLines.filter(line => /^segment-\d+\.ts\?/.test(line)).length - 1
    : null;
  const segmentUrl = segmentName ? new URL(segmentName, grant.data.playback.hls_url).toString() : "";
  const segmentResponse = segmentUrl ? await fetch(segmentUrl, { signal: AbortSignal.timeout(20_000) }).catch(() => null) : null;
  const segment = segmentResponse?.ok ? Buffer.from(await segmentResponse.arrayBuffer()) : Buffer.alloc(0);
  return { status: grant.status, playlist_status: playlistResponse?.status || 0,
    segment_status: segmentResponse?.status || 0, segment_bytes: segment.byteLength,
    media_sequence: Number.isInteger(mediaSequence) ? mediaSequence : null,
    target_duration_seconds: Number.isInteger(targetDurationSeconds) ? targetDurationSeconds : null,
    latest_segment_sequence: Number.isInteger(latestSegmentSequence) && latestSegmentSequence >= 0
      ? latestSegmentSequence : null,
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
      renewing: body.mediaHeartbeat.renewingRelays ?? 0,
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
          last_native_input_end_at: source.last_native_input_end_at ?? null,
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
          renewing: input.renewing ?? false,
          playback_continuity: input.playback_continuity ?? false,
          owner_state: input.owner_state ?? null,
          media_owner_state: input.media_owner_state ?? null,
          canonical_owner_progressing: input.canonical_owner_progressing ?? null,
          candidate_progressing: input.candidate_progressing ?? null,
          native_input_ended: input.native_input_ended ?? false,
        input_idle_ms: input.input_idle_ms ?? null,
        relay_age_ms: input.relay_age_ms ?? null,
        output_idle_ms: input.output_idle_ms ?? null
      })) : []
    } : null,
    recorder_session: body.recorderSessionLifecycle ? {
      login_attempts: body.recorderSessionLifecycle.login_attempts,
      login_succeeded: body.recorderSessionLifecycle.login_succeeded,
      last_login_status: body.recorderSessionLifecycle.last_login_status,
      last_login_error_code: body.recorderSessionLifecycle.last_login_error_code,
      last_login_at: body.recorderSessionLifecycle.last_login_at,
      last_login_range_status: body.recorderSessionLifecycle.last_login_range_status,
      rotations: body.recorderSessionLifecycle.rotations,
      proactive_attempts: body.recorderSessionLifecycle.proactive_attempts,
      proactive_succeeded: body.recorderSessionLifecycle.proactive_succeeded,
      logout_attempts: body.recorderSessionLifecycle.logout_attempts,
      logout_succeeded: body.recorderSessionLifecycle.logout_succeeded,
      logout_failed: body.recorderSessionLifecycle.logout_failed,
      last_logout_status: body.recorderSessionLifecycle.last_logout_status,
      last_logout_result: body.recorderSessionLifecycle.last_logout_result,
      last_logout_error_code: body.recorderSessionLifecycle.last_logout_error_code,
      last_logout_at: body.recorderSessionLifecycle.last_logout_at,
      last_rotation_reason: body.recorderSessionLifecycle.last_rotation_reason,
      active_sessions: body.recorderSessionLifecycle.active_sessions,
      retired_session_backlog: Array.isArray(body.recorderSessionLifecycle.sessions)
        ? body.recorderSessionLifecycle.sessions.reduce((total, session) =>
          total + Number(session.retired_session_backlog || 0), 0) : 0
    } : null
  };
}
async function waitForSettledHandoff() {
  const startedAt = Date.now();
  const maximumWaitMs = PRIVATE_NVR_OUTPUT_RESCUE_PROBATION_MS + 2_000;
  const samples = [];
  let consecutiveSettled = 0;
  let last = null;
  while (Date.now() - startedAt <= maximumWaitMs) {
    last = await health(`${base}/health`);
    const candidates = Number(last.media?.candidate_handoffs || 0);
    const provisionals = Number(last.media?.provisional_handoffs || 0);
    const progressing = Number(last.media?.progressing || 0);
    const rotations = Number(last.recorder_session?.rotations || 0);
    const logoutSucceeded = Number(last.recorder_session?.logout_succeeded || 0);
    const retiredBacklog = Number(last.recorder_session?.retired_session_backlog || 0);
    samples.push({ observed_at: new Date().toISOString(), candidates, provisionals,
      progressing, rotations, logout_succeeded: logoutSucceeded,
      retired_session_backlog: retiredBacklog, http: last.http });
    consecutiveSettled = last.http === 200 && candidates === 0 && provisionals === 0
      && progressing === channels.length && retiredBacklog === 0
      && logoutSucceeded === rotations ? consecutiveSettled + 1 : 0;
    if (consecutiveSettled >= 2) return { settled: true, elapsed_ms: Date.now() - startedAt,
      maximum_wait_ms: maximumWaitMs, samples, health: last };
    await sleep(250);
  }
  return { settled: false, elapsed_ms: Date.now() - startedAt,
    maximum_wait_ms: maximumWaitMs, samples, health: last };
}
async function waitForMeasurementReadiness(selected) {
  const startedAt = Date.now();
  const maximumWaitMs = 120_000;
  const minimumStableMs = 30_000;
  const sampleIntervalMs = 1_000;
  let stableSamples = [];
  const resetReasons = new Set([
    "COMPONENT_NOT_STABLE", "CHANNEL_SET_MISMATCH", "INVALID_RENEWAL",
    "SEQUENCE_REGRESSION", "ADVANCE_WITHOUT_NEW_SEGMENT",
    "SAME_SEQUENCE_DIFFERENT_SEGMENT", "PLAYLIST_FRESHNESS_EXCEEDED"
  ]);
  while (Date.now() - startedAt <= maximumWaitMs) {
    const sample = {
      observed_at: new Date().toISOString(),
      renewals: await Promise.all(selected.map(async item => ({
        channel: item.channel,
        playback: await playback(item.stream_id)
      }))),
      shadow: await health(`${base}/health`)
    };
    stableSamples.push(sample);
    const readiness = evaluateShadowMeasurementReadiness(stableSamples, {
      expectedProgressing: channels.length,
      minimumStableMs
    });
    if (readiness.pass) return { ...readiness, elapsed_ms: Date.now() - startedAt,
      maximum_wait_ms: maximumWaitMs, minimum_stable_ms: minimumStableMs,
      samples: stableSamples };
    if (resetReasons.has(readiness.reason)) stableSamples = [sample];
    await sleep(sampleIntervalMs);
  }
  return { pass: false, reason: "MEASUREMENT_READINESS_TIMEOUT",
    elapsed_ms: Date.now() - startedAt, maximum_wait_ms: maximumWaitMs,
    minimum_stable_ms: minimumStableMs, samples: stableSamples };
}
function persist() {
  mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });
  const temporary = `${outputPath}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, outputPath);
  chmodSync(outputPath, 0o600);
}
function waitForChildExit(timeoutMs) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve(true);
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      child.off("exit", onExit);
      resolve(false);
    }, timeoutMs);
    child.once("exit", onExit);
  });
}
async function stopChild() {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  if (!await waitForChildExit(5_000)) {
    child.kill("SIGKILL");
    await waitForChildExit(2_000);
  }
}

if (channels.length > 2) {
  const liveGateway = await fetch("http://127.0.0.1:18082/health/live", {
    signal: AbortSignal.timeout(2_000)
  }).catch(() => null);
  if (liveGateway?.ok)
    throw new Error("DVR_SHADOW_ISOLATED_LIVE_GATEWAY_MUST_BE_STOPPED");
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
      VIDEO_GATEWAY_SHADOW_ISOLATED: isolatedMultiChannel ? "1" : "0",
      VIDEO_GATEWAY_SHADOW_ALLOWED_CHANNELS: channels.join(","),
      VIDEO_GATEWAY_SHADOW_HLS_ROOT: hlsRoot,
      VIDEO_GATEWAY_SIGNING_SECRET: shadowSecret,
      DVR_EXPECTED_CHANNEL_COUNT: String(qualificationProfile.metadata.expected_channel_count)
    },
    stdio: ["ignore", "ignore", "ignore"]
  });
  await waitForServer();
  let discovery = null;
  let selected = [];
  // The owned recorder occasionally rejects the first read-only discovery
  // immediately after a prior login drains. The installed runner already
  // retries this startup boundary. Mirror that bounded contract in Shadow,
  // while preserving every attempt so a later success cannot hide churn.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    discovery = await jsonFetch(`${base}/dvr/connect`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-video-gateway-secret": shadowSecret },
      body: JSON.stringify(qualificationProfile),
      timeoutMs: isolatedMultiChannel ? 120_000 : 20_000
    });
    selected = channels.map(selectedChannel =>
      discovery.data?.channels?.find((item) => item.channel === selectedChannel));
    evidence.discovery_attempts.push({ attempt, observed_at: new Date().toISOString(),
      http_status: discovery.status,
      selected: selected.map((item, index) => ({ channel: channels[index],
        status: item?.status || "missing", reason: item?.reason || "no_reason",
        template: item?.template || null })) });
    if (discovery.status === 200 && selected.every(item => item?.status === "connected"
      && item.stream_id && (requestedTransport !== "native_http_mp4"
        || item.template === "er_private_http_mp4"))) break;
    if (attempt < 3) await sleep(5_000);
  }
  if (discovery.status !== 200 || selected.some(item =>
    item?.status !== "connected" || !item.stream_id ||
    requestedTransport === "native_http_mp4" && item.template !== "er_private_http_mp4")) {
    const summary = selected.map((item, index) => ({ channel: channels[index],
      status: item?.status || "missing", reason: item?.reason || "no_reason" }));
    throw new Error(`Selected Shadow channels did not connect: HTTP ${discovery.status}, ${JSON.stringify(summary)}`);
  }
  evidence.discovery = {
    status: discovery.status,
    selected_channel_status: selected[0].status,
    codec: selected[0].codec,
    width: selected[0].width,
    height: selected[0].height,
    selected_channels: selected.map(item => ({ channel: item.channel,
      status: item.status, template: item.template, codec: item.codec,
      width: item.width, height: item.height })),
    total_slots: discovery.data.channel_count,
    assigned: discovery.data.channel_count - discovery.data.unassigned_channel_count,
    unassigned: discovery.data.unassigned_channel_count
  };
  evidence.measurement_readiness = await waitForMeasurementReadiness(selected);
  if (!evidence.measurement_readiness.pass)
    throw new Error(`Shadow measurement readiness failed: ${evidence.measurement_readiness.reason}`);
  measurementStartedAt = Date.now();
  evidence.measurement_started_at = new Date(measurementStartedAt).toISOString();
  persist();
  let sequence = 0;
  while (Date.now() - measurementStartedAt < durationMs) {
    const renewals = playbackEveryCheckpoint || sequence % 2 === 0
      ? await Promise.all(selected.map(async item => ({ channel: item.channel,
        playback: await playback(item.stream_id) }))) : [];
    const point = {
      sequence: ++sequence,
      observed_at: new Date().toISOString(),
      elapsed_ms: Date.now() - measurementStartedAt,
      renewal: renewals[0]?.playback ?? null,
      renewals,
      shadow: await health(`${base}/health`),
      legacy: await health("http://127.0.0.1:18082/health")
    };
    evidence.checkpoints.push(point);
    persist();
    process.stdout.write(`${JSON.stringify({ sequence: point.sequence, observed_at: point.observed_at, shadow: point.shadow, legacy: point.legacy })}\n`);
    await sleep(intervalMs);
  }
  evidence.measurement_ended_at = new Date().toISOString();
  evidence.duration_ms = Date.now() - measurementStartedAt;
  evidence.pre_validation_settling = await waitForSettledHandoff();
  const finalRenewals = playbackEveryCheckpoint
    ? await Promise.all(selected.map(async item => ({ channel: item.channel,
      playback: await playback(item.stream_id) }))) : [];
  evidence.settling = await waitForSettledHandoff();
  evidence.final_health = evidence.settling.health;
  evidence.final_verification = {
    sequence: evidence.checkpoints.length + 1,
    observed_at: new Date().toISOString(),
    elapsed_ms: Date.now() - measurementStartedAt,
    renewal: finalRenewals[0]?.playback ?? null,
    renewals: finalRenewals,
    shadow: evidence.final_health,
    terminal_verification: true
  };
  evidence.ended_at = new Date().toISOString();
  evidence.total_duration_ms = Date.now() - processStartedAt;
  const finalPoint = { shadow: evidence.final_health };
  const qualificationCheckpoints = [...evidence.checkpoints, evidence.final_verification];
  const lifecycle = evidence.final_health?.media?.lifecycle || {};
  const playbackFailures = playbackEveryCheckpoint
    ? qualificationCheckpoints.flatMap(point => point.renewals).filter(entry =>
      entry.playback?.status !== 200 || entry.playback?.playlist_status !== 200 ||
      entry.playback?.segment_status !== 200 || !(entry.playback?.segment_bytes > 0)).length
    : 0;
  const failures = [];
  const warnings = [];
  const routineHandoffFailures = Number(
    lifecycle.warmHandoffFailuresByMode?.routineFiniteResponse || 0);
  const outputRescueFailures = Number(
    lifecycle.warmHandoffFailuresByMode?.outputRescue || 0);
  const outputRescueClassification = classifyBoundedOutputRescueRejection(
    qualificationCheckpoints, lifecycle, { expectedProgressing: channels.length });
  const ownerRecoveryClassification = classifyContainedOwnerRecovery(
    qualificationCheckpoints, { expectedProgressing: channels.length });
  const hlsContinuityByChannel = playbackEveryCheckpoint ? channels.map(selectedChannel => ({
    channel: selectedChannel,
    ...evaluateHlsRenewalContinuity(qualificationCheckpoints.map(point => ({
      observed_at: point.observed_at,
      renewal: point.renewals.find(entry => entry.channel === selectedChannel)?.playback
    })))
  })) : [];
  const hlsContinuity = playbackEveryCheckpoint
    ? { pass: hlsContinuityByChannel.every(value => value.pass),
      channels: hlsContinuityByChannel,
      reason: hlsContinuityByChannel.find(value => !value.pass)?.reason ?? null }
    : { pass: true, reason: null };
  const sessionRenewalClassification = classifyContinuousSessionRenewal(
    qualificationCheckpoints, lifecycle, finalPoint?.shadow.recorder_session || {},
    { expectedProgressing: channels.length });
  const maximumBoundedRoutineFailures = Math.max(1,
    Math.ceil(evidence.duration_ms / PRIVATE_NVR_ROUTINE_HANDOFF_RETRY_BACKOFF_MS));
  if (!evidence.checkpoints.every((point) => point.shadow.http === 200
    && point.shadow.discovery?.assigned === channels.length
    && point.shadow.discovery?.connected === channels.length
    && Number(point.shadow.media?.progressing || 0)
      + Number(point.shadow.media?.renewing || 0) === channels.length
    && Number(point.shadow.media?.stalled || 0) === 0)) failures.push("SHADOW_PROGRESSION");
  if (playbackFailures > 0) failures.push("PLAYBACK_CONTINUITY");
  if (outputRescueFailures > 0 && !outputRescueClassification.pass)
    failures.push("OUTPUT_RESCUE_FAILURE");
  else if (outputRescueClassification.warning) warnings.push(outputRescueClassification.warning);
  if (!hlsContinuity.pass) failures.push("PLAYLIST_CONTINUITY");
  if (expectReactiveOnly && Number(lifecycle.startsByReason?.routineFiniteResponse || 0) > 0)
    failures.push("AGE_ONLY_ROUTINE_HANDOFF_OBSERVED");
  if (routineHandoffFailures > maximumBoundedRoutineFailures)
    failures.push("ROUTINE_HANDOFF_RETRY_STORM");
  else if (routineHandoffFailures > 0)
    warnings.push("BOUNDED_ROUTINE_CANDIDATE_REJECTED_WITHOUT_MEDIA_GAP");
  // A real replacement promotion is not required when every early rescue probe
  // is safely cancelled because the canonical owner recovered. That is the
  // exact 0.2.65 behavior under qualification, and it is accepted only when the
  // event is explicitly diagnosed and owner/playback continuity is proven at
  // its first checkpoint.
  if (!expectReactiveOnly && durationMs >= 2 * 60_000 &&
    (lifecycle.warmHandoffs || 0) < 1 && !ownerRecoveryClassification.pass)
    failures.push("NO_SUCCESSFUL_HANDOFF_OBSERVED");
  else if (ownerRecoveryClassification.pass)
    warnings.push("CONTAINED_OUTPUT_RESCUE_OWNER_RECOVERY_WITHOUT_MEDIA_GAP");
  if ((lifecycle.stalePlaylist || 0) > 0) failures.push("STALE_PLAYLIST");
  if ((lifecycle.staleInput || 0) > 0) failures.push("STALE_INPUT");
  if ((lifecycle.staleOnRequest || 0) > 0) failures.push("STALE_ON_REQUEST");
  if ((lifecycle.inputSocketError || 0) > 0 && !sessionRenewalClassification.pass)
    failures.push("INPUT_SOCKET");
  if ((lifecycle.startsByReason?.recovery || 0) > 0
    && !sessionRenewalClassification.pass) failures.push("RELAY_RECOVERY_GAP");
  if (!evidence.settling.settled
    || (evidence.final_health?.media?.candidate_handoffs || 0) > 0
    || (evidence.final_health?.media?.provisional_handoffs || 0) > 0)
    failures.push("HANDOFF_NOT_SETTLED");
  if (!sessionRenewalClassification.pass)
    failures.push("SESSION_ROTATION");
  else if (sessionRenewalClassification.warning)
    warnings.push(sessionRenewalClassification.warning);
  evidence.qualification = {
    playback_failures: playbackFailures,
    lifecycle_final: lifecycle,
    recorder_session_final: finalPoint?.shadow.recorder_session || null,
    source_diagnostics_final: finalPoint?.shadow.media?.source_diagnostics || [],
    routine_handoff_failures: routineHandoffFailures,
    output_rescue_failures: outputRescueFailures,
    output_rescue_classification: outputRescueClassification,
    owner_recovery_classification: ownerRecoveryClassification,
    session_renewal_classification: sessionRenewalClassification,
    hls_continuity: hlsContinuity,
    maximum_bounded_routine_failures: maximumBoundedRoutineFailures,
    warnings,
    failures
  };
  evidence.result = failures.length === 0 ? "PASS" : "FAIL";
  persist();
  process.stdout.write(`${JSON.stringify({ result: evidence.result, duration_ms: evidence.duration_ms, checkpoints: evidence.checkpoints.length, output: outputPath })}\n`);
  if (evidence.result !== "PASS") process.exitCode = 1;
} catch (error) {
  evidence.ended_at = new Date().toISOString();
  evidence.total_duration_ms = Date.now() - processStartedAt;
  evidence.result = "FAIL";
  evidence.failure = {
    code: String(error?.message || error?.name || "SHADOW_QUALIFICATION_FAILED")
  };
  persist();
  throw error;
} finally {
  await stopChild();
  rmSync(hlsRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  if (runtimeSource.cleanupRoot) rmSync(runtimeSource.cleanupRoot,
    { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
