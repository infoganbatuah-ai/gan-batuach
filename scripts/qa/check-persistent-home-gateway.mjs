import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../run-persistent-home-gateway.mjs", import.meta.url), "utf8");
const server = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
const installer = readFileSync(new URL("../install-persistent-home-gateway.mjs", import.meta.url), "utf8");
const sharedSecretStore = readFileSync(new URL("../../services/video-gateway/edge-secret-store-sync.mjs", import.meta.url), "utf8");
for (const required of ["cloud-discovery", "cloud-learning", "no_raw_video_returned", "read_only_requested", "createEdgeSecretStoreSync"]) {
  if (!source.includes(required)) throw new Error(`Missing shared edge runtime safety control: ${required}`);
}
if (!sharedSecretStore.includes("find-generic-password") || !sharedSecretStore.includes("secure_volume")) throw new Error("Shared edge secret store does not preserve Keychain and secure-volume backends");
for (const required of ["streamCount", "capabilities", "ptz: false", "siren: false", "light: false", "remote_settings: false"]) {
  if (!server.includes(required)) throw new Error(`Missing gateway capability discovery control: ${required}`);
}
if (/console\.log\([^)]*password|JSON\.stringify\([^)]*password[^)]*\)\s*\)/.test(source)) throw new Error("Persistent gateway may log DVR credentials");
for (const required of ["process.execPath", "0o600", "KeepAlive", "kickstart", ".local", ".env.video-gateway.local"]) {
  if (!installer.includes(required)) throw new Error(`Missing persistent installer safety control: ${required}`);
}
if (/readFileSync\([^)]*cloudConfig[^)]*\).*console/s.test(installer)) throw new Error("Installer may print cloud configuration");
console.log("Persistent home gateway safety PASS");
