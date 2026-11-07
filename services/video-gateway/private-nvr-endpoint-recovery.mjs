import { createHash, randomBytes } from "node:crypto";

export const PRIVATE_NVR_IDENTITY_BINDING_ACCOUNT = "dvr_identity_binding_json";
export const PRIVATE_NVR_ENDPOINT_RECOVERY_PENDING_ACCOUNT = "dvr_endpoint_recovery_pending_json";
export const PRIVATE_NVR_ENDPOINT_RECOVERY_OUTAGE_MS = 30_000;
export const PRIVATE_NVR_ENDPOINT_RECOVERY_COOLDOWN_MS = 5 * 60_000;

function sha(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function privateIpv4Endpoint(value) {
  const url = new URL(String(value || "").includes("://") ? String(value) : `http://${value}`);
  if (url.username || url.password || !["http:", "https:"].includes(url.protocol)) {
    throw new Error("PRIVATE_NVR_ENDPOINT_INVALID");
  }
  const parts = url.hostname.split(".").map(Number);
  const valid = parts.length === 4 && parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255)
    && (parts[0] === 10 || parts[0] === 192 && parts[1] === 168
      || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
  if (!valid) throw new Error("PRIVATE_NVR_PRIVATE_IPV4_REQUIRED");
  return url;
}

export function privateNvrEndpointWithHost(value, host) {
  const endpoint = privateIpv4Endpoint(value);
  const candidate = privateIpv4Endpoint(`${endpoint.protocol}//${host}:${endpoint.port || (endpoint.protocol === "https:" ? 443 : 80)}`);
  endpoint.hostname = candidate.hostname;
  return endpoint.toString().replace(/\/$/, "");
}

function canonicalIdentityValue(value) {
  if (Array.isArray(value)) return value.map(canonicalIdentityValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(?:time|date|clock|uptime|status|ip|gateway|dns|network|session|token|cookie)/i.test(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, canonicalIdentityValue(item)]));
}

export function privateNvrIdentityFingerprint(deviceInfo, systemInfo = null,
  credentialAnchor = "") {
  const data = deviceInfo?.data && typeof deviceInfo.data === "object" ? deviceInfo.data : {};
  const system = systemInfo?.data && typeof systemInfo.data === "object" ? systemInfo.data : {};
  const mac = String(data.mac_addr || data.mac_address || system.mac_addr || system.mac_address || "")
    .trim().toLowerCase();
  const serial = String(data.device_sn || data.serial_number || data.sn
    || system.device_sn || system.serial_number || system.sn || "").trim();
  const hardwareId = String(data.device_id || data.p2p_id || data.iot_id
    || system.device_id || system.p2p_id || system.iot_id || "").trim();
  // This recorder family exposes a stable hardware MAC plus a device/P2P ID,
  // but not a conventional serial number. Bind those immutable identifiers
  // directly so DHCP and ordinary configuration changes cannot alter identity.
  if (mac && (serial || hardwareId)) return sha(`${mac}|${serial}|${hardwareId}`);
  if (!/^[a-f0-9]{64}$/.test(credentialAnchor)) {
    throw new Error("PRIVATE_NVR_STABLE_IDENTITY_UNAVAILABLE");
  }
  const canonical = JSON.stringify(canonicalIdentityValue({ deviceInfo, systemInfo }));
  if (canonical.length < 32) throw new Error("PRIVATE_NVR_STABLE_IDENTITY_UNAVAILABLE");
  return sha(`${canonical}|${credentialAnchor}`);
}

export function createPrivateNvrIdentityBinding({ deviceInfo, model, software,
  channelCapacity, systemInfo = null, credentialAnchor = "",
  verifiedAt = new Date().toISOString() }) {
  if (!Number.isInteger(channelCapacity) || channelCapacity < 1 || channelCapacity > 128) {
    throw new Error("PRIVATE_NVR_CHANNEL_CAPACITY_INVALID");
  }
  const fingerprint = privateNvrIdentityFingerprint(deviceInfo, systemInfo, credentialAnchor);
  const normalizedModel = String(model || "").trim();
  const normalizedSoftware = String(software || "").trim();
  if (!normalizedModel || !normalizedSoftware) throw new Error("PRIVATE_NVR_IDENTITY_METADATA_INVALID");
  return Object.freeze({
    contract: "observer-private-nvr-identity-binding-v1",
    version: 1,
    fingerprint_sha256: fingerprint,
    model: normalizedModel,
    software: normalizedSoftware,
    channel_capacity: channelCapacity,
    stream_namespace: `private-nvr-${fingerprint.slice(0, 24)}`,
    verified_at: verifiedAt
  });
}

