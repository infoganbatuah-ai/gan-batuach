export const SOAK_HEALTH_PROBE_CONTRACT = "observer-soak-health-probe-v1";

export async function probeLocalHealth(port, { fetchImpl = fetch, now = Date.now, timeoutMs = 8_000, freshnessMs = 15_000, livenessTimeoutMs = 2_000 } = {}) {
  const started = now();
  const result = { contract: SOAK_HEALTH_PROBE_CONTRACT, ok: false, reason: null, http_status: null, latency_ms: null, body: null };
  try {
    const response = await fetchImpl(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(timeoutMs) });
    result.http_status = response.status;
    if (response.status === 401 || response.status === 403) result.reason = "AUTH_FAILURE";
    else if (!response.ok) result.reason = response.status === 503 ? "SERVICE_BUSY" : "HTTP_NON_2XX";
    let body;
    try { body = await response.json(); }
    catch { result.reason ||= "MALFORMED_PAYLOAD"; }
    if (body && typeof body === "object") {
      result.body = body;
      if (!result.reason && (body.contract !== "observer-edge-health-v1" || body.ok !== true)) result.reason = "INVALID_PAYLOAD";
      if (!result.reason) {
        const observed = Date.parse(body.observed_at);
        if (!Number.isFinite(observed) || Math.abs(now() - observed) > freshnessMs) result.reason = "STALE_PAYLOAD";
      }
    }
    if (!body && !result.reason) result.reason = "MALFORMED_PAYLOAD";
    result.ok = result.reason === null;
  } catch (error) {
    const code = error?.cause?.code || error?.code;
    result.reason = error?.name === "TimeoutError" || error?.name === "AbortError" ? "TIMEOUT"
      : code === "ECONNREFUSED" ? "CONNECTION_REFUSED"
      : code === "UND_ERR_CONNECT_TIMEOUT" ? "TIMEOUT"
      : "PROBE_TRANSPORT_ERROR";
  }
  result.latency_ms = Math.max(0, now() - started);
  if (!result.ok) {
    const livenessStarted = now();
    try {
      const live = await fetchImpl(`http://127.0.0.1:${port}/health/live`, { signal: AbortSignal.timeout(livenessTimeoutMs) });
      const body = await live.json();
      result.liveness = { ok: live.ok && body?.contract === "observer-edge-liveness-v1" && body?.ok === true,
        reason: live.ok ? body?.contract === "observer-edge-liveness-v1" ? null : "INVALID_PAYLOAD" : "HTTP_NON_2XX",
        http_status: live.status, latency_ms: Math.max(0, now() - livenessStarted) };
    } catch (error) {
      result.liveness = { ok: false, reason: error?.name === "TimeoutError" || error?.name === "AbortError" ? "TIMEOUT"
        : error?.cause?.code === "ECONNREFUSED" ? "CONNECTION_REFUSED" : "PROBE_TRANSPORT_ERROR",
        http_status: null, latency_ms: Math.max(0, now() - livenessStarted) };
    }
  }
  return result;
}
