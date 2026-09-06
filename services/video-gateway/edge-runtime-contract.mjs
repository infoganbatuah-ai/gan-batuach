import { createHash, randomUUID } from "node:crypto";

export const EDGE_RUNTIME_VERSION = "observer-edge-runtime-v1";
export const EDGE_DEVICE_TYPES = Object.freeze(["SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY"]);
export const EDGE_COMMANDS = Object.freeze(["HEALTH_PROBE", "REFRESH_CONFIG", "RECONNECT_STREAM"]);
export const DEFAULT_RESOURCE_LIMITS = Object.freeze({
  max_cameras: 8,
  max_parallel_relays: 4,
  max_disk_buffer_mb: 1024,
  max_event_clip_mb: 8,
  recommended_memory_mb: 1024,
  recommended_cpu_cores: 2
});

const IDENTIFIER = /^[A-Za-z0-9._:-]{8,160}$/;
const SECRET_KEY = /^[a-z0-9_]{2,80}$/;
const CONFIG_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function failure(code) {
  throw Object.assign(new Error(code), { code });
}

export function normalizeEdgeDeviceType(value) {
  return EDGE_DEVICE_TYPES.includes(value) ? value : "PHYSICAL_GATEWAY";
}

export function createInstallationId(seed = randomUUID()) {
  return `edge-${createHash("sha256").update(seed).digest("hex").slice(0, 32)}`;
}

export function validateInstallationId(value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) failure("INVALID_INSTALLATION_ID");
  return value;
}

export function validateSecretAccount(value) {
  if (typeof value !== "string" || !SECRET_KEY.test(value)) failure("INVALID_SECRET_ACCOUNT");
  return value;
}

export function parseConnectorCommand(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) failure("INVALID_CONNECTOR_COMMAND");
  const keys = Object.keys(input);
  if (keys.some((key) => !["id", "command", "issued_at", "expires_at", "config_version", "stream_id"].includes(key))) {
    failure("INVALID_CONNECTOR_COMMAND");
  }
  if (typeof input.id !== "string" || !IDENTIFIER.test(input.id)) failure("INVALID_CONNECTOR_COMMAND_ID");
  if (!EDGE_COMMANDS.includes(input.command)) failure("CONNECTOR_COMMAND_NOT_ALLOWED");
  const issuedAt = Date.parse(input.issued_at);
  const expiresAt = Date.parse(input.expires_at);
  const now = Date.now();
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || issuedAt > now + 5_000 || expiresAt <= now || expiresAt - issuedAt > 60_000) {
    failure("CONNECTOR_COMMAND_EXPIRED");
  }
  if (input.command === "REFRESH_CONFIG" && (!Number.isInteger(input.config_version) || input.config_version < 1)) {
    failure("CONNECTOR_CONFIG_VERSION_REQUIRED");
  }
  if (input.command === "RECONNECT_STREAM" && (typeof input.stream_id !== "string" || !IDENTIFIER.test(input.stream_id))) {
    failure("CONNECTOR_STREAM_REQUIRED");
  }
  return Object.freeze({ ...input });
}

export function validateConnectorConfigSnapshot(input, currentVersion = 0, now = Date.now()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) failure("INVALID_CONNECTOR_CONFIG");
  if (Object.keys(input).some((key) => !["version", "issued_at", "expires_at", "cameras", "sampling_policy"].includes(key))) {
    failure("INVALID_CONNECTOR_CONFIG");
  }
  if (!Number.isInteger(input.version) || input.version < currentVersion) failure("CONNECTOR_CONFIG_ROLLBACK_REJECTED");
  const issuedAt = Date.parse(input.issued_at);
  const expiresAt = Date.parse(input.expires_at);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || issuedAt > now + 5_000 || expiresAt <= now || expiresAt - issuedAt > CONFIG_MAX_AGE_MS) {
    failure("CONNECTOR_CONFIG_EXPIRED");
  }
  if (!Array.isArray(input.cameras) || input.cameras.length > DEFAULT_RESOURCE_LIMITS.max_cameras) failure("CONNECTOR_CAMERA_LIMIT_EXCEEDED");
  return Object.freeze({ ...input, cameras: Object.freeze(input.cameras.map((camera) => Object.freeze({ ...camera }))) });
}

export function redactConnectorLog(input) {
  const secretPattern = /(password|secret|token|authorization|credential|rtsp_url|source_url)/i;
  const walk = (value, depth = 0) => {
    if (depth > 6) return "[bounded]";
    if (Array.isArray(value)) return value.slice(0, 20).map((item) => walk(item, depth + 1));
    if (!value || typeof value !== "object") return typeof value === "string" && value.length > 512 ? `${value.slice(0, 509)}...` : value;
    return Object.fromEntries(Object.entries(value).slice(0, 50).map(([key, child]) => [key, secretPattern.test(key) ? "[redacted]" : walk(child, depth + 1)]));
  };
  return walk(input);
}

export function connectorRuntimeIdentity(environment = process.env) {
  const deviceType = normalizeEdgeDeviceType(environment.OBSERVER_EDGE_DEVICE_TYPE);
  const installationId = validateInstallationId(environment.OBSERVER_EDGE_INSTALLATION_ID || createInstallationId());
  return Object.freeze({
    contract: EDGE_RUNTIME_VERSION,
    device_type: deviceType,
    installation_id: installationId,
    software_version: String(environment.OBSERVER_EDGE_VERSION || "development").slice(0, 80),
    build_sha: String(environment.OBSERVER_EDGE_BUILD_SHA || "unknown").slice(0, 80),
    outbound_only: true,
    arbitrary_shell_commands: false,
    resource_limits: DEFAULT_RESOURCE_LIMITS
  });
}