export function parsePrivateNvrIdentityBinding(value) {
  let binding;
  try { binding = typeof value === "string" ? JSON.parse(value) : value; } catch {}
  if (!binding || binding.contract !== "observer-private-nvr-identity-binding-v1"
    || binding.version !== 1 || !/^[a-f0-9]{64}$/.test(binding.fingerprint_sha256)
    || typeof binding.model !== "string" || !binding.model.trim()
    || typeof binding.software !== "string" || !binding.software.trim()
    || !Number.isInteger(binding.channel_capacity) || binding.channel_capacity < 1 || binding.channel_capacity > 128
    || !/^private-nvr-[a-f0-9]{24}$/.test(binding.stream_namespace)
    || !Number.isFinite(Date.parse(binding.verified_at))) {
    throw new Error("PRIVATE_NVR_IDENTITY_BINDING_INVALID");
  }
  return Object.freeze({ ...binding });
}

export function privateNvrSubnetCandidates(endpointValue) {
  const endpoint = privateIpv4Endpoint(endpointValue);
  const parts = endpoint.hostname.split(".").map(Number);
  const current = parts[3];
  const ordered = [];
  for (let distance = 1; distance <= 253; distance += 1) {
    for (const last of [current + distance, current - distance]) {
      if (last >= 1 && last <= 254 && !ordered.includes(last)) ordered.push(last);
    }
  }
  return ordered.map(last => [...parts.slice(0, 3), last].join("."));
}

function digestHex(algorithm, value) {
  return createHash(String(algorithm || "MD5").toUpperCase() === "SHA-256" ? "sha256" : "md5")
    .update(value, "utf8").digest("hex");
}

function parseDigestChallenge(value) {
  const fields = {};
  for (const match of String(value || "").replace(/^Digest\s+/i, "")
    .matchAll(/([a-z0-9_-]+)=(?:"([^"]*)"|([^,\s]+))/gi)) {
    fields[match[1].toLowerCase()] = match[2] ?? match[3] ?? "";
  }
  return fields;
}

async function boundedJson(response, maximumBytes = 32_768) {
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maximumBytes) throw new Error("PRIVATE_NVR_RESPONSE_TOO_LARGE");
  try { return JSON.parse(bytes.toString("utf8")); } catch { return null; }
}

async function logout(baseUrl, session, fetchImpl, timeoutMs) {
  if (!session?.token) return;
  await fetchImpl(`${baseUrl}/API/Web/Logout`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrftoken": session.token,
      ...(session.cookie ? { cookie: session.cookie } : {}) },
    body: JSON.stringify({ version: "1.0", data: {} }),
    signal: AbortSignal.timeout(timeoutMs)
  }).catch(() => null);
}

