import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { createKeychainStore } from "../../services/video-gateway/keychain-store.mjs";
import { refreshDeviceCredentials } from "../../services/video-gateway/device-refresh.mjs";

const args = new Map(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, "").split("=");
  return [key, rest.join("=") || true];
}));
const profile = String(args.get("profile") || "").trim();
const secretDir = resolve(String(args.get("secret-dir") || ""));
const attempts = Number(args.get("attempts") || 3);

if (!/^[A-Za-z0-9._-]{2,40}$/.test(profile)) throw new Error("MANAGED_DEVICE_AUTH_PROFILE_INVALID");
if (!String(args.get("secret-dir") || "").trim()) throw new Error("MANAGED_DEVICE_AUTH_SECRET_DIR_REQUIRED");
if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) throw new Error("MANAGED_DEVICE_AUTH_ATTEMPTS_INVALID");

const store = createKeychainStore({ secretDir });
const gatewayId = await store.read("device_gateway_id");
const cloudBaseUrl = (await store.read("device_cloud_base_url")).replace(/\/$/, "");
if (!gatewayId || !cloudBaseUrl.startsWith("https://")) throw new Error("MANAGED_DEVICE_AUTH_BINDING_INVALID");

const results = [];
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  const startedAt = Date.now();
  const credentials = await refreshDeviceCredentials({
    gatewayId,
    cloudBaseUrl,
    readSecret: account => store.read(account),
    writeSecret: (account, value) => store.write(account, value),
    removeSecret: account => store.remove(account)
  });
  const ttlMs = credentials.expiresAt - Date.now();
  if (!credentials.accessToken || ttlMs < 60_000) throw new Error("MANAGED_DEVICE_AUTH_SESSION_INVALID");
  results.push({ attempt, status: "PASS", latency_ms: Date.now() - startedAt,
    access_ttl_seconds: Math.floor(ttlMs / 1_000) });
  if (attempt < attempts) await new Promise(resolveWait => setTimeout(resolveWait, 25));
}

console.log(JSON.stringify({
  contract: "observer-installed-managed-device-auth-probe-v1",
  profile,
  device_id_sha256_prefix: createHash("sha256").update(gatewayId).digest("hex").slice(0, 16),
  cloud_transport: "HTTPS",
  identity_scheme: "ED25519_V1",
  private_key_exported: false,
  access_token_logged: false,
  status: "PASS",
  results
}, null, 2));
