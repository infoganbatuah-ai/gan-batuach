import { readFileSync } from "node:fs";

const runner = readFileSync("scripts/run-persistent-home-gateway.mjs", "utf8");
const migration = readFileSync("scripts/migrate-dvr-profile-to-runtime-keychain.mjs", "utf8");

for (const forbidden of ["runtimeConfigPath", "home-gateway.json\`;", "readFileSync(runtimeConfigPath"]) {
  if (runner.includes(forbidden)) throw new Error(`Persistent Gateway still reads DVR profile from disk: ${forbidden}`);
}
for (const required of ['keychainSecret("dvr_profile_json")', 'keychainSecret("dvr_password")']) {
  if (!runner.includes(required)) throw new Error(`Missing persistent Keychain DVR profile field: ${required}`);
}
for (const required of ["initial DVR discovery unavailable; retry scheduled", "15 * 60 * 1000"]) {
  if (!runner.includes(required)) throw new Error(`Missing persistent discovery resilience control: ${required}`);
}
for (const required of ['writeSecret("dvr_profile_json"', 'writeSecret("dvr_password"', "rmSync(profilePath", "original profile was not removed"]) {
  if (!migration.includes(required)) throw new Error(`Missing fail-safe DVR migration control: ${required}`);
}

console.log("Persistent DVR Keychain-only QA PASS");
