// Controlled PUSH 38 reconciliation of the installed Home Connector camera
// endpoint. The command discovers the single ONVIF-advertised C211 first,
// verifies real RTSP media with the existing local credential, changes only
// the two cached endpoint fields, and restores both profiles on any failure.
import dgram from "node:dgram";
import { execFileSync, spawnSync } from "node:child_process";
import { createConnection } from "node:net";
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync, existsSync, lstatSync, readFileSync, realpathSync, statSync, writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import { resolve, sep } from "node:path";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";

const LABEL = "com.ganbatuach.software-connector.tapo";
const SECRET_DIR = `${homedir()}/Library/Application Support/Digital Observer/Tapo Connector/secrets`;
const PROFILES_ACCOUNT = "connector_profiles_json";
const LEGACY_PROFILE_ACCOUNT = "dvr_profile_json";
const PASSWORD_ACCOUNT = "dvr_password";
const EXPECTED_SOURCE_ID = "7465c0f2-ba57-4299-b22e-f20cedb91c23";
const RESTRICTED_ROOT = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const mode = process.argv.includes("--preflight") ? "preflight"
  : process.argv.includes("--apply") ? "apply"
    : process.argv.includes("--rollback") ? "rollback" : "";
const option = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const outputPath = resolve(option("output") || ".");
const backupPath = option("backup") ? resolve(option("backup")) : "";
const backupSha256 = option("backup-sha256");
if (!mode) throw new Error("P38_TAPO_RECONCILE_MODE_REQUIRED");
if (!outputPath.startsWith(RESTRICTED_ROOT) || existsSync(outputPath)) {
  throw new Error("P38_TAPO_RESTRICTED_NEW_OUTPUT_REQUIRED");
}

const store = createEdgeSecretStoreSync({ secretDir: SECRET_DIR });
const profilesRaw = store.read(PROFILES_ACCOUNT);
const legacyProfileRaw = store.read(LEGACY_PROFILE_ACCOUNT);
const legacyPassword = store.read(PASSWORD_ACCOUNT);
if (!profilesRaw || !legacyProfileRaw || !legacyPassword) throw new Error("P38_TAPO_CANONICAL_PROFILE_UNAVAILABLE");
const profiles = JSON.parse(profilesRaw);
const legacyProfile = JSON.parse(legacyProfileRaw);
if (!Array.isArray(profiles) || profiles.length !== 1 ||
  profiles[0]?.camera_source_id !== EXPECTED_SOURCE_ID ||
  profiles[0]?.connection_type !== "rtsp" || Number(profiles[0]?.port) !== 554 ||
  !profiles[0]?.endpoint || !profiles[0]?.username || !profiles[0]?.password ||
  legacyPassword !== profiles[0].password || legacyProfile.endpoint !== profiles[0].endpoint) {
  throw new Error("P38_TAPO_CANONICAL_PROFILE_IDENTITY_MISMATCH");
}

