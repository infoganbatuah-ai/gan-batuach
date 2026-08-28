import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const observerSiteId = process.argv[2];
const gatewayId = process.argv[3] || "home-mac-gateway";
if (!observerSiteId) throw new Error("observer site id is required");

const secret = crypto.randomBytes(48).toString("base64url");
const gatewaySecret = crypto.randomBytes(48).toString("base64url");
const allowlist = `${gatewayId}:${observerSiteId}`;
const keychainService = "com.ganbatuach.video-gateway.runtime";

function vercel(args, input) {
  const result = spawnSync("npx", ["--yes", "vercel@latest", ...args], {
    cwd: process.cwd(),
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"]
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `Vercel command failed: ${args.join(" ")}`);
}

function storeKeychainSecret(account, value) {
  const result = spawnSync("/usr/bin/security", ["add-generic-password", "-U", "-s", keychainService, "-a", account, "-w", value], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("Unable to store Gateway secret in macOS Keychain");
}

for (const name of ["VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET", "VIDEO_GATEWAY_CLOUD_ALLOWED_GATEWAYS", "VIDEO_GATEWAY_SIGNING_SECRET"]) {
  try { vercel(["env", "rm", name, "production", "--yes"]); } catch { /* Variable may not exist yet. */ }
}
vercel(["env", "add", "VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET", "production", "--sensitive"], `${secret}\n`);
vercel(["env", "add", "VIDEO_GATEWAY_CLOUD_ALLOWED_GATEWAYS", "production", "--sensitive"], `${allowlist}\n`);
vercel(["env", "add", "VIDEO_GATEWAY_SIGNING_SECRET", "production", "--sensitive"], `${gatewaySecret}\n`);
storeKeychainSecret("cloud_discovery_secret", secret);
storeKeychainSecret("gateway_signing_secret", gatewaySecret);
storeKeychainSecret("cloud_gateway_id", gatewayId);
storeKeychainSecret("cloud_observer_site_id", observerSiteId);
storeKeychainSecret("cloud_base_url", "https://ganbatuach.com");
console.log("Local Gateway pairing configuration was stored in macOS Keychain only.");
