const FORBIDDEN_EXACT_KEYS = new Set([
  "password",
  "credential",
  "credentials",
  "cookie",
  "cookies",
  "authorization",
  "rtsp",
  "stream_url",
  "source_url",
  "endpoint",
  "host",
  "private"
]);

function isForbiddenKey(key: string) {
  const normalized = key.toLowerCase();
  if (normalized.startsWith("x-")) return normalized.includes("authorization") || normalized.includes("cookie");
  if (/(^|_)(password|credential|credentials|cookie|cookies|authorization|rtsp|stream_url|source_url|endpoint|host|private)($|_)/i.test(normalized)) return true;
  return FORBIDDEN_EXACT_KEYS.has(normalized);
}

function isSafeSecretStatusKey(key: string, value: unknown) {
  const normalized = key.toLowerCase();
  return typeof value === "boolean" && (
    normalized === "no_secrets_returned"
    || normalized === "no_secret_returned"
    || normalized === "no_secrets_received"
    || normalized === "no_credentials_received"
    || normalized === "no_credentials_returned"
  );
}

export function assertNoForbiddenDiscoveryFields(value: unknown, path = "payload") {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    if (/rtsp:\/\//i.test(value) || /rtsps:\/\//i.test(value)) throw new Error(`Forbidden stream URL in ${path}`);
    if (/\/\/[^/\s]+@/.test(value)) throw new Error(`Forbidden credentialed URL in ${path}`);
    return;
  }
  if (typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenDiscoveryFields(item, `${path}[${index}]`));
    return;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!isSafeSecretStatusKey(key, item) && isForbiddenKey(key)) {
      throw new Error(`Forbidden sensitive field ${path}.${key}`);
    }
    assertNoForbiddenDiscoveryFields(item, `${path}.${key}`);
  }
}