function sha(value) {
  return createHash("sha256").update(value).digest("hex");
}
function cleanHost(value) {
  const raw = String(value || "").trim();
  try { return new URL(raw.includes("://") ? raw : `rtsp://${raw}`).hostname; }
  catch { return raw.replace(/^.+:\/\//, "").replace(/\/.*$/, "").replace(/:.+$/, ""); }
}
function privateHost(host) {
  const parts = host.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    && (parts[0] === 10 || (parts[0] === 192 && parts[1] === 168)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31));
}
function replaceEndpointHost(value, host) {
  if (!privateHost(host)) throw new Error("P38_TAPO_PRIVATE_TARGET_REQUIRED");
  const raw = String(value || "");
  if (!raw.includes("://")) return raw.includes(":") ? `${host}:${raw.split(":").at(-1)}` : host;
  const url = new URL(raw);
  if (url.username || url.password || !["rtsp:", "http:", "https:"].includes(url.protocol)) {
    throw new Error("P38_TAPO_ENDPOINT_CONTRACT_INVALID");
  }
  url.hostname = host;
  return url.toString().replace(/\/$/, "");
}
function portOpen(host, port) {
  return new Promise((resolveOpen) => {
    const socket = createConnection({ host, port });
    let settled = false;
    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolveOpen(open);
    };
    socket.setTimeout(500, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}
async function discoverC211() {
  const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
  const payload = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
<e:Header><w:MessageID>uuid:${randomUUID()}</w:MessageID><w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To><w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header>
<e:Body><d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe></e:Body></e:Envelope>`);
  const candidates = new Set();
  socket.on("message", (buffer, remote) => {
    const xml = buffer.toString("utf8");
    if (/(?:\/|>)C211(?:<|\s|$)/i.test(xml) && privateHost(remote.address)) candidates.add(remote.address);
  });
  await new Promise((resolveSend, reject) => {
    socket.once("error", reject);
    socket.bind(0, "0.0.0.0", () => {
      socket.setMulticastTTL(2);
      socket.send(payload, 3702, "239.255.255.250", (error) => error ? reject(error) : resolveSend());
    });
  });
  await new Promise((resolveWait) => setTimeout(resolveWait, 6000));
  socket.close();
  if (candidates.size !== 1) throw new Error(`P38_TAPO_PUBLIC_C211_IDENTITY_COUNT_${candidates.size}`);
  const host = [...candidates][0];
  const [onvif, rtsp] = await Promise.all([portOpen(host, 2020), portOpen(host, 554)]);
  if (!onvif || !rtsp) throw new Error("P38_TAPO_PUBLIC_PORT_CONTRACT_FAILED");
  return host;
}
function verifyMedia(host) {
  const profile = profiles[0];
  const url = `rtsp://${encodeURIComponent(profile.username)}:${encodeURIComponent(profile.password)}` +
    `@${host}:${Number(profile.port)}/stream1`;
  const result = spawnSync("/opt/homebrew/bin/ffprobe", [
    "-v", "error", "-rtsp_transport", "tcp", "-select_streams", "v:0",
    "-show_entries", "stream=codec_name,width,height,r_frame_rate", "-of", "json", url
  ], { encoding: "utf8", timeout: 15_000, maxBuffer: 512 * 1024 });
  let stream = null;
  try { stream = JSON.parse(result.stdout || "{}").streams?.[0] || null; } catch {}
  if (result.status !== 0 || !stream?.codec_name) throw new Error("P38_TAPO_AUTHENTICATED_MEDIA_UNAVAILABLE");
  return { codec: stream.codec_name, width: stream.width, height: stream.height,
    frame_rate: stream.r_frame_rate || null };
}
function serviceState() {
  try {
    const output = execFileSync("/bin/launchctl", ["print", `gui/${process.getuid()}/${LABEL}`],
      { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "pipe"] });
    return { running: /state = running/.test(output), pid: Number(output.match(/\bpid = (\d+)/)?.[1] || 0) || null };
  } catch { return { running: false, pid: null }; }
}
function kickstart() {
  execFileSync("/bin/launchctl", ["kickstart", "-k", `gui/${process.getuid()}/${LABEL}`],
    { timeout: 15_000, stdio: "ignore" });
}
async function health() {
  const response = await fetch("http://127.0.0.1:18083/health", { signal: AbortSignal.timeout(5000) }).catch(() => null);
  if (!response?.ok) return { http: response?.status || 0 };
  const body = await response.json();
  return { http: response.status, ok: body.ok === true, status: body.status || null,
    discovery: body.lastDiscovery ? { assigned: body.lastDiscovery.assignedCount ?? body.lastDiscovery.channelCount,
      connected: body.lastDiscovery.connectedCount, failed: body.lastDiscovery.failedAssignedCount,
      checked_at: body.lastDiscovery.checkedAt } : null,
    media: body.mediaHeartbeat ? { progressing: body.mediaHeartbeat.progressingRelays,
      stalled: body.mediaHeartbeat.stalledRelays, active: body.mediaHeartbeat.activeRelays } : null };
}
async function waitForProgress(startedAt) {
  const deadline = Date.now() + 5 * 60_000;
  let last = null;
  while (Date.now() < deadline) {
    last = await health();
    const checked = Date.parse(last.discovery?.checked_at || "");
    if (last.http === 200 && Number.isFinite(checked) && checked >= startedAt &&
      last.discovery?.connected === 1 && last.media?.progressing === 1 && last.media?.stalled === 0) return last;
    await new Promise((resolveWait) => setTimeout(resolveWait, 3000));
  }
  throw new Error(`P38_TAPO_RECONCILED_HEALTH_TIMEOUT_${last?.http || 0}`);
}
function protectedFile(path) {
  if (!path || !realpathSync(path).startsWith(RESTRICTED_ROOT) || lstatSync(path).isSymbolicLink()
    || (statSync(path).mode & 0o077) !== 0) throw new Error("P38_TAPO_PROTECTED_BACKUP_REQUIRED");
  return readFileSync(path);
}
function persist(value) {
  writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  chmodSync(outputPath, 0o600);
  return sha(readFileSync(outputPath));
}

if (mode === "preflight") {
  const host = await discoverC211();
  const media = verifyMedia(host);
  const currentHost = cleanHost(profiles[0].endpoint);
  if (host === currentHost) throw new Error("P38_TAPO_ENDPOINT_NOT_STALE");
  const backup = {
    protocol: "observer-push38-live-tapo-endpoint-reconciliation-v1", mode: "PREWRITE_BACKUP",
    created_at: new Date().toISOString(), profiles_raw: profilesRaw, legacy_profile_raw: legacyProfileRaw,
    profiles_sha256: sha(profilesRaw), legacy_profile_sha256: sha(legacyProfileRaw),
    old_endpoint_hash: sha(currentHost), target_endpoint: replaceEndpointHost(profiles[0].endpoint, host),
    target_endpoint_hash: sha(host), source_id: EXPECTED_SOURCE_ID,
    unchanged_profile_sha256: sha(JSON.stringify(Object.fromEntries(Object.entries(profiles[0]).filter(([key]) => key !== "endpoint")))),
    media, service_before: serviceState(), health_before: await health(),
    credentials_changed: false, source_or_site_changed: false, reversible: true
  };
  const evidenceSha = persist(backup);
  console.log(JSON.stringify({ status: "PREWRITE_BACKUP_PASS", evidence_sha256: evidenceSha,
    public_identity: "UNIQUE_ONVIF_C211", authenticated_media: "PASS",
    source_id_match: true, endpoint_changed: true, credential_included_in_output: false }));
} else if (mode === "rollback") {
  const bytes = protectedFile(backupPath);
  if (!/^[a-f0-9]{64}$/.test(backupSha256) || sha(bytes) !== backupSha256) {
    throw new Error("P38_TAPO_BACKUP_PIN_MISMATCH");
  }
  const backup = JSON.parse(bytes);
  if (backup.protocol !== "observer-push38-live-tapo-endpoint-reconciliation-v1") {
    throw new Error("P38_TAPO_BACKUP_CONTRACT_INVALID");
  }
  store.write(PROFILES_ACCOUNT, backup.profiles_raw);
  store.write(LEGACY_PROFILE_ACCOUNT, backup.legacy_profile_raw);
  kickstart();
  const result = { protocol: backup.protocol, mode: "ROLLBACK", observed_at: new Date().toISOString(),
    profiles_restored: store.read(PROFILES_ACCOUNT) === backup.profiles_raw,
    legacy_profile_restored: store.read(LEGACY_PROFILE_ACCOUNT) === backup.legacy_profile_raw,
    service: serviceState(), health: await health() };
  const evidenceSha = persist(result);
  console.log(JSON.stringify({ status: "ROLLBACK_APPLIED", evidence_sha256: evidenceSha,
    profiles_restored: result.profiles_restored && result.legacy_profile_restored }));
} else {
  const bytes = protectedFile(backupPath);
  if (!/^[a-f0-9]{64}$/.test(backupSha256) || sha(bytes) !== backupSha256) {
    throw new Error("P38_TAPO_BACKUP_PIN_MISMATCH");
  }
  const backup = JSON.parse(bytes);
  if (backup.protocol !== "observer-push38-live-tapo-endpoint-reconciliation-v1" ||
    backup.profiles_sha256 !== sha(profilesRaw) || backup.legacy_profile_sha256 !== sha(legacyProfileRaw) ||
    backup.profiles_raw !== profilesRaw || backup.legacy_profile_raw !== legacyProfileRaw ||
    backup.source_id !== EXPECTED_SOURCE_ID || Date.now() - Date.parse(backup.created_at) > 60 * 60_000) {
    throw new Error("P38_TAPO_PREWRITE_BACKUP_STALE");
  }
  const host = await discoverC211();
  const media = verifyMedia(host);
  if (sha(host) !== backup.target_endpoint_hash) throw new Error("P38_TAPO_TARGET_IDENTITY_CHANGED");
  const updatedProfiles = profiles.map((profile) => ({ ...profile,
    endpoint: replaceEndpointHost(profile.endpoint, host) }));
  const updatedLegacy = { ...legacyProfile, endpoint: replaceEndpointHost(legacyProfile.endpoint, host) };
  const unchanged = JSON.stringify(Object.fromEntries(Object.entries(updatedProfiles[0]).filter(([key]) => key !== "endpoint")))
    === JSON.stringify(Object.fromEntries(Object.entries(profiles[0]).filter(([key]) => key !== "endpoint")));
  if (!unchanged || updatedProfiles[0].endpoint !== backup.target_endpoint ||
    updatedLegacy.endpoint !== replaceEndpointHost(legacyProfile.endpoint, host)) {
    throw new Error("P38_TAPO_ENDPOINT_ONLY_CHANGE_INVALID");
  }
  const startedAt = Date.now();
  let wrote = false;
  try {
    store.write(PROFILES_ACCOUNT, JSON.stringify(updatedProfiles));
    store.write(LEGACY_PROFILE_ACCOUNT, JSON.stringify(updatedLegacy));
    wrote = true;
    if (store.read(PROFILES_ACCOUNT) !== JSON.stringify(updatedProfiles) ||
      store.read(LEGACY_PROFILE_ACCOUNT) !== JSON.stringify(updatedLegacy)) {
      throw new Error("P38_TAPO_CONFIG_PERSISTENCE_FAILED");
    }
    kickstart();
    const reconciledHealth = await waitForProgress(startedAt);
    const result = { protocol: backup.protocol, mode: "APPLY", observed_at: new Date().toISOString(),
      backup_sha256: backupSha256, public_identity: "UNIQUE_ONVIF_C211", media,
      endpoint_before_hash: backup.old_endpoint_hash, endpoint_after_hash: sha(host),
      endpoint_only_change: unchanged, profiles_persisted: true, credentials_changed: false,
      source_id_preserved: updatedProfiles[0].camera_source_id === EXPECTED_SOURCE_ID,
      source_or_site_changed: false, service_after: serviceState(), health_after: reconciledHealth };
    if (!result.service_after.running || !result.source_id_preserved) throw new Error("P38_TAPO_POSTWRITE_INVARIANT_FAILED");
    const evidenceSha = persist(result);
    console.log(JSON.stringify({ status: "ENDPOINT_RECONCILED", evidence_sha256: evidenceSha,
      persisted: true, endpoint_only_change: true, public_identity: result.public_identity,
      authenticated_media: "PASS", source_id_preserved: true,
      service_running: result.service_after.running, health: result.health_after }));
  } catch (error) {
    if (wrote) {
      store.write(PROFILES_ACCOUNT, backup.profiles_raw);
      store.write(LEGACY_PROFILE_ACCOUNT, backup.legacy_profile_raw);
      kickstart();
    }
    throw new Error(`P38_TAPO_RECONCILIATION_FAILED_AUTO_ROLLBACK_${error instanceof Error ? error.message : "UNKNOWN"}`);
  }
}
