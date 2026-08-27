import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../run-persistent-home-gateway.mjs", import.meta.url), "utf8");
const server = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
const installer = readFileSync(new URL("../install-persistent-home-gateway.mjs", import.meta.url), "utf8");
for (const required of ["find-generic-password", "cloud-discovery", "cloud-learning", "no_raw_video_returned", "read_only_requested"]) {
  if (!source.includes(required)) throw new Error(`Missing persistent gateway safety control: ${required}`);
}
for (const required of ["streamCount", "capabilities", "ptz: false", "siren: false", "light: false", "remote_settings: false"]) {
  if (!server.includes(required)) throw new Error(`Missing gateway capability discovery control: ${required}`);
}
if (/console\.log\([^)]*password|JSON\.stringify\([^)]*password[^)]*\)\s*\)/.test(source)) throw new Error("Persistent gateway may log DVR credentials");
for (const required of ["process.execPath", "0o600", "KeepAlive", "kickstart", ".local", ".env.video-gateway.local"]) {
  if (!installer.includes(required)) throw new Error(`Missing persistent installer safety control: ${required}`);
}
if (/readFileSync\([^)]*cloudConfig[^)]*\).*console/s.test(installer)) throw new Error("Installer may print cloud configuration");
console.log("Persistent home gateway safety PASS");
