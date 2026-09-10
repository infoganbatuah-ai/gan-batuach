import { randomBytes, randomUUID } from "node:crypto";
import { createManagedDeviceProofHeaders } from "./managed-device-auth.mjs";

export const pendingDeviceRefreshAccount = "device_refresh_pending";
const runtimeInstanceId = `gateway:${randomUUID()}`;
let deviceSequence = 0;

// The only rotating-identity owner is the Gateway process. Its caller provides
// single-flight; all durable material below goes through Keychain callbacks.
export async function refreshDeviceCredentials({ gatewayId, cloudBaseUrl, readSecret, writeSecret, removeSecret, fetcher = fetch, timeoutMs = 10_000 }) {
  const privateKeyPkcs8 = await readSecret("device_private_key_pkcs8");
  const credentialVersion = Number(await readSecret("device_credential_version") || 0);
  if (privateKeyPkcs8 && credentialVersion > 0) {
    const body = JSON.stringify({ action: "authenticate", gateway_id: gatewayId });
    const pathname = "/api/digital-observer/gateway-enrollment";
    const response = await fetcher(`${cloudBaseUrl}${pathname}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...createManagedDeviceProofHeaders({ method: "POST", pathname,
        body, deviceId: gatewayId, credentialVersion, privateKeyPkcs8, runtimeInstanceId, sequence: ++deviceSequence }) },
      body,
      signal: AbortSignal.timeout(timeoutMs)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.data?.authentication_protocol !== "ED25519_V1" || !payload.data?.access_token) {
      throw Object.assign(new Error("Managed device authentication requires approval"), { code: "device_relink_required" });
    }
    return { accessToken: String(payload.data.access_token), expiresAt: Date.parse(String(payload.data.access_expires_at || "")) || Date.now() + 9 * 60 * 1000 };
  }
  let pending;
  const raw = await readSecret(pendingDeviceRefreshAccount);
  if (raw) {
    try { pending = JSON.parse(raw); } catch { throw new Error("Device refresh recovery is invalid"); }
    if (pending.gatewayId !== gatewayId) {
      await removeSecret(pendingDeviceRefreshAccount);
      pending = null;
    }
  }
  if (!pending) {
    const previous = await readSecret("device_refresh_token");
    if (!previous) throw new Error("Gateway device identity is unavailable");
    pending = { gatewayId, previous, next: randomBytes(32).toString("base64url") };
    await writeSecret(pendingDeviceRefreshAccount, JSON.stringify(pending));
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
    await writeSecret("device_refresh_token", pending.next);
    await removeSecret(pendingDeviceRefreshAccount);
    return { accessToken: String(payload.data.access_token), expiresAt: Date.parse(String(payload.data.access_expires_at || "")) || Date.now() + 9 * 60 * 1000 };
  }
  throw Object.assign(new Error("Gateway device identity requires approval"), { code: "device_relink_required" });
}
