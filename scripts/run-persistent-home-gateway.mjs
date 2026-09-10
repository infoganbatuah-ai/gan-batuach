import "../services/video-gateway/http-runtime.mjs";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, statfsSync, writeFileSync } from "node:fs";
import { cpus, freemem, loadavg, totalmem, uptime } from "node:os";
import { join } from "node:path";
import { startJournalLoop } from "../services/video-gateway/journal-loop.mjs";
import { createContinuousMonitoringLifecycle } from "../services/video-gateway/continuous-monitor.mjs";
import { acquireJournalOwnerLock } from "../services/video-gateway/journal-owner-lock.mjs";
import { connectorRuntimeIdentity, createInstallationId, validateConnectorConfigSnapshot } from "../services/video-gateway/edge-runtime-contract.mjs";
import { createEdgeSecretStoreSync } from "../services/video-gateway/edge-secret-store-sync.mjs";
import { createAdaptiveSamplingScheduler } from "../services/video-gateway/adaptive-sampling-scheduler.mjs";

const workdir = process.cwd();
const dataRoot = process.env.OBSERVER_EDGE_DATA_DIR || workdir;
mkdirSync(dataRoot, { recursive: true, mode: 0o700 });
const gatewayPort = Number(process.env.VIDEO_GATEWAY_PORT || (process.env.OBSERVER_EDGE_DEVICE_TYPE === "SOFTWARE_CONNECTOR" ? 18083 : 18082));
if (!Number.isInteger(gatewayPort) || gatewayPort < 1024 || gatewayPort > 65535) throw new Error("Invalid local Gateway port");
const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
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
const devicePrivateKey = keychainSecret("device_private_key_pkcs8");
const gatewayId = deviceGatewayId || keychainSecret("cloud_gateway_id");
const observerSiteId = deviceObserverSiteId || keychainSecret("cloud_observer_site_id");
const missingCloudConfiguration = [
  !gatewaySecret && "gateway_signing_secret",
  !gatewayId && "device_gateway_id",
  !observerSiteId && "device_observer_site_id",
  !devicePrivateKey && !deviceRefreshToken && !cloudSecret && "device_identity_or_cloud_discovery_secret"
].filter(Boolean);
if (missingCloudConfiguration.length) throw new Error(`Persistent gateway cloud configuration is incomplete: ${missingCloudConfiguration.join(",")}`);

let configurations = [];
if (discoveryEnabled) {
  const connectorProfiles = edgeDeviceType === "SOFTWARE_CONNECTOR" ? keychainSecret("connector_profiles_json", dvrKeychainService) : "";
  if (connectorProfiles) {
    const parsedProfiles = JSON.parse(connectorProfiles);
    if (!Array.isArray(parsedProfiles) || !parsedProfiles.length || parsedProfiles.length > 32) throw new Error("Connector camera profile set is invalid");
    configurations = parsedProfiles.map((profile, index) => {
      if (!profile || profile.connection_type !== "rtsp" || !profile.endpoint || !profile.username || !profile.password
        || !profile.stream_namespace || Number(profile.channel_count || 1) < 1 || Number(profile.channel_count || 1) > 64) {
        throw new Error("Connector camera profile is incomplete");
      }
      return { ...profile, profile_index: index + 1 };
    });
  } else {
    const profileJson = keychainSecret("dvr_profile_json", dvrKeychainService);
    if (!profileJson) throw new Error("DVR profile is not available in the secure local store");
    const profile = JSON.parse(profileJson);
    const password = keychainSecret("dvr_password", dvrKeychainService);
    if (!password) throw new Error("DVR credential is not available in the secure local store");
    configurations = [{ ...profile, password, stream_namespace: streamNamespace, profile_index: 1 }];
  }
}
const expectedChannelCount = configurations.reduce((total, profile) => total + Number(profile.channel_count || 0), 0);

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
  const responseText = await response.text();
  if (!response.ok) {
    let category = "upstream_error";
    try {
      const parsed = JSON.parse(responseText);
      const fields = parsed.details?.fieldErrors && typeof parsed.details.fieldErrors === "object"
        ? Object.keys(parsed.details.fieldErrors).slice(0, 12).join(",")
        : "";
      const validation = parsed.details?.fieldErrors && typeof parsed.details.fieldErrors === "object"
        ? Object.values(parsed.details.fieldErrors).flat().map(String).slice(0, 2).join(" ")
        : "";
      category = `${String(parsed.error || parsed.code || category)}${fields ? ` fields:${fields}` : ""}${validation ? ` ${validation}` : ""}`
        .replace(/https?:\/\/\S+/gi, "[redacted-url]")
        .replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]")
        .replace(/[^\p{L}\p{N}_.: -]/gu, "")
        .slice(0, 160) || category;
    } catch {}
    console.error(JSON.stringify({ level: "warning", domain: "gateway_cloud", action: localPath.slice(1), status: response.status, category }));
    throw new Error(`Cloud request failed (${response.status}:${category})`);
  }
  return JSON.parse(responseText);
}

