import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// Scoped live update: preserve Gateway identity, DVR credentials, discovery,
// relays, models and every unrelated runtime module.
const runtime = join(homedir(), ".local/share/gan-batuach/video-gateway");
const files = [
  "services/video-gateway/object-inference-client.mjs",
  "services/video-gateway/journal-loop.mjs"
];
const expectedRuntime = {
  "services/video-gateway/object-inference-client.mjs": "26c3c75d5dc233ddbc4dad6b907eb0b3bed4a6e07088fb01cfe4f247c05d1d56",
  "services/video-gateway/journal-loop.mjs": "344a774ebb5f8fce394844777a9dfd4799cdd592b0d50511fdb2117866df75d8"
};
const expectedSource = {
  "services/video-gateway/object-inference-client.mjs": "99436089ad33edc837198c36e63d4c135adc7156da3cd90736a7788d02b0be58",
  "services/video-gateway/journal-loop.mjs": "5a32f10f4e030c0644756b9436233926153ffefdbd9b9412f87aa56bcb0e1903"
};
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

for (const path of files) {
  const source = join(process.cwd(), path);
  const destination = join(runtime, path);
  if (!existsSync(source) || !existsSync(destination)) throw new Error("Scoped stability source or runtime file is missing");
  if (digest(source) !== expectedSource[path]) throw new Error("Reviewed stability source changed; refusing live update");
  if (digest(destination) !== expectedRuntime[path]) throw new Error("Live runtime changed since review; refusing concurrent overwrite");
  execFileSync(process.execPath, ["--check", source], { stdio: "pipe" });
}

const backup = join(runtime, "backups", `event-runtime-stability-${new Date().toISOString().replaceAll(":", "-")}`);
mkdirSync(backup, { recursive: true, mode: 0o700 });
const changed = [];
try {
  for (const path of files) {
    const destination = join(runtime, path);
    const backupPath = join(backup, path);
    mkdirSync(dirname(backupPath), { recursive: true, mode: 0o700 });
    copyFileSync(destination, backupPath);
    copyFileSync(join(process.cwd(), path), `${destination}.stability-new`);
    renameSync(`${destination}.stability-new`, destination);
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
  console.log(JSON.stringify({ installed: true, backup, files: changed, identity_changed: false, recorder_configuration_changed: false }));
} catch (error) {
  for (const path of changed) copyFileSync(join(backup, path), join(runtime, path));
  execFileSync("/bin/launchctl", ["kickstart", "-k", `gui/${process.getuid()}/com.ganbatuach.video-gateway`], { stdio: "pipe" });
  console.error(JSON.stringify({ installed: false, rolled_back: true, backup, reason: error instanceof Error ? error.message : "stability_install_failed" }));
  process.exitCode = 1;
}
