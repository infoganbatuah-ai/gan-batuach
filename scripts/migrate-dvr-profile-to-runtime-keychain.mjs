import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const runtimeService = "com.ganbatuach.video-gateway.runtime";
const profilePath = join(homedir(), ".config", "gan-batuach", "home-gateway.json");

function readSecret(service, account) {
  const result = spawnSync("/usr/bin/security", ["find-generic-password", "-s", service, "-a", account, "-w"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function writeSecret(account, value) {
  const result = spawnSync("/usr/bin/security", ["add-generic-password", "-U", "-s", runtimeService, "-a", account, "-w", value], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("Unable to store DVR profile in macOS Keychain");
}

if (!existsSync(profilePath)) throw new Error("Existing local DVR profile was not found; no migration was performed");
const profile = JSON.parse(readFileSync(profilePath, "utf8"));
const required = ["endpoint", "port", "username", "vendor", "channel_count", "keychain_service"];
if (required.some((key) => !profile[key])) throw new Error("Existing local DVR profile is incomplete; no migration was performed");
const password = readSecret(String(profile.keychain_service), String(profile.username));
if (!password) throw new Error("Existing DVR password is unavailable in Keychain; no migration was performed");

const runtimeProfile = {
  endpoint: String(profile.endpoint),
  port: Number(profile.port),
  username: String(profile.username),
  vendor: String(profile.vendor),
  channel_count: Number(profile.channel_count)
};
writeSecret("dvr_profile_json", JSON.stringify(runtimeProfile));
writeSecret("dvr_password", password);

if (!readSecret(runtimeService, "dvr_profile_json") || !readSecret(runtimeService, "dvr_password")) {
  throw new Error("DVR Keychain verification failed; original profile was not removed");
}
rmSync(profilePath, { force: false });
console.log("DVR profile migrated to macOS Keychain; legacy disk profile removed");
