import "../../services/video-gateway/http-runtime.mjs";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import { softwareConnectorDeviceSession } from "../../services/video-gateway/software-connector-cloud.mjs";

const root = join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota");
const configPath = join(root, "agent-config.json");
if (!existsSync(configPath) || lstatSync(configPath).isSymbolicLink() ||
  realpathSync(configPath) !== configPath || (lstatSync(configPath).mode & 0o077) !== 0)
  throw new Error("P38_GATEWAY_RELEASE_PROBE_CONFIG_UNSAFE");
const config = JSON.parse(readFileSync(configPath, "utf8"));
if (config.profile !== "PHYSICAL_GATEWAY" || config.channel !== "HOME_QA" ||
  !config.deviceId || !config.secretDir || !config.qaTlsCaPath ||
  !/^[a-f0-9]{64}$/.test(config.qaTlsCaSha256 || ""))
  throw new Error("P38_GATEWAY_RELEASE_PROBE_CONFIG_INVALID");
if (!existsSync(config.qaTlsCaPath) || lstatSync(config.qaTlsCaPath).isSymbolicLink() ||
  realpathSync(config.qaTlsCaPath) !== config.qaTlsCaPath ||
  createHash("sha256").update(readFileSync(config.qaTlsCaPath)).digest("hex") !== config.qaTlsCaSha256)
  throw new Error("P38_GATEWAY_RELEASE_PROBE_TLS_INVALID");
if (!process.env.NODE_EXTRA_CA_CERTS ||
  realpathSync(process.env.NODE_EXTRA_CA_CERTS) !== realpathSync(config.qaTlsCaPath))
  throw new Error("P38_GATEWAY_RELEASE_PROBE_TLS_PROCESS_INVALID");

const store = createEdgeSecretStoreSync({ secretDir: config.secretDir });
const session = await softwareConnectorDeviceSession(store);
if (session.authMode !== "ED25519_V1" || session.gatewayId !== config.deviceId)
  throw new Error("P38_GATEWAY_RELEASE_PROBE_IDENTITY_INVALID");
const current = JSON.parse(readFileSync(join(root, "current.json"), "utf8"));
const url = new URL("/api/video-gateway/edge-updates", session.baseUrl);
for (const [key, value] of Object.entries({
  platform: "darwin",
  architecture: process.arch,
  profile: config.profile,
  current_version: current.version,
  config_version: config.configVersion || 1,
  channel: config.channel
})) url.searchParams.set(key, String(value));
const response = await fetch(url, {
  method: "GET",
  headers: {
    "x-video-gateway-device-token": session.accessToken,
    "x-video-gateway-id": session.gatewayId
  },
  redirect: "error",
  signal: AbortSignal.timeout(30_000)
});
const payload = await response.json().catch(() => ({}));
const data = payload?.data || {};
console.log(JSON.stringify({
  status: response.status,
  release_id: data?.manifest?.release_id || data?.release_id || null,
  version: data?.manifest?.version || data?.version || null,
  reason: data?.reason || payload?.error?.code || null
}));
