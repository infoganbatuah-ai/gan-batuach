// Controlled PUSH 38 reconciliation of the installed Home Gateway recorder
// endpoint. The script changes only dvr_profile_json.endpoint in the canonical
// macOS Keychain item, preserves an exact restricted backup, verifies the
// recorder identity read-only, and automatically restores the prior profile if
// persistence or the launchd lifecycle fails.
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, lstatSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, sep } from "node:path";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";

const SERVICE = "com.ganbatuach.video-gateway.runtime";
const LABEL = "com.ganbatuach.video-gateway";
const ACCOUNT = "dvr_profile_json";
const DVR_PASSWORD_ACCOUNT = "dvr_password";
const EXPECTED = Object.freeze({ model: "ERO-N7516HR", software: "8.2.4.1",
  priorVerifiedHardware: "DM-448", priorVerifiedFirmware: "V8.2.4.1-20240515" });
const RESTRICTED_ROOT = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const mode = process.argv.includes("--preflight") ? "preflight"
  : process.argv.includes("--apply") ? "apply"
    : process.argv.includes("--rollback") ? "rollback" : "";
const option = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const outputPath = resolve(option("output") || ".");
const backupPath = option("backup") ? resolve(option("backup")) : "";
const backupSha256 = option("backup-sha256");
if (!mode || !["preflight", "apply", "rollback"].includes(mode)) throw new Error("P38_DVR_RECONCILE_MODE_REQUIRED");
if (!outputPath.startsWith(RESTRICTED_ROOT) || existsSync(outputPath)) throw new Error("P38_DVR_RESTRICTED_NEW_OUTPUT_REQUIRED");

const store = createEdgeSecretStoreSync({ keychainService: SERVICE });
const rawProfile = store.read(ACCOUNT);
const password = store.read(DVR_PASSWORD_ACCOUNT);
if (!rawProfile || !password) throw new Error("P38_DVR_CANONICAL_PROFILE_OR_CREDENTIAL_UNAVAILABLE");
const profile = JSON.parse(rawProfile);

