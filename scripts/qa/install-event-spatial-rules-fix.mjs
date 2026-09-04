import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// Scoped live update: only the journal sampler and tracker are replaced.
// Gateway identity, DVR credentials, relays, models and recorder settings stay intact.
const runtime = join(homedir(), ".local/share/gan-batuach/video-gateway");
const files = [
  "services/video-gateway/journal-loop.mjs",
  "services/video-gateway/journal-tracker.mjs"
];
const expectedRuntime = {
  "services/video-gateway/journal-loop.mjs": "5a32f10f4e030c0644756b9436233926153ffefdbd9b9412f87aa56bcb0e1903",
  "services/video-gateway/journal-tracker.mjs": "e74ff3c10160bae46735f94dd779f8e1aa330bb4c56cf654827cbe36a7e8a3f2"
};
const expectedSource = {
  "services/video-gateway/journal-loop.mjs": "9c5979210056fa5c33e18f2fe5adebcb374e1bf61841bc23a3c873fa3afc42d4",
  "services/video-gateway/journal-tracker.mjs": "0541358141dfb135dbe002ce996a5370d2a108072da95a2eeb63465cc8a4a5ee"
};
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

for (const path of files) {
  const source = join(process.cwd(), path);
  const destination = join(runtime, path);
  if (!existsSync(source) || !existsSync(destination)) throw new Error("Scoped spatial-rules source or runtime file is missing");
  if (digest(source) !== expectedSource[path]) throw new Error("Reviewed spatial-rules source changed; refusing live update");
  if (digest(destination) !== expectedRuntime[path]) throw new Error("Live runtime changed since review; refusing concurrent overwrite");
  execFileSync(process.execPath, ["--check", source], { stdio: "pipe" });
}

const backup = join(runtime, "backups", `event-spatial-rules-${new Date().toISOString().replaceAll(":", "-")}`);
mkdirSync(backup, { recursive: true, mode: 0o700 });
const changed = [];
try {
  for (const path of files) {
    const destination = join(runtime, path);
    const backupPath = join(backup, path);
    mkdirSync(dirname(backupPath), { recursive: true, mode: 0o700 });
    copyFileSync(destination, backupPath);
    copyFileSync(join(process.cwd(), path), `${destination}.spatial-new`);
    renameSync(`${destination}.spatial-new`, destination);
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
  console.error(JSON.stringify({ installed: false, rolled_back: true, backup, reason: error instanceof Error ? error.message : "spatial_rules_install_failed" }));
  process.exitCode = 1;
}
