import { copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, symlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, resolve } from "node:path";

// Preparation only. No deployment, remote database access or secret files.
const root = resolve(import.meta.dirname, "../..");
const baseline = "/private/tmp/camera-queue-release.TMWpRw";
const attestation = "/private/tmp/journal-code-release.TimNH9.inventory.json";
const expectedManifest = "668ebaa20391975d098ee09574cced7466673d3a586a0276d9659a030c91f5d9";
const queueHashes = {
  "app/api/video-gateway/camera-actions/route.ts": "ce5535580b6cf58337ebd54fe75df8ae8c2aaf880fcdb2d3820f35099a4a5a69",
  "lib/domain/digital-observer/camera-queue-contract.ts": "e862a7b7e025cd8f9ca453a35900f4416f3d3c0b048ebbba2fcd0c1ebd235765"
};
const additions = [
  "app/api/digital-observer/camera-diagnostics/route.ts",
  "components/digital-observer/guard-diagnostics-panel.tsx",
  "lib/domain/digital-observer/camera-action-schema.ts",
  "lib/domain/digital-observer/guard-engine.ts",
  "lib/domain/digital-observer/guard-diagnostics-types.ts",
  "lib/domain/digital-observer/guard-diagnostics-service.ts",
  "lib/domain/digital-observer/guard-diagnostics-client.ts",
  "scripts/qa/digital-guard-diagnostics-integration.test.mjs",
  "scripts/qa/digital-guard-diagnostics-client.test.mjs"
];
const target = resolve(process.argv[2] || "");
if (!/^\/private\/tmp\/guard-diagnostics-release\.[A-Za-z0-9]+$/.test(target)
  || !lstatSync(target).isDirectory() || readdirSync(target).length) throw Error("Expected a new empty diagnostics stage");
const sha = (path, algorithm = "sha256") => createHash(algorithm).update(readFileSync(path)).digest("hex");
const inventory = JSON.parse(readFileSync(attestation, "utf8"));
const files = [...inventory.files].sort((a, b) => a.path.localeCompare(b.path));
if (inventory.deployment !== "dpl_8DeajRc6Y7RojyVwLUK5xhQu48bZ" || files.length !== 1181
  || inventory.source_manifest_sha256 !== expectedManifest
  || createHash("sha256").update(JSON.stringify(files)).digest("hex") !== expectedManifest) throw Error("Baseline attestation mismatch");
const contents = new Map();
for (const file of files) {
  if (isAbsolute(file.path) || file.path.split("/").some(part => part === ".." || part === ".git" || part.startsWith(".env"))) throw Error("Unsafe inventory path");
  const source = join(baseline, file.path);
  const expected = queueHashes[file.path] ?? file.hash;
  if (!lstatSync(source).isFile() || sha(source, queueHashes[file.path] ? "sha256" : "sha1") !== expected || contents.has(file.path)) throw Error(`Changed baseline: ${file.path}`);
  contents.set(file.path, source);
}
for (const [path, hash] of Object.entries(queueHashes)) {
  if (sha(join(baseline, path)) !== hash) throw Error(`Changed queue overlay: ${path}`);
  contents.set(path, join(baseline, path));
}
for (const path of additions) {
  if (contents.has(path) || !lstatSync(join(root, path)).isFile()) throw Error(`Unexpected diagnostics addition: ${path}`);
  contents.set(path, join(root, path));
}
const project = JSON.parse(readFileSync(join(baseline, ".vercel/project.json"), "utf8"));
if (project.projectId !== "prj_3OyzcFVSdsuxk1D7ivObKhCh2psT" || project.orgId !== "team_BtPlZlWpbsStW7mTViXaOX6L") throw Error("Project mismatch");
contents.set(".vercel/project.json", join(baseline, ".vercel/project.json"));
for (const [path, source] of contents) {
  mkdirSync(dirname(join(target, path)), { recursive: true });
  copyFileSync(source, join(target, path));
}
symlinkSync(join(root, "node_modules"), join(target, "node_modules"));
console.log(JSON.stringify({ target, verifiedBaselineFiles: files.length, queueHashes,
  additions: additions.map(path => ({ path, sha256: sha(join(target, path)) })),
  pageBinding: "PENDING_APPLY_PATCH_ON_BASELINE_PAGE", deployed: false, physicalExecution: false }));
