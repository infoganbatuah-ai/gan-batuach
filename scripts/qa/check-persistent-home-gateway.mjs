import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../run-persistent-home-gateway.mjs", import.meta.url), "utf8");
for (const required of ["find-generic-password", "cloud-discovery", "cloud-learning", "no_raw_video_returned", "read_only_requested"]) {
  if (!source.includes(required)) throw new Error(`Missing persistent gateway safety control: ${required}`);
}
if (/console\.log\([^)]*password|JSON\.stringify\([^)]*password[^)]*\)\s*\)/.test(source)) throw new Error("Persistent gateway may log DVR credentials");
console.log("Persistent home gateway safety PASS");