export async function probePrivateNvrIdentity({ profile, password, host, binding = null,
  fetchImpl = fetch, timeoutMs = 1_500 }) {
  const endpoint = privateIpv4Endpoint(privateNvrEndpointWithHost(profile.endpoint, host));
  const baseUrl = endpoint.toString().replace(/\/$/, "");
  const rangeResponse = await fetchImpl(`${baseUrl}/API/Login/Range`, {
    method: "POST", headers: { "content-type": "application/json", "x-requested-with": "XMLHttpRequest" },
    body: JSON.stringify({ version: "1.0", data: {} }), signal: AbortSignal.timeout(timeoutMs)
  }).catch(() => null);
  if (!rangeResponse?.ok) return null;
  const range = await boundedJson(rangeResponse).catch(() => null);
  const uri = "/API/Web/Login";
  const body = JSON.stringify({ data: { remote_terminal_info: "GATEWAY_ENDPOINT_RECOVERY" } });
  const common = { method: "POST", headers: { "content-type": "application/json",
    "x-requested-with": "XMLHttpRequest" }, body, signal: AbortSignal.timeout(timeoutMs) };
  const first = await fetchImpl(`${baseUrl}${uri}`, common).catch(() => null);
  if (!first) return null;
  let response = first;
  if (first.status === 401) {
    const challenge = parseDigestChallenge(first.headers.get("www-authenticate"));
    if (!challenge.realm || !challenge.nonce) return null;
    const qop = String(challenge.qop || "auth").split(",")[0].trim();
    const nc = "00000001", cnonce = randomBytes(8).toString("hex");
    const ha1 = digestHex(challenge.algorithm, `${profile.username}:${challenge.realm}:${password}`);
    const ha2 = digestHex(challenge.algorithm, `POST:${uri}`);
    const answer = digestHex(challenge.algorithm,
      `${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    const authorization = [
      `Digest username="${String(profile.username).replaceAll('"', "")}"`,
      `realm="${challenge.realm}"`, `nonce="${challenge.nonce}"`, `uri="${uri}"`,
      `response="${answer}"`, `opaque="${challenge.opaque || ""}"`, `qop=${qop}`,
      `nc=${nc}`, `cnonce="${cnonce}"`, challenge.algorithm ? `algorithm="${challenge.algorithm}"` : ""
    ].filter(Boolean).join(", ");
    response = await fetchImpl(`${baseUrl}${uri}`, { ...common,
      headers: { ...common.headers, authorization } }).catch(() => null);
  }
  if (!response?.ok) return null;
  const token = String(response.headers.get("x-csrftoken") || "").split(",")[0].trim();
  const cookie = String(response.headers.get("set-cookie") || "").split(";")[0].trim();
  if (!token) return null;
  const session = { token, cookie };
  try {
    const read = async (path) => {
      const result = await fetchImpl(`${baseUrl}${path}`, { method: "POST", headers: {
        "content-type": "application/json", "x-csrftoken": token, ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({ version: "1.0", data: {} }), signal: AbortSignal.timeout(timeoutMs) })
        .catch(() => null);
      return result?.ok ? boundedJson(result).catch(() => null) : null;
    };
    const [deviceInfo, systemInfo, channelInfo] = await Promise.all([
      read("/API/Login/DeviceInfo/Get"), read("/API/SystemInfo/Base/Get"),
      read("/API/Login/ChannelInfo/Get")
    ]);
    if (!deviceInfo || !systemInfo || !channelInfo) return null;
    const channelText = JSON.stringify(channelInfo);
    const channelCapacity = new Set([...channelText.matchAll(/\bCH(\d{1,3})\b/g)]
      .map(match => Number(match[1])).filter(channel => channel >= 1 && channel <= 128)).size;
    const identityText = JSON.stringify(deviceInfo);
    const credentialAnchor = sha(`${profile.username}\0${password}`);
    const fingerprint = privateNvrIdentityFingerprint(deviceInfo, systemInfo, credentialAnchor);
    if (binding && (fingerprint !== binding.fingerprint_sha256
      || !identityText.includes(binding.model) || !identityText.includes(binding.software)
      || channelCapacity < binding.channel_capacity)) return null;
    return { host: endpoint.hostname, fingerprint_sha256: fingerprint,
      model_verified: binding ? identityText.includes(binding.model) : null,
      software_verified: binding ? identityText.includes(binding.software) : null,
      channel_capacity: channelCapacity,
      login_exclusivity: range?.data?.login_exclusivity ?? null,
      deviceInfo, systemInfo, channelInfo };
  } finally {
    await logout(baseUrl, session, fetchImpl, timeoutMs);
  }
}

export async function discoverAuthorizedPrivateNvrEndpoint({ profile, password, binding,
  probe = probePrivateNvrIdentity, concurrency = 12 }) {
  const verifiedBinding = parsePrivateNvrIdentityBinding(binding);
  const currentHost = privateIpv4Endpoint(profile.endpoint).hostname;
  const current = await probe({ profile, password, host: currentHost, binding: verifiedBinding });
  if (current) return { status: "CURRENT", host: currentHost, identity: current };
  const candidates = privateNvrSubnetCandidates(profile.endpoint);
  const matches = [];
  for (let offset = 0; offset < candidates.length; offset += concurrency) {
    const batch = await Promise.all(candidates.slice(offset, offset + concurrency)
      .map(host => probe({ profile, password, host, binding: verifiedBinding }).catch(() => null)));
    matches.push(...batch.filter(Boolean));
    if (matches.length > 1) throw new Error("PRIVATE_NVR_MULTIPLE_IDENTITY_MATCHES");
  }
  if (matches.length !== 1) return { status: "NOT_FOUND", host: null, identity: null };
  return { status: "CHANGED", host: matches[0].host, identity: matches[0] };
}

export function shouldAttemptPrivateNvrEndpointRecovery({ deviceType, health,
  outageStartedAt = null, lastAttemptAt = null, now = Date.now() }) {
  const eligible = deviceType === "PHYSICAL_GATEWAY"
    && Number(health?.lastDiscovery?.assignedCount || 0) > 0
    && Number(health?.mediaHeartbeat?.availableRelays || 0) === 0
    && Number(health?.mediaHeartbeat?.renewingRelays || 0) === 0
    && Number(health?.recorderSessionHeartbeat?.consecutive_failures || 0) >= 3;
  if (!eligible) return { eligible: false, outageStartedAt: null, ready: false };
  const startedAt = Number.isFinite(outageStartedAt) ? outageStartedAt : now;
  const cooldownComplete = !Number.isFinite(lastAttemptAt)
    || now - lastAttemptAt >= PRIVATE_NVR_ENDPOINT_RECOVERY_COOLDOWN_MS;
  return { eligible: true, outageStartedAt: startedAt,
    ready: now - startedAt >= PRIVATE_NVR_ENDPOINT_RECOVERY_OUTAGE_MS && cooldownComplete };
}
