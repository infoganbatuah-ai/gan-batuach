import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, statfsSync, writeFileSync } from "node:fs";
import { freemem, loadavg, totalmem, uptime } from "node:os";
import { join } from "node:path";
import { startJournalLoop } from "../services/video-gateway/journal-loop.mjs";
import { createContinuousMonitoringLifecycle } from "../services/video-gateway/continuous-monitor.mjs";
import { acquireJournalOwnerLock } from "../services/video-gateway/journal-owner-lock.mjs";
import { connectorRuntimeIdentity, createInstallationId, validateConnectorConfigSnapshot } from "../services/video-gateway/edge-runtime-contract.mjs";
import { createEdgeSecretStoreSync } from "../services/video-gateway/edge-secret-store-sync.mjs";

const workdir = process.cwd();
const dataRoot = process.env.OBSERVER_EDGE_DATA_DIR || workdir;
mkdirSync(dataRoot, { recursive: true, mode: 0o700 });
const gatewayUrl = "http://127.0.0.1:18082";
const edgeDeviceType = process.env.OBSERVER_EDGE_DEVICE_TYPE === "SOFTWARE_CONNECTOR" ? "SOFTWARE_CONNECTOR" : "PHYSICAL_GATEWAY";
const gatewayKeychainService = process.env.GAN_BATUACH_GATEWAY_KEYCHAIN_SERVICE || "com.ganbatuach.video-gateway.runtime";
const dvrKeychainService = process.env.GAN_BATUACH_GATEWAY_DVR_KEYCHAIN_SERVICE || gatewayKeychainService;
const gatewaySecretDir = process.env.GAN_BATUACH_GATEWAY_SECRET_DIR || "";
const dvrSecretDir = process.env.GAN_BATUACH_GATEWAY_DVR_SECRET_DIR || gatewaySecretDir;
const gatewayStore = createEdgeSecretStoreSync({ keychainService: gatewayKeychainService, secretDir: gatewaySecretDir });
const dvrStore = createEdgeSecretStoreSync({ keychainService: dvrKeychainService, secretDir: dvrSecretDir });
const discoveryEnabled = process.env.GAN_BATUACH_GATEWAY_DISCOVERY === "1";
const DISCOVERY_RETRY_DELAY_MS = 20_000;
const DISCOVERY_RETRY_ATTEMPTS = 2;
const EMPTY_DISCOVERY_CONFIRMATIONS = 3;
const VERIFIED_CONNECTED_COUNT_KEY = "last_verified_connected_channel_count";
const CLOUD_REQUEST_TIMEOUT_MS = 30_000;
const DISCOVERY_REQUEST_TIMEOUT_MS = 3 * 60 * 1000;
const INSIGHT_REQUEST_TIMEOUT_MS = 20_000;
const evidenceTestCameraId = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(process.env.GAN_BATUACH_GATEWAY_EVIDENCE_TEST_CAMERA_ID || "")
  ? process.env.GAN_BATUACH_GATEWAY_EVIDENCE_TEST_CAMERA_ID
  : null;
const spatialTraceEnabled = process.env.GAN_BATUACH_GATEWAY_SPATIAL_TRACE === "1";
// A one-camera evidence verification may safely sample more often without
// changing the normal multi-camera monitoring budget or Journal semantics.
// It remains opt-in and is removed with the diagnostic launchd setting.
const evidenceTestPollIntervalMs = evidenceTestCameraId ? 350 : undefined;
const connectorChannelFilter = String(process.env.OBSERVER_EDGE_CHANNELS || "").split(",")
  .map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value >= 1 && value <= 64);
const streamNamespace = String(process.env.OBSERVER_EDGE_STREAM_NAMESPACE || "").trim().replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 80);

function keychainSecret(account, service = gatewayKeychainService) { return service === dvrKeychainService ? dvrStore.read(account) : gatewayStore.read(account); }
function storeKeychainSecret(account, value) { gatewayStore.write(account, value); }

let gatewaySecret = keychainSecret("gateway_signing_secret");
if (!gatewaySecret) {
  gatewaySecret = crypto.randomBytes(32).toString("base64url");
  storeKeychainSecret("gateway_signing_secret", gatewaySecret);
}
let installationId = gatewayStore.read("device_installation_id");
if (!installationId) {
  installationId = createInstallationId();
  gatewayStore.write("device_installation_id", installationId);
}
process.env.OBSERVER_EDGE_INSTALLATION_ID = installationId;
process.env.OBSERVER_EDGE_DEVICE_TYPE = edgeDeviceType;
const edgeRuntime = connectorRuntimeIdentity(process.env);
const cloudSecret = keychainSecret("cloud_discovery_secret");
const deviceGatewayId = keychainSecret("device_gateway_id");
const deviceObserverSiteId = keychainSecret("device_observer_site_id");
const deviceRefreshToken = keychainSecret("device_refresh_token");
const gatewayId = deviceGatewayId || keychainSecret("cloud_gateway_id");
const observerSiteId = deviceObserverSiteId || keychainSecret("cloud_observer_site_id");
const missingCloudConfiguration = [
  !gatewaySecret && "gateway_signing_secret",
  !gatewayId && "device_gateway_id",
  !observerSiteId && "device_observer_site_id",
  !deviceRefreshToken && !cloudSecret && "device_refresh_token_or_cloud_discovery_secret"
].filter(Boolean);
if (missingCloudConfiguration.length) throw new Error(`Persistent gateway cloud configuration is incomplete: ${missingCloudConfiguration.join(",")}`);