function sha(value) { return createHash("sha256").update(value).digest("hex"); }
function endpointUrl(value) {
  const url = new URL(String(value).includes("://") ? value : `http://${value}`);
  if (url.username || url.password || !["http:", "https:"].includes(url.protocol)) throw new Error("P38_DVR_ENDPOINT_INVALID");
  const parts = url.hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    || !(parts[0] === 10 || (parts[0] === 192 && parts[1] === 168)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31))) throw new Error("P38_DVR_PRIVATE_ENDPOINT_REQUIRED");
  return url;
}
function replaceEndpointHost(value, host) {
  if (!String(value).includes("://")) return String(value).includes(":") ? `${host}:${String(value).split(":").at(-1)}` : host;
  const url = endpointUrl(value);
  url.hostname = host;
  return url.toString().replace(/\/$/, "");
}
function parseDigestChallenge(value) {
  const fields = {};
  for (const match of String(value || "").replace(/^Digest\s+/i, "").matchAll(/([a-z0-9_-]+)=(?:"([^"]*)"|([^,\s]+))/gi)) {
    fields[match[1].toLowerCase()] = match[2] ?? match[3] ?? "";
  }
  return fields;
}
function digestHex(algorithm, value) {
  return createHash(String(algorithm || "MD5").toUpperCase() === "SHA-256" ? "sha256" : "md5")
    .update(value, "utf8").digest("hex");
}
async function recorderSession(host) {
  const source = endpointUrl(profile.endpoint);
  source.hostname = host;
  const baseUrl = source.toString().replace(/\/$/, "");
  const rangeResponse = await fetch(`${baseUrl}/API/Login/Range`, {
    method: "POST", headers: { "content-type": "application/json", "x-requested-with": "XMLHttpRequest" },
    body: JSON.stringify({ version: "1.0", data: {} }), signal: AbortSignal.timeout(1200)
  }).catch(() => null);
  if (!rangeResponse?.ok) return null;
  const range = await rangeResponse.json().catch(() => null);
  const uri = "/API/Web/Login", body = JSON.stringify({ data: { remote_terminal_info: "GATEWAY_RECONCILE_READ_ONLY" } });
  const common = { method: "POST", headers: { "content-type": "application/json", "x-requested-with": "XMLHttpRequest" },
    body, signal: AbortSignal.timeout(2000) };
  const first = await fetch(`${baseUrl}${uri}`, common).catch(() => null);
  if (!first) return null;
  let response = first;
  if (first.status === 401) {
    const challenge = parseDigestChallenge(first.headers.get("www-authenticate"));
    if (!challenge.realm || !challenge.nonce) return null;
    const qop = String(challenge.qop || "auth").split(",")[0].trim(), nc = "00000001";
    const cnonce = randomBytes(8).toString("hex");
    const username = String(profile.username || "");
    const ha1 = digestHex(challenge.algorithm, `${username}:${challenge.realm}:${password}`);
    const ha2 = digestHex(challenge.algorithm, `POST:${uri}`);
    const answer = digestHex(challenge.algorithm, `${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    const authorization = [
      `Digest username="${username.replaceAll('"', "")}"`, `realm="${challenge.realm}"`,
      `nonce="${challenge.nonce}"`, `uri="${uri}"`, `response="${answer}"`,
      `opaque="${challenge.opaque || ""}"`, `qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`,
      challenge.algorithm ? `algorithm="${challenge.algorithm}"` : ""
    ].filter(Boolean).join(", ");
    response = await fetch(`${baseUrl}${uri}`, { ...common, headers: { ...common.headers, authorization } }).catch(() => null);
  }
  if (!response?.ok) return null;
  const token = String(response.headers.get("x-csrftoken") || "").split(",")[0].trim();
  const cookie = String(response.headers.get("set-cookie") || "").split(";")[0].trim();
  if (!token) return null;
  const read = async (path) => {
    const result = await fetch(`${baseUrl}${path}`, { method: "POST", headers: {
      "content-type": "application/json", "x-csrftoken": token, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ version: "1.0", data: {} }), signal: AbortSignal.timeout(2500) }).catch(() => null);
    return result?.ok ? result.json().catch(() => null) : null;
  };
  const [deviceInfo, channelInfo] = await Promise.all([
    read("/API/Login/DeviceInfo/Get"), read("/API/Login/ChannelInfo/Get")
  ]);
  if (!deviceInfo || !channelInfo) return null;
  const identityText = JSON.stringify(deviceInfo), channelText = JSON.stringify(channelInfo);
  if (![EXPECTED.model, EXPECTED.software].every((value) => identityText.includes(value))
    || !Array.from({ length: 16 }, (_, index) => `CH${index + 1}`).every((value) => channelText.includes(value))) return null;
  return { host, range, deviceInfo, channelInfo, baseUrl };
}
async function discoverAuthorizedRecorder() {
  const old = endpointUrl(profile.endpoint).hostname.split(".").map(Number);
  const candidates = [];
  for (let distance = 1; distance <= 4; distance += 1) {
    for (const last of [old[3] + distance, old[3] - distance]) {
      if (last >= 1 && last <= 254) candidates.push([...old.slice(0, 3), last].join("."));
    }
  }
  const matches = (await Promise.all(candidates.map((host) => recorderSession(host)))).filter(Boolean);
  if (matches.length !== 1) throw new Error(matches.length ? "P38_DVR_MULTIPLE_IDENTITY_MATCHES" : "P38_DVR_VERIFIED_CURRENT_ENDPOINT_NOT_FOUND");
  return matches[0];
}
function serviceState() {
  try {
    const text = execFileSync("/bin/launchctl", ["print", `gui/${process.getuid()}/${LABEL}`],
      { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "pipe"] });
    return { running: /state = running/.test(text), pid: Number(text.match(/\bpid = (\d+)/)?.[1] || 0) || null };
  } catch { return { running: false, pid: null }; }
}
async function health() {
  const response = await fetch("http://127.0.0.1:18082/health", { signal: AbortSignal.timeout(5000) }).catch(() => null);
  if (!response?.ok) return { http: response?.status || 0 };
  const body = await response.json();
  return { http: response.status, ok: body.ok === true, status: body.status || null,
    discovery: body.lastDiscovery ? { assigned: body.lastDiscovery.assignedCount, connected: body.lastDiscovery.connectedCount,
      failed: body.lastDiscovery.failedAssignedCount, empty: body.lastDiscovery.unassignedCount,
      checked_at: body.lastDiscovery.checkedAt } : null,
    media: body.mediaHeartbeat ? { progressing: body.mediaHeartbeat.progressingRelays,
      stalled: body.mediaHeartbeat.stalledRelays, active: body.mediaHeartbeat.activeRelays } : null,
    authorization: body.deviceAuthorization?.status || null };
}
function protectedFile(path) {
  if (!path || !realpathSync(path).startsWith(RESTRICTED_ROOT) || lstatSync(path).isSymbolicLink()
    || (statSync(path).mode & 0o077) !== 0) throw new Error("P38_DVR_PROTECTED_BACKUP_REQUIRED");
  return readFileSync(path);
}
function persist(value) {
  writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  chmodSync(outputPath, 0o600);
  return sha(readFileSync(outputPath));
}
function safeIdentity(session) {
  const data = session.deviceInfo?.data || {};
  const deviceFingerprint = sha([data.mac_addr || "", data.device_sn || data.serial_number || ""].join("|"));
  return { model: EXPECTED.model, software: EXPECTED.software,
    prior_verified_hardware: EXPECTED.priorVerifiedHardware,
    prior_verified_firmware: EXPECTED.priorVerifiedFirmware,
    api: "V2.0", login_exclusivity: session.range?.data?.login_exclusivity ?? null,
    channel_capacity: 16, device_identity_fingerprint: deviceFingerprint, endpoint_hash: sha(session.host) };
}
async function waitForReconciledHealth(startedAt) {
  const deadline = Date.now() + 5 * 60_000;
  let last = null;
  while (Date.now() < deadline) {
    last = await health();
    const checked = Date.parse(last.discovery?.checked_at || "");
    if (last.http === 200 && Number.isFinite(checked) && checked >= startedAt
      && last.discovery?.assigned === 10 && last.discovery?.empty === 6) return last;
    await new Promise((resolveWait) => setTimeout(resolveWait, 3000));
  }
  throw new Error(`P38_DVR_RECONCILED_HEALTH_TIMEOUT_${last?.http || 0}`);
}
function kickstart() {
  execFileSync("/bin/launchctl", ["kickstart", "-k", `gui/${process.getuid()}/${LABEL}`],
    { timeout: 15_000, stdio: "ignore" });
}

