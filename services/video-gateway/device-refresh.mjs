import { randomBytes } from "node:crypto";

export const pendingDeviceRefreshAccount = "device_refresh_pending";

// The only rotating-identity owner is the Gateway process. Its caller provides
// single-flight; all durable material below goes through Keychain callbacks.
export async function refreshDeviceCredentials({ gatewayId, cloudBaseUrl, readSecret, writeSecret, removeSecret, fetcher = fetch, timeoutMs = 10_000 }) {
  let pending;
  const raw = readSecret(pendingDeviceRefreshAccount);
  if (raw) {
    try { pending = JSON.parse(raw); } catch { throw new Error("Device refresh recovery is invalid"); }
    if (pending.gatewayId !== gatewayId) {
      removeSecret(pendingDeviceRefreshAccount);
      pending = null;
    }
  }
  if (!pending) {
    const previous = readSecret("device_refresh_token");
    if (!previous) throw new Error("Gateway device identity is unavailable");
    pending = { gatewayId, previous, next: randomBytes(32).toString("base64url") };
    writeSecret(pendingDeviceRefreshAccount, JSON.stringify(pending));
  }
  if (![pending.previous, pending.next].every(value => typeof value === "string" && value.length >= 32 && value.length <= 160)) {
    throw new Error("Device refresh recovery is invalid");
  }
  // A lost response can leave either key current. The prepared next key is a
  // proof of possession, not an extension of the old-key recovery grace.
  for (const token of [pending.previous, pending.next]) {
    const response = await fetcher(`${cloudBaseUrl}/api/digital-observer/gateway-enrollment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "refresh", gateway_id: gatewayId, refresh_token: token, next_refresh_token: pending.next }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) continue;
    if (!response.ok) throw new Error("Gateway device refresh unavailable");
    if (payload.data?.rotation_protocol !== 2 || payload.data?.refresh_token !== pending.next || !payload.data?.access_token) {
      throw new Error("Gateway device refresh protocol mismatch");
    }
    writeSecret("device_refresh_token", pending.next);
    removeSecret(pendingDeviceRefreshAccount);
    return { accessToken: String(payload.data.access_token), expiresAt: Date.parse(String(payload.data.access_expires_at || "")) || Date.now() + 9 * 60 * 1000 };
  }
  throw Object.assign(new Error("Gateway device identity requires approval"), { code: "device_relink_required" });
}