const child = spawn(process.execPath, ["services/video-gateway/server.mjs"], { cwd: workdir, env: { ...process.env, HOST: "127.0.0.1", PORT: String(gatewayPort), VIDEO_GATEWAY_SIGNING_SECRET: gatewaySecret, DVR_EXPECTED_CHANNEL_COUNT: String(expectedChannelCount), OBSERVER_EDGE_DEVICE_TYPE: edgeDeviceType, OBSERVER_EDGE_INSTALLATION_ID: installationId, GAN_BATUACH_GATEWAY_SECRET_DIR: gatewaySecretDir }, stdio: "inherit" });

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
  const discovered = [];
  let latencyMs = 0;
  for (const profile of configurations) {
    const connectionType = profile.connection_type === "rtsp" || profile.connection_type === "onvif" ? profile.connection_type : "dvr";
    const response = await fetch(`${gatewayUrl}/dvr/connect`, { method: "POST", headers: { "content-type": "application/json", "x-video-gateway-secret": gatewaySecret }, body: JSON.stringify({ connection_type: connectionType, endpoint: profile.endpoint, port: profile.port, username: profile.username, password: profile.password, metadata: { vendor: profile.vendor, expected_channel_count: profile.channel_count, read_only_requested: true, ...(edgeDeviceType === "PHYSICAL_GATEWAY" && connectorChannelFilter.length ? { channel_filter: connectorChannelFilter } : {}), ...(profile.stream_namespace ? { stream_namespace: profile.stream_namespace } : {}) } }), signal: AbortSignal.timeout(DISCOVERY_REQUEST_TIMEOUT_MS) });
    const result = await response.json();
    if (!response.ok) throw new Error("DVR discovery failed");
    latencyMs += Number(result.latency_ms || 0);
    discovered.push(...(result.channels || []).map((channel, index) => Object.fromEntries(Object.entries({
      channel: edgeDeviceType === "SOFTWARE_CONNECTOR" ? discovered.length + index + 1 : Number(channel.channel || index + 1),
      name: channel.name, area: channel.area,
      stream_id: channel.stream_id, gateway_stream_id: channel.gateway_stream_id || channel.stream_id,
      status: channel.status, health_status: channel.health_status, width: channel.width ?? null,
      height: channel.height ?? null, candidates_tried: channel.candidates_tried, template: channel.template,
      reason: channel.reason, capabilities: channel.capabilities && typeof channel.capabilities === "object" ? channel.capabilities : {}
    }).filter(([, value]) => value !== undefined && value !== null))));
  }
  channels = discovered;
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
  const connectionType = configurations.length === 1 && ["rtsp", "onvif"].includes(configurations[0]?.connection_type) ? configurations[0].connection_type : "dvr";
  const vendor = configurations.length === 1 ? configurations[0]?.vendor : "mixed";
  const mapped = await signedPost("/api/video-gateway/cloud-discovery", { gateway_id: gatewayId, observer_site_id: observerSiteId, connection_type: connectionType, vendor, discovery_id: crypto.randomUUID(), discovered_at: new Date().toISOString(), channel_count: channels.length, connected_channel_count: channels.filter((channel) => channel.status === "connected").length, failed_channel_count: channels.filter((channel) => !["connected", "unassigned"].includes(channel.status)).length, unassigned_channel_count: channels.filter((channel) => channel.status === "unassigned").length, latency_ms: latencyMs, read_only: true, controls_supported: false, no_secrets_returned: true, channels, metadata: { source: edgeDeviceType === "SOFTWARE_CONNECTOR" ? "software_connector" : "persistent_home_gateway", device_type: edgeDeviceType, installation_id: installationId, runtime_contract: edgeRuntime.contract, ai_shadow_only: true, read_only: true, multi_profile: configurations.length > 1, edge_capability_contract: health.edge_capability_contract ?? null } }, { deviceAccess: true });
  const mappedPayload = mapped?.data && typeof mapped.data === "object" ? mapped.data : mapped;
  const mappedChannels = Array.isArray(mappedPayload?.channels) ? mappedPayload.channels : [];
  channels = channels.map((channel) => {
    const mappedChannel = mappedChannels.find((item) => item?.gateway_stream_id === channel.gateway_stream_id);
    return { ...channel, camera_source_id: mappedChannel?.camera_source_id ?? channel.camera_source_id ?? null };
  });
  if (connectedChannels.length > 0) storeKeychainSecret(VERIFIED_CONNECTED_COUNT_KEY, String(connectedChannels.length));
}