if (mode === "preflight") {
  const current = await discoverAuthorizedRecorder();
  const old = endpointUrl(profile.endpoint);
  if (current.host === old.hostname) throw new Error("P38_DVR_ENDPOINT_NOT_STALE");
  const plistPath = resolve(homedir(), "Library/LaunchAgents", `${LABEL}.plist`);
  const identityPath = option("identity");
  const identityBytes = identityPath ? protectedFile(identityPath) : null;
  const snapshot = {
    protocol: "observer-push38-live-dvr-endpoint-reconciliation-v1", mode: "PREWRITE_BACKUP",
    created_at: new Date().toISOString(), keychain_service: SERVICE, keychain_account: ACCOUNT,
    profile_before: profile, profile_before_sha256: sha(rawProfile), old_endpoint_hash: sha(old.hostname),
    target_endpoint: replaceEndpointHost(profile.endpoint, current.host), target: safeIdentity(current),
    unchanged_fields_sha256: sha(JSON.stringify(Object.fromEntries(Object.entries(profile).filter(([key]) => key !== "endpoint")))),
    service_before: serviceState(), health_before: await health(),
    launchd_plist_sha256: existsSync(plistPath) ? sha(readFileSync(plistPath)) : null,
    identity_evidence: identityBytes ? { path: identityPath, sha256: sha(identityBytes) } : null,
    credential_included: false, reversible: true, authorized_change: "DVR_PROFILE_ENDPOINT_ONLY"
  };
  const evidenceSha = persist(snapshot);
  console.log(JSON.stringify({ status: "PREWRITE_BACKUP_PASS", evidence_sha256: evidenceSha,
    old_endpoint_hash: snapshot.old_endpoint_hash, target_endpoint_hash: snapshot.target.endpoint_hash,
    recorder_identity: "PASS", service_running: snapshot.service_before.running, credential_included: false }));
} else if (mode === "rollback") {
  const backupBytes = protectedFile(backupPath);
  if (!/^[a-f0-9]{64}$/.test(backupSha256) || sha(backupBytes) !== backupSha256) throw new Error("P38_DVR_BACKUP_PIN_MISMATCH");
  const backup = JSON.parse(backupBytes);
  if (backup.protocol !== "observer-push38-live-dvr-endpoint-reconciliation-v1" || !backup.profile_before)
    throw new Error("P38_DVR_BACKUP_CONTRACT_INVALID");
  store.write(ACCOUNT, JSON.stringify(backup.profile_before));
  kickstart();
  const result = { protocol: backup.protocol, mode: "ROLLBACK", observed_at: new Date().toISOString(),
    restored_profile_sha256: sha(store.read(ACCOUNT)), service: serviceState(), health: await health() };
  const evidenceSha = persist(result);
  console.log(JSON.stringify({ status: "ROLLBACK_APPLIED", evidence_sha256: evidenceSha,
    profile_restored: result.restored_profile_sha256 === backup.profile_before_sha256 }));
} else {
  const backupBytes = protectedFile(backupPath);
  if (!/^[a-f0-9]{64}$/.test(backupSha256) || sha(backupBytes) !== backupSha256) throw new Error("P38_DVR_BACKUP_PIN_MISMATCH");
  const backup = JSON.parse(backupBytes);
  if (backup.protocol !== "observer-push38-live-dvr-endpoint-reconciliation-v1"
    || backup.profile_before_sha256 !== sha(rawProfile) || JSON.stringify(backup.profile_before) !== JSON.stringify(profile)
    || Date.now() - Date.parse(backup.created_at) > 60 * 60_000) throw new Error("P38_DVR_PREWRITE_BACKUP_STALE");
  const current = await discoverAuthorizedRecorder();
  const targetEndpoint = replaceEndpointHost(profile.endpoint, current.host);
  if (targetEndpoint !== backup.target_endpoint || sha(current.host) !== backup.target.endpoint_hash)
    throw new Error("P38_DVR_TARGET_IDENTITY_CHANGED");
  const updated = { ...profile, endpoint: targetEndpoint };
  const unchangedBefore = JSON.stringify(Object.fromEntries(Object.entries(profile).filter(([key]) => key !== "endpoint")));
  const unchangedAfter = JSON.stringify(Object.fromEntries(Object.entries(updated).filter(([key]) => key !== "endpoint")));
  if (unchangedBefore !== unchangedAfter || profile.endpoint === updated.endpoint) throw new Error("P38_DVR_ENDPOINT_ONLY_CHANGE_INVALID");
  const startedAt = Date.now();
  let wrote = false;
  try {
    store.write(ACCOUNT, JSON.stringify(updated));
    wrote = true;
    if (store.read(ACCOUNT) !== JSON.stringify(updated)) throw new Error("P38_DVR_CONFIG_PERSISTENCE_FAILED");
    kickstart();
    const reconciledHealth = await waitForReconciledHealth(startedAt);
    const persisted = JSON.parse(store.read(ACCOUNT));
    const result = { protocol: backup.protocol, mode: "APPLY", observed_at: new Date().toISOString(),
      backup_sha256: backupSha256, recorder: safeIdentity(current),
      endpoint_before_hash: backup.old_endpoint_hash, endpoint_after_hash: sha(endpointUrl(persisted.endpoint).hostname),
      endpoint_only_change: unchangedBefore === JSON.stringify(Object.fromEntries(Object.entries(persisted).filter(([key]) => key !== "endpoint"))),
      persisted: persisted.endpoint === targetEndpoint, service_after: serviceState(), health_after: reconciledHealth,
      credentials_changed: false, source_or_site_configuration_changed: false };
    if (!result.persisted || !result.endpoint_only_change || !result.service_after.running) throw new Error("P38_DVR_POSTWRITE_INVARIANT_FAILED");
    const evidenceSha = persist(result);
    console.log(JSON.stringify({ status: "ENDPOINT_RECONCILED", evidence_sha256: evidenceSha,
      persisted: result.persisted, endpoint_only_change: result.endpoint_only_change,
      recorder_identity: "PASS", service_running: result.service_after.running,
      discovery: result.health_after.discovery }));
  } catch (error) {
    if (wrote) {
      store.write(ACCOUNT, JSON.stringify(backup.profile_before));
      kickstart();
    }
    throw new Error(`P38_DVR_RECONCILIATION_FAILED_AUTO_ROLLBACK_${error instanceof Error ? error.message : "UNKNOWN"}`);
  }
}
