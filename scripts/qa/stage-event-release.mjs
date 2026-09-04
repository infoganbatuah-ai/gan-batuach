import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, mkdtempSync, symlinkSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { resolve, join, dirname } from "node:path";
import { tmpdir } from "node:os";

// Mechanical three-way release assembly; never uploads or mutates the checkout.
// Only the named journal files are merged onto an exported production tree.
const root = process.cwd();
const target = resolve(process.argv[2] || "");
if (!target.startsWith("/private/tmp/journal-release.") || !existsSync(join(target, "package.json"))) throw new Error("Expected isolated production export");
const files = [
  "lib/domain/event-engine/event-journal-service.ts", "lib/domain/event-engine/index.ts",
  "lib/domain/event-engine/event-evidence-compatibility.ts", "lib/domain/event-engine/event-manifest-policy.ts", "lib/domain/event-engine/media-fault-lifecycle.ts", "lib/domain/event-engine/off-hours.ts",
  "app/api/video-gateway/cloud-events/route.ts", "app/api/video-gateway/event-manifest/route.ts", "app/api/video-gateway/cloud-event-media/route.ts",
  "app/api/digital-observer/events/review/route.ts", "app/digital-observer/alerts/page.tsx"
];
const scratch = mkdtempSync(join(tmpdir(), "journal-merge-"));
const conflicts = [];
try {
  for (const path of files) {
    const current = readFileSync(join(root, path));
    const destination = join(target, path);
    mkdirSync(dirname(destination), { recursive: true });
    const ancestor = spawnSync("git", ["show", `f23c717:${path}`], { cwd: root, maxBuffer: 8 * 1024 * 1024 });
    if (!existsSync(destination)) { copyFileSync(join(root, path), destination); continue; }
    if (ancestor.status !== 0) {
      if (!readFileSync(destination).equals(current)) { conflicts.push(path); copyFileSync(join(root, path), destination + ".journal-candidate"); }
      continue;
    }
    const base = join(scratch, "base"), ours = join(scratch, "ours");
    writeFileSync(base, ancestor.stdout); writeFileSync(ours, current);
    const merged = spawnSync("git", ["merge-file", "-p", "-L", "production", "-L", "journal-base", "-L", "journal-fix", destination, base, ours], { maxBuffer: 8 * 1024 * 1024 });
    if (merged.status === null || merged.status > 127 || merged.error) throw new Error(`Merge failed: ${path}`);
    writeFileSync(destination, merged.stdout);
    if (merged.status > 0) conflicts.push(path);
  }
  for (const path of ["check-event-journal.mjs", "check-event-ingest.mjs", "check-event-outbox.mjs", "check-object-inference.mjs", "check-digital-observer-event-media.mjs", "check-event-evidence-compatibility.mjs", "check-event-manifest-policy.mjs"]) {
    mkdirSync(join(target, "scripts/qa"), {recursive:true});
    copyFileSync(join(root, "scripts/qa", path), join(target, "scripts/qa", path));
  }
  for (const name of ["journal-tracker.mjs", "journal-loop.mjs", "object-inference-client.mjs"]) {
    mkdirSync(join(target, "services/video-gateway"), {recursive:true});
    copyFileSync(join(root, "services/video-gateway", name), join(target, "services/video-gateway", name));
  }
  mkdirSync(join(target, ".vercel"), {recursive:true});
  copyFileSync(join(root, ".vercel/project.json"), join(target, ".vercel/project.json"));
  if (!existsSync(join(target, "node_modules"))) symlinkSync(join(root, "node_modules"), join(target, "node_modules"));
  const pkg = JSON.parse(readFileSync(join(target,"package.json"),"utf8"));
  pkg.scripts["qa:event-journal"] = JSON.parse(readFileSync(join(root,"package.json"),"utf8")).scripts["qa:event-journal"];
  writeFileSync(join(target,"package.json"),JSON.stringify(pkg,null,2)+"\n");
  console.log(JSON.stringify({target,files,conflicts},null,2));
} finally {
  // Only the freshly generated merge scratch directory; no user data here.
  rmSync(scratch, {recursive:true});
}
