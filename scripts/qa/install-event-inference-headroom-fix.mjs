import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// Scoped live update: add inference-time headroom without touching identity,
// DVR credentials, stream discovery, recording settings or spatial metadata.
const runtime = join(homedir(), ".local/share/gan-batuach/video-gateway");
const files = [
  "services/video-gateway/object-inference-client.mjs",
  "services/video-gateway/journal-loop.mjs"
];
const expectedRuntime = {
  "services/video-gateway/object-inference-client.mjs": "99436089ad33edc837198c36e63d4c135adc7156da3cd90736a7788d02b0be58",
  "services/video-gateway/journal-loop.mjs": "9c5979210056fa5c33e18f2fe5adebcb374e1bf61841bc23a3c873fa3afc42d4"
};
const expectedSource = {
  "services/video-gateway/object-inference-client.mjs": "3813d9e7934aa0d1fa00d75d4f59a51ea759441c4cb3f351f81b2e47c9f8d86c",
  "services/video-gateway/journal-loop.mjs": "72cf95d8e571573cdad07d0b556be51125fd4c4154eec9153824f2079904b19c"
};
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

for (const path of files) {
  const source = join(process.cwd(), path);
  const destination = join(runtime, path);
  if (!existsSync(source) || !existsSync(destination)) throw new Error("Scoped inference-headroom file is missing");
  if (digest(source) !== expectedSource[path]) throw new Error("Reviewed inference-headroom source changed; refusing live update");
  if (digest(destination) !== expectedRuntime[path]) throw new Error("Live runtime changed since review; refusing concurrent overwrite");
  execFileSync(process.execPath, ["--check", source], { stdio: "pipe" });
}

const backup = join(runtime, "backups", `event-inference-headroom-${new Date().toISOString().replaceAll(":", "-")}`);
mkdirSync(backup, { recursive: true, mode: 0o700 });
const changed = [];
try {
  for (const path of files) {
    const destination = join(runtime, path);
    const backupPath = join(backup, path);
    mkdirSync(dirname(backupPath), { recursive: true, mode: 0o700 });
    copyFileSync(destination, backupPath);
    copyFileSync(join(process.cwd(), path), `${destination}.headroom-new`);
    renameSync(`${destination}.headroom-new`, destination);
    changed.push(path);
  }
  execFileSync("/bin/launchctl", ["kickstart", "-k", `gui/${process.getuid()}/com.ganbatuach.video-gateway`], { stdio: "pipe" });
  let healthy = false;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:18082/health", { signal: AbortSignal.timeout(1_500) });
      healthy = response.ok;
      if (healthy) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  if (!healthy) throw new Error("Updated Gateway did not regain process health");
  console.log(JSON.stringify({ installed: true, backup, files: changed, identity_changed: false, dvr_configuration_changed: false }));
} catch (error) {
  for (const path of changed) copyFileSync(join(backup, path), join(runtime, path));
  execFileSync("/bin/launchctl", ["kickstart", "-k", `gui/${process.getuid()}/com.ganbatuach.video-gateway`], { stdio: "pipe" });
  console.error(JSON.stringify({ installed: false, rolled_back: true, backup, reason: error instanceof Error ? error.message : "inference_headroom_install_failed" }));
  process.exitCode = 1;
}
