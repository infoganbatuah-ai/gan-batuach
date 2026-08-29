import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../run-persistent-home-gateway.mjs", import.meta.url), "utf8");
const server = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
const installer = readFileSync(new URL("../install-persistent-home-gateway.mjs", import.meta.url), "utf8");
const setup = readFileSync(new URL("../setup-local-learning-gateway.mjs", import.meta.url), "utf8");
for (const required of ["find-generic-password", "cloud-discovery", "cloud-learning", "no_raw_video_returned", "read_only_requested"]) {
  if (!source.includes(required)) throw new Error(`Missing persistent gateway safety control: ${required}`);
}
for (const required of ["initial cloud learning unavailable; live remains active", "Keep relays available and retry learning on schedule"]) {
  if (!source.includes(required)) throw new Error(`Missing live isolation from cloud learning failure: ${required}`);
}
for (const required of ["/cloud/discovery", "/cloud/learning", "/cloud/event-media", "never", "access or refresh token"]) {
  if (!source.includes(required)) throw new Error(`Missing token-free local cloud proxy use: ${required}`);
}
for (const required of ["forwardDeviceCloudRequest", "authorized(request)", "device_gateway_id", "x-video-gateway-device-token", "invalid_media_content_type"]) {
  if (!server.includes(required)) throw new Error(`Missing authenticated fixed-route cloud proxy: ${required}`);
}
for (const required of ["streamCount", "capabilities", "ptz: false", "siren: false", "light: false", "remote_settings: false"]) {
  if (!server.includes(required)) throw new Error(`Missing gateway capability discovery control: ${required}`);
}
if (/console\.log\([^)]*password|JSON\.stringify\([^)]*password[^)]*\)\s*\)/.test(source)) throw new Error("Persistent gateway may log DVR credentials");
for (const required of ["process.execPath", "0o600", "KeepAlive", "kickstart", ".local", "GAN_BATUACH_GATEWAY_KEYCHAIN_SERVICE"]) {
  if (!installer.includes(required)) throw new Error(`Missing persistent installer safety control: ${required}`);
}
for (const forbidden of [".env.video-gateway.local", "cloudConfig", "copyFileSync(cloudConfig", "VIDEO_GATEWAY_SIGNING_SECRET ||"]) {
  if (installer.includes(forbidden) || source.includes(forbidden)) throw new Error(`Persistent Gateway may read or write sensitive disk config: ${forbidden}`);
}
if (setup.includes("writeFileSync") || setup.includes(".env.video-gateway.local")) throw new Error("Gateway setup may not write pairing configuration to disk");
console.log("Persistent home gateway safety PASS");