let config = null;
let password = "";
if (discoveryEnabled) {
  const profileJson = keychainSecret("dvr_profile_json", dvrKeychainService);
  if (!profileJson) throw new Error("DVR profile is not available in the secure local store");
  config = JSON.parse(profileJson);
  password = keychainSecret("dvr_password", dvrKeychainService);
  if (!password) throw new Error("DVR credential is not available in the secure local store");
}

async function signedPost(path, payload, options = {}) {
  const body = JSON.stringify(payload);
  const localPath = path.endsWith("/cloud-discovery")
    ? "/cloud/discovery"
    : path.endsWith("/cloud-learning")
      ? "/cloud/learning"
      : path.endsWith("/device-heartbeat")
        ? "/cloud/heartbeat"
      : null;
  if (!localPath || options.deviceAccess !== true) throw new Error("Unsupported persistent Gateway cloud operation");
  // The child Gateway is the only owner of rotating device identity. The
  // runner sends a fixed, authenticated operation over loopback and never
  // receives an access or refresh token.
  const response = await fetch(`${gatewayUrl}${localPath}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-video-gateway-secret": gatewaySecret },
    body,
    signal: AbortSignal.timeout(CLOUD_REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`Cloud request failed (${response.status})`);
  return response.json();
}

const child = spawn(process.execPath, ["services/video-gateway/server.mjs"], { cwd: workdir, env: { ...process.env, HOST: "127.0.0.1", PORT: "18082", VIDEO_GATEWAY_SIGNING_SECRET: gatewaySecret, DVR_EXPECTED_CHANNEL_COUNT: String(config?.channel_count || 0), OBSERVER_EDGE_DEVICE_TYPE: edgeDeviceType, OBSERVER_EDGE_INSTALLATION_ID: installationId, GAN_BATUACH_GATEWAY_SECRET_DIR: gatewaySecretDir }, stdio: "inherit" });

async function waitForGateway() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`${gatewayUrl}/health`, { signal: AbortSignal.timeout(3_000) })).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Local gateway did not start");
}

let channels = [];
let consecutiveEmptyDiscoveries = 0;
async function discover() {
  const response = await fetch(`${gatewayUrl}/dvr/connect`, { method: "POST", headers: { "content-type": "application/json", "x-video-gateway-secret": gatewaySecret }, body: JSON.stringify({ connection_type: "dvr", endpoint: config.endpoint, port: config.port, username: config.username, password, metadata: { vendor: config.vendor, expected_channel_count: config.channel_count, read_only_requested: true, ...(connectorChannelFilter.length ? { channel_filter: connectorChannelFilter } : {}), ...(streamNamespace ? { stream_namespace: streamNamespace } : {}) } }), signal: AbortSignal.timeout(DISCOVERY_REQUEST_TIMEOUT_MS) });
  const result = await response.json();
  if (!response.ok) throw new Error("DVR discovery failed");
  channels = (result.channels || []).map((channel, index) => Object.fromEntries(Object.entries({ channel: Number(channel.channel || index + 1), name: channel.name, area: channel.area, stream_id: channel.stream_id, gateway_stream_id: channel.gateway_stream_id || channel.stream_id, status: channel.status, health_status: channel.health_status, width: channel.width ?? null, height: channel.height ?? null, candidates_tried: channel.candidates_tried, template: channel.template, reason: channel.reason, capabilities: channel.capabilities && typeof channel.capabilities === "object" ? channel.capabilities : {} }).filter(([, value]) => value !== undefined && value !== null)));
  const connectedChannels = channels.filter((channel) => channel.status === "connected");
  const previouslyVerified = Number(keychainSecret(VERIFIED_CONNECTED_COUNT_KEY) || 0);
  const hasUnconfirmedRegression = channels.length
    && (connectedChannels.length === 0 || (previouslyVerified > 0 && connectedChannels.length < previouslyVerified));
  if (hasUnconfirmedRegression) {
    consecutiveEmptyDiscoveries += 1;
    // A recorder can briefly reject all streams during session recovery. Do not
    // overwrite the dashboard's last known-good mapping until this is repeated.
    if (consecutiveEmptyDiscoveries < EMPTY_DISCOVERY_CONFIRMATIONS) {
      throw new Error("channel_regression_pending_confirmation");
    }
  } else {
    consecutiveEmptyDiscoveries = 0;
  }
  // Discovery starts relays and the object model. Publish the capability
  // contract observed afterwards so the cloud never keeps a stale startup
  // snapshot that disables analysis for otherwise healthy cameras.
  const health = await fetch(`${gatewayUrl}/health`, { signal: AbortSignal.timeout(10_000) })
    .then((healthResponse) => healthResponse.ok ? healthResponse.json() : {})
    .catch(() => ({}));
  const mapped = await signedPost("/api/video-gateway/cloud-discovery", { gateway_id: gatewayId, observer_site_id: observerSiteId, connection_type: "dvr", vendor: config.vendor, discovery_id: crypto.randomUUID(), discovered_at: new Date().toISOString(), channel_count: channels.length, connected_channel_count: channels.filter((channel) => channel.status === "connected").length, failed_channel_count: channels.filter((channel) => channel.status !== "connected").length, latency_ms: Number(result.latency_ms || 0), read_only: true, controls_supported: result.controls_supported === true, no_secrets_returned: true, channels, metadata: { source: edgeDeviceType === "SOFTWARE_CONNECTOR" ? "software_connector" : "persistent_home_gateway", device_type: edgeDeviceType, installation_id: installationId, runtime_contract: edgeRuntime.contract, ai_shadow_only: true, read_only: true, edge_capability_contract: health.edge_capability_contract ?? null } }, { deviceAccess: true });
  const mappedPayload = mapped?.data && typeof mapped.data === "object" ? mapped.data : mapped;
  const mappedChannels = Array.isArray(mappedPayload?.channels) ? mappedPayload.channels : [];
  channels = channels.map((channel) => {
    const mappedChannel = mappedChannels.find((item) => item?.gateway_stream_id === channel.gateway_stream_id);
    return { ...channel, camera_source_id: mappedChannel?.camera_source_id ?? channel.camera_source_id ?? null };
  });
  if (connectedChannels.length > 0) storeKeychainSecret(VERIFIED_CONNECTED_COUNT_KEY, String(connectedChannels.length));
}

let currentConfigVersion = 0;
const configCachePath = join(dataRoot, "connector-config.json");
try { currentConfigVersion = Number(JSON.parse(readFileSync(configCachePath, "utf8")).version || 0); } catch {}

async function heartbeat() {
  const health = await fetch(`${gatewayUrl}/health`, { signal: AbortSignal.timeout(5_000) }).then((response) => response.json());
  let diskFreeMb = null;
  try { const disk = statfsSync(dataRoot); diskFreeMb = Math.floor((disk.bavail * disk.bsize) / (1024 * 1024)); } catch {}
  const lastFrameAt = channels.map((channel) => Date.parse(channel.last_frame_at || channel.last_seen_at || "")).filter(Number.isFinite).sort((a, b) => b - a)[0];
  const payload = {
    heartbeat_id: crypto.randomUUID(), gateway_id: gatewayId, observer_site_id: observerSiteId, observed_at: new Date().toISOString(), runtime: edgeRuntime,
    health: {
      status: health.ok === true && (health.mediaHeartbeat?.stalledRelays || 0) === 0 ? "HEALTHY" : "DEGRADED",
      uptime_seconds: Math.floor(uptime()), cpu_percent: Math.max(0, Math.min(100, Math.round((loadavg()[0] || 0) * 100))),
      memory_mb: Math.round((totalmem() - freemem()) / (1024 * 1024)), disk_free_mb: diskFreeMb,
      camera_count: channels.length, streaming_count: channels.filter((channel) => channel.status === "connected").length,
      last_frame_at: Number.isFinite(lastFrameAt) ? new Date(lastFrameAt).toISOString() : null,
      error_codes: []
    }
  };
  const response = await signedPost("/api/video-gateway/device-heartbeat", payload, { deviceAccess: true });
  const next = response?.data?.config;
  if (next) {
    const snapshot = validateConnectorConfigSnapshot(next, currentConfigVersion);
    const temporary = `${configCachePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
    renameSync(temporary, configCachePath);
    currentConfigVersion = snapshot.version;
  }
}

async function runDiscoveryWithRetry(context, attempt = 0) {
  try {
    await discover();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "discovery_failed";
    if (attempt >= DISCOVERY_RETRY_ATTEMPTS) {
      console.error(`${context} DVR discovery unavailable; retry scheduled: ${message}`);
      return false;
    }
    console.error(`${context} DVR discovery retrying: ${message}`);
    await new Promise((resolve) => setTimeout(resolve, DISCOVERY_RETRY_DELAY_MS));
    return runDiscoveryWithRetry(context, attempt + 1);
  }
}

let discoveryRun = null;
function discoverWithRetry(context) {
  if (discoveryRun) return discoveryRun;
  discoveryRun = runDiscoveryWithRetry(context).finally(() => { discoveryRun = null; });
  return discoveryRun;
}

async function learn() {
  const samples = (await Promise.all(channels.filter((channel) => channel.status === "connected" && channel.gateway_stream_id).map(async (channel) => {
    try {
      const response = await fetch(`${gatewayUrl}/camera/${encodeURIComponent(channel.gateway_stream_id)}/insights`, { headers: { "x-video-gateway-secret": gatewaySecret }, signal: AbortSignal.timeout(INSIGHT_REQUEST_TIMEOUT_MS) });
      const data = await response.json();
      if (!response.ok || data.local_processing !== true || data.no_raw_video_returned !== true) return null;
      const detections = Array.isArray(data.insight?.object_detection?.detections) ? data.insight.object_detection.detections.filter((item) => item && typeof item.label === "string" && Number(item.confidence) >= 0.55).slice(0, 10) : [];
      return { channel, stream_id: channel.gateway_stream_id, motion_score: Number(data.insight.motion_score || 0), luminance_score: Number(data.insight.luminance_score || 0), sampled_at: String(data.insight.sampled_at || new Date().toISOString()), sample_frames: Number(data.insight.sample_frames || 1), detections };
    } catch { return null; }
  }))).filter(Boolean);
  if (!samples.length) return;
  await signedPost("/api/video-gateway/cloud-learning", { gateway_id: gatewayId, observer_site_id: observerSiteId, sample_id: crypto.randomUUID(), sampled_at: new Date().toISOString(), local_processing: true, no_raw_video_returned: true, samples: samples.map(({ stream_id, motion_score, luminance_score, sampled_at, sample_frames }) => ({ stream_id, motion_score, luminance_score, sampled_at, sample_frames })) }, { deviceAccess: true });
}


await waitForGateway();
let stopJournal = async () => {};
let releaseJournalOwner = () => {};
let continuousMonitor = { start: async () => undefined, stop: async () => undefined };
if (discoveryEnabled) {
  continuousMonitor = createContinuousMonitoringLifecycle({
    gatewayUrl,
    gatewaySecret,
    getChannels: () => channels,
    report: (status) => {
      const destination = `${dataRoot}/continuous-monitor-status.json`;
      const temporary = `${destination}.${process.pid}.${crypto.randomUUID()}.tmp`;
      writeFileSync(temporary, `${JSON.stringify(status, null, 2)}\n`, { mode: 0o600 });
      renameSync(temporary, destination);
    }
  });
  await continuousMonitor.start();
  // Start the local read-only lifecycle before cloud publication retries.
  // discover() publishes the local channel set before awaiting cloud mapping,
  // so the next monitor cycle acquires leases even when cloud sync is slow.
  await discoverWithRetry("initial");
  releaseJournalOwner = acquireJournalOwnerLock();
  stopJournal = startJournalLoop({ gatewayUrl, gatewaySecret, databasePath: `${dataRoot}/journal-outbox.sqlite`,
    personConfirmations: 2, cameraFilter: evidenceTestCameraId, pollIntervalMs: evidenceTestPollIntervalMs,
    spatialTrace: spatialTraceEnabled,
    report: (status) => writeFileSync(`${dataRoot}/journal-status.json`, JSON.stringify(status), { mode: 0o600 }) });
  await learn().catch((error) => {
    // Cloud identity rotation or learning upload must never own the local live
    // process lifecycle. Keep relays available and retry learning on schedule.
    console.error(`initial cloud learning unavailable; live remains active: ${error instanceof Error ? error.message : "learning_failed"}`);
  });
  setInterval(() => void learn().catch((error) => console.error(error.message)), 5 * 60 * 1000).unref();
  setInterval(() => void discoverWithRetry("scheduled"), 15 * 60 * 1000).unref();
}
await heartbeat().catch((error) => console.error(`initial connector heartbeat unavailable; retry scheduled: ${error instanceof Error ? error.message : "heartbeat_failed"}`));
setInterval(() => void heartbeat().catch((error) => console.error(`connector heartbeat unavailable: ${error instanceof Error ? error.message : "heartbeat_failed"}`)), 30_000).unref();

let shuttingDown = false;
async function shutdown(exitCode = 0, terminateChild = true) {
  if (shuttingDown) return;
  shuttingDown = true;
  await continuousMonitor.stop();
  await stopJournal();
  releaseJournalOwner();
  if (terminateChild && child.exitCode === null && !child.killed) child.kill("SIGTERM");
  process.exit(exitCode);
}
process.on("SIGINT", () => void shutdown(0, true));
process.on("SIGTERM", () => void shutdown(0, true));
child.on("exit", (code) => void shutdown(code || 1, false));
