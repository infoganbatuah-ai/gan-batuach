import crypto from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const observerSiteId = process.argv[2];
const gatewayId = process.argv[3] || "home-mac-gateway";
if (!observerSiteId) throw new Error("observer site id is required");

const secret = crypto.randomBytes(48).toString("base64url");
const gatewaySecret = crypto.randomBytes(48).toString("base64url");
const allowlist = `${gatewayId}:${observerSiteId}`;
const keychainService = `gan-batuach.video-gateway.${gatewayId}`;

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

writeFileSync(".env.video-gateway.local", [
  "VIDEO_GATEWAY_CLOUD_BASE_URL=https://gan-batuach.vercel.app",
  `VIDEO_GATEWAY_CLOUD_GATEWAY_ID=${gatewayId}`,
  `VIDEO_GATEWAY_CLOUD_OBSERVER_SITE_ID=${observerSiteId}`,
  `VIDEO_GATEWAY_KEYCHAIN_SERVICE=${keychainService}`,
  ""
].join("\n"), { mode: 0o600 });
chmodSync(".env.video-gateway.local", 0o600);
console.log("Local Gateway pairing configuration created. Secrets were stored in macOS Keychain and were not printed or written to disk.");