let currentConfigVersion = 0;
let pendingCommandResults = [];
const configCachePath = join(dataRoot, "connector-config.json");
try { currentConfigVersion = Number(JSON.parse(readFileSync(configCachePath, "utf8")).version || 0); } catch {}

async function heartbeat() {
  const health = await fetch(`${gatewayUrl}/health`, { signal: AbortSignal.timeout(5_000) }).then((response) => response.json());
  let offlineBuffer = { contract: "observer-offline-buffer-v1", state: "UNKNOWN", queue_depth: null, queue_bytes: null, oldest_item_age_ms: null, retry_count: null, failed_items: null, disk_pressure: "UNKNOWN" };
  try {
    const local = JSON.parse(readFileSync(`${dataRoot}/journal-status.json`, "utf8")).offline_buffer;
    if (local?.contract === "observer-offline-buffer-v1") offlineBuffer = Object.fromEntries(["contract","state","queue_depth","queue_bytes","oldest_item_age_ms","retry_count","failed_items","disk_pressure"].map(key => [key, local[key] ?? null]));
  } catch {}
  let diskFreeMb = null;
  try { const disk = statfsSync(dataRoot); diskFreeMb = Math.floor((disk.bavail * disk.bsize) / (1024 * 1024)); } catch {}
  const lastFrameAt = channels.map((channel) => Date.parse(channel.last_frame_at || channel.last_seen_at || "")).filter(Number.isFinite).sort((a, b) => b - a)[0];
  const payload = {
    heartbeat_id: crypto.randomUUID(), gateway_id: gatewayId, observer_site_id: observerSiteId, observed_at: new Date().toISOString(), runtime: { ...edgeRuntime, offline_buffer: offlineBuffer },
    health: {
      status: health.ok === true && (health.mediaHeartbeat?.stalledRelays || 0) === 0 ? "HEALTHY" : "DEGRADED",
      uptime_seconds: Math.floor(uptime()), cpu_percent: Math.max(0, Math.min(100, Math.round((loadavg()[0] || 0) * 100))),
      memory_mb: Math.round((totalmem() - freemem()) / (1024 * 1024)), disk_free_mb: diskFreeMb,
      camera_count: channels.filter((channel) => channel.status !== "unassigned").length, streaming_count: channels.filter((channel) => channel.status === "connected").length,
      last_frame_at: Number.isFinite(lastFrameAt) ? new Date(lastFrameAt).toISOString() : null,
      error_codes: []
    }, command_results: pendingCommandResults.splice(0, 20)
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
  const commands = Array.isArray(response?.data?.commands) ? response.data.commands : [];
  for (const command of commands.slice(0, 20)) {
    let resultCategory = "COMMAND_COMPLETED";
    try {
      if (Date.parse(command.expires_at || "") <= Date.now()) throw new Error("COMMAND_TTL_EXPIRED");
      if (command.command === "HEALTH_PROBE") await fetch(`${gatewayUrl}/health`, { signal: AbortSignal.timeout(5_000) }).then(r => { if (!r.ok) throw new Error("HEALTH_PROBE_FAILED"); });
      else if (command.command === "REDISCOVER_CAMERAS") await discover();
      else if (command.command === "RECONNECT_CAMERAS") {
        for (const channel of channels.filter(item => item.status !== "unassigned")) await fetch(`${gatewayUrl}/connector/command`, { method: "POST", headers: { "content-type": "application/json", "x-video-gateway-secret": gatewaySecret }, body: JSON.stringify({ id: `fleet-${crypto.randomUUID()}`, command: "RECONNECT_STREAM", stream_id: channel.gateway_stream_id, issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60_000).toISOString() }), signal: AbortSignal.timeout(10_000) }).then(r => { if (!r.ok) throw new Error("RECONNECT_FAILED"); });
      } else if (!["REFRESH_CONFIGURATION", "ASSIGN_UPDATE_CHANNEL", "INITIATE_APPROVED_UPDATE", "PAUSE_ROLLOUT"].includes(command.command)) throw new Error("COMMAND_REQUIRES_SERVICE_MANAGER");
      else resultCategory = "COMMAND_ACCEPTED_BY_EXISTING_SUBSYSTEM";
      pendingCommandResults.push({ command_id: command.id, state: "COMPLETED", result_category: resultCategory });
    } catch (error) {
      pendingCommandResults.push({ command_id: command.id, state: "FAILED", result_category: String(error?.message || "COMMAND_FAILED").replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 80) });
    }
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
const learningScheduler = createAdaptiveSamplingScheduler({ learningIntervalMs: 5 * 60_000 });
function discoverWithRetry(context) {
  if (discoveryRun) return discoveryRun;
  discoveryRun = runDiscoveryWithRetry(context).finally(() => { discoveryRun = null; });
  return discoveryRun;
}

async function learn() {
  const eligible = channels.filter((channel) => channel.status === "connected" && channel.gateway_stream_id);
  const plan = learningScheduler.plan(eligible.map((channel) => ({ camera_id: channel.camera_source_id || channel.id || channel.gateway_stream_id,
    site_id: observerSiteId, status: channel.status, channel_assignment: "ASSIGNED", physical_camera_attached: true, learning_under_covered: true })),
  { purpose: "SITE_LEARNING", budget: eligible.length, resourcePressure: "NORMAL" });
  const selected = new Set(plan.decisions.filter((decision) => decision.request_sample).map((decision) => decision.camera_id));
  const pending = eligible.filter((channel) => selected.has(channel.camera_source_id || channel.id || channel.gateway_stream_id));
  const samples = [];
  // Cheap activity extraction has no ONNX dependency. Bounded sequential work
  // prevents one shared local runtime from allowing a dominant camera to starve
  // the rest of the Site learning rotation.
  for (const channel of pending) {
    try {
      const response = await fetch(`${gatewayUrl}/camera/${encodeURIComponent(channel.gateway_stream_id)}/activity`, { headers: { "x-video-gateway-secret": gatewaySecret }, signal: AbortSignal.timeout(INSIGHT_REQUEST_TIMEOUT_MS) });
      const data = await response.json();
      if (!response.ok || data.local_processing !== true || data.no_raw_video_returned !== true) continue;
      samples.push({ channel, stream_id: channel.gateway_stream_id, motion_score: Number(data.insight?.motion_score || 0), luminance_score: Number(data.insight?.luminance_score || 0), sampled_at: String(data.insight?.sampled_at || new Date().toISOString()), sample_frames: Number(data.insight?.sample_frames || 1) });
    } catch { /* A failed source remains under-covered and is eligible on the next bounded rotation. */ }
  }
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
    observerSiteId, deviceId: gatewayId, tenantId: observerSiteId,
    personConfirmations: 2, cameraFilter: evidenceTestCameraId, pollIntervalMs: evidenceTestPollIntervalMs,
    spatialTrace: spatialTraceEnabled,
    resourcePressure: () => {
      const freeRatio = freemem() / Math.max(1, totalmem());
      const loadRatio = loadavg()[0] / Math.max(1, cpus().length);
      return freeRatio < 0.05 || loadRatio > 1.5 ? "CRITICAL" : freeRatio < 0.12 || loadRatio > 1 ? "CONSTRAINED" : "NORMAL";
    },
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
