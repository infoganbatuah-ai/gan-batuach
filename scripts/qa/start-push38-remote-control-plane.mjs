import { readFileSync, realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

const secretOption = process.argv.find(value => value.startsWith("--runtime-secrets="))?.slice(18) || "";
const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const secretPath = realpathSync(resolve(secretOption));
if (!secretPath.startsWith(restricted) || (statSync(secretPath).mode & 0o077) !== 0)
  throw new Error("P38_REMOTE_CONTROL_SECRET_UNSAFE");
const secrets = JSON.parse(readFileSync(secretPath, "utf8"));
if (secrets.protocol !== "observer-push38-remote-runtime-secrets-v1" ||
  !/^[A-Za-z0-9_-]{64}$/.test(secrets.cloud_discovery_secret || ""))
  throw new Error("P38_REMOTE_CONTROL_SECRET_INVALID");
process.env.PUSH38T_VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET = secrets.cloud_discovery_secret;
process.env.PUSH38T_PLAYBACK_EDGE_ORIGINS_JSON = JSON.stringify({
  "62df97e2-3c0b-427f-9108-bde029bc10e7": "https://gateway-media-homeqa.ganbatuach.com:18443",
  "db267b52-6282-4944-bcee-5d4857698fb0": "https://connector-media-homeqa.ganbatuach.com:18443"
});
// The frozen exact build remains the default. During qualification closure a
// route-only candidate correction may need to run from the current preserved
// source before a new exact build is produced; keep that mode explicit and
// development-labelled instead of silently serving a stale build.
if (!process.argv.includes("--source-candidate") && !process.argv.includes("--serve-build"))
  process.argv.push("--serve-build");
if (!process.argv.includes("--enable-legacy-delivery")) process.argv.push("--enable-legacy-delivery");
await import("./start-push38t-qualification.mjs");
