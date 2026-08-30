import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const keychainService = "com.ganbatuach.video-gateway.runtime";
const candidates = [
  join(process.cwd(), ".env.video-gateway.local"),
  "/private/tmp/gan-batuach-live-session/.env.video-gateway.local"
];
const source = candidates.find((path) => existsSync(path));
if (!source) throw new Error("Existing local Gateway configuration was not found; service was not changed.");

const values = Object.fromEntries(readFileSync(source, "utf8").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
  const index = line.indexOf("=");
  return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^[\"']|[\"']$/g, "")];
}));
const legacyService = values.VIDEO_GATEWAY_KEYCHAIN_SERVICE || "";
function legacyKeychain(account) {
  if (!legacyService) return "";
  const result = spawnSync("/usr/bin/security", ["find-generic-password", "-s", legacyService, "-a", account, "-w"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

const accounts = {
  gateway_signing_secret: values.VIDEO_GATEWAY_SIGNING_SECRET || legacyKeychain("gateway_signing_secret"),
  cloud_discovery_secret: values.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET || legacyKeychain("cloud_discovery_secret"),
  cloud_gateway_id: values.VIDEO_GATEWAY_CLOUD_GATEWAY_ID,
  cloud_observer_site_id: values.VIDEO_GATEWAY_CLOUD_OBSERVER_SITE_ID,
  cloud_base_url: values.VIDEO_GATEWAY_CLOUD_BASE_URL || "https://ganbatuach.com"
};
if (Object.entries(accounts).some(([, value]) => !value)) throw new Error("Existing Gateway configuration is incomplete; service was not changed.");

for (const [account, value] of Object.entries(accounts)) {
  const result = spawnSync("/usr/bin/security", ["add-generic-password", "-U", "-s", keychainService, "-a", account, "-w", value], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("Unable to store Gateway configuration in macOS Keychain.");
}
console.log("Gateway configuration migrated to macOS Keychain without writing a new disk configuration.");
