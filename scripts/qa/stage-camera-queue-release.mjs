import { copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, symlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, resolve } from "node:path";

// Local preparation only: no upload, promotion, credentials, or DB mutation.
// Keep the attested production source immutable; overlay only the queue bridge.
const root = resolve(import.meta.dirname, "../..");
const baseline = "/private/tmp/journal-code-release.TimNH9";
const expectedDeployment = "dpl_8DeajRc6Y7RojyVwLUK5xhQu48bZ";
const expectedManifest = "668ebaa20391975d098ee09574cced7466673d3a586a0276d9659a030c91f5d9";
const expectedSql = "f91ca4f57f35d3796f0e7293d01efa759c9fc268b544e231c3ae633f7cafe64d";
const target = resolve(process.argv[2] || "");
if (!/^\/private\/tmp\/camera-queue-release\.[A-Za-z0-9]+$/.test(target)
  || !lstatSync(target).isDirectory() || readdirSync(target).length) throw Error("Expected a new, empty camera queue stage");
const sha = (bytes, algorithm = "sha256") => createHash(algorithm).update(bytes).digest("hex");
const inventory = JSON.parse(readFileSync(`${baseline}.inventory.json`, "utf8"));
const files = [...inventory.files].sort((a, b) => a.path.localeCompare(b.path));
if (inventory.deployment !== expectedDeployment || inventory.source_stage !== baseline
  || files.length !== 1181 || inventory.source_manifest_sha256 !== expectedManifest
  || sha(JSON.stringify(files)) !== expectedManifest) throw Error("Production source attestation mismatch");
if (sha(readFileSync(join(root, "supabase/migrations/20260831090000_camera_action_queue_contract.sql"))) !== expectedSql) {
  throw Error("Approved SQL digest changed");
}
const overlays = new Set([
  "app/api/video-gateway/camera-actions/route.ts",
  "lib/domain/digital-observer/camera-queue-contract.ts"
]);
const contents = new Map();
for (const file of files) {
  if (isAbsolute(file.path) || file.path.split("/").some(part => part === ".." || part === ".git" || part.startsWith(".env"))) {
    throw Error("Unsafe source inventory path");
  }
  const source = join(baseline, file.path);
  if (!lstatSync(source).isFile() || sha(readFileSync(source), "sha1") !== file.hash || contents.has(file.path)) {
    throw Error(`Source inventory mismatch: ${file.path}`);
  }
  contents.set(file.path, source);
}
for (const file of overlays) {
  const source = join(root, file);
  if (!lstatSync(source).isFile()) throw Error(`Invalid overlay: ${file}`);
  contents.set(file, source);
}
const project = JSON.parse(readFileSync(join(root, ".vercel/project.json"), "utf8"));
if (project.projectId !== "prj_3OyzcFVSdsuxk1D7ivObKhCh2psT" || project.orgId !== "team_BtPlZlWpbsStW7mTViXaOX6L") {
  throw Error("Deployment project mismatch");
}
contents.set(".vercel/project.json", join(root, ".vercel/project.json"));
for (const [file, source] of contents) {
  mkdirSync(dirname(join(target, file)), { recursive: true });
  copyFileSync(source, join(target, file));
}
symlinkSync(join(root, "node_modules"), join(target, "node_modules"));
console.log(JSON.stringify({ target, baseline: expectedDeployment, verifiedSourceFiles: files.length,
  overlays: [...overlays].map(path => ({ path, sha256: sha(readFileSync(join(target, path))) })),
  deployed: false, migrationApplied: false, physicalExecution: false }));
