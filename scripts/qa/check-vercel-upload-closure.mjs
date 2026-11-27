#!/usr/bin/env node
// Read-only Vercel CLI dry run: test the upload payload, not a full checkout.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = process.env.VERCEL_CLI_BIN;
if (!cli) throw new Error("Set VERCEL_CLI_BIN to the reviewed local Vercel CLI");
const project = process.env.VERCEL_DRY_PROJECT;
const scope = process.env.VERCEL_DRY_SCOPE;
if (!project || !scope) throw new Error("Set the existing QA project and team for the dry run");

const modules = [
  "cost-intelligence",
  "edge-update-contract",
  "edge-release-object",
  "home-qa-transition-phase",
  "edge-r2-download",
  "edge-release-trust",
  "home-qa-legacy-proof"
];
const expected = new Set(modules.flatMap(name => [
  `services/video-gateway/${name}.mjs`,
  `services/video-gateway/${name}.d.mts`
]));

function walk(directory) {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const cloudSource = [...walk("app/api"), ...walk("lib")].filter(path => /\.[cm]?[jt]sx?$/.test(path));
const direct = new Set();
for (const path of cloudSource) {
  const source = readFileSync(join(root, path), "utf8");
  for (const match of source.matchAll(/services\/video-gateway\/([a-z0-9-]+\.mjs)/g))
    direct.add(`services/video-gateway/${match[1]}`);
}
for (const path of direct) if (!expected.has(path)) throw new Error(`Unreviewed cloud import: ${path}`);
for (const name of modules) {
  const path = `services/video-gateway/${name}.mjs`;
  const source = readFileSync(join(root, path), "utf8");
  for (const match of source.matchAll(/(?:from\s*|import\s*)["']\.\/([a-z0-9-]+\.mjs)["']/g)) {
    const child = `services/video-gateway/${match[1]}`;
    if (!expected.has(child)) throw new Error(`Unreviewed transitive import: ${path} -> ${child}`);
  }
}

const dry = spawnSync(cli, ["deploy", "--dry", "--cwd", root,
  "--project", project, "--scope", scope], {
  cwd: root, encoding: "utf8", maxBuffer: 30 * 1024 * 1024
});
if (dry.status !== 0) throw new Error(`Vercel dry run failed (${dry.status}); no deployment was attempted`);
const report = JSON.parse(dry.stdout);
const included = new Set((report.files ?? []).map(file => file.path));
const actualService = [...included].filter(path => path.startsWith("services/video-gateway/"));
const missing = [...expected].filter(path => !included.has(path));
const unexpected = actualService.filter(path => !expected.has(path));
const excludedExamples = [
  "services/video-gateway/keychain-store.mjs",
  "services/video-gateway/http-runtime.mjs",
  "services/video-gateway/Dockerfile",
  "scripts/qa/check-vercel-upload-closure.mjs",
  "tests/parent-trust-garden.test.mjs",
  ".env.example"
];
const leaked = excludedExamples.filter(path => included.has(path));
if (missing.length || unexpected.length || leaked.length)
  throw new Error(JSON.stringify({ missing, unexpected, leaked }));
console.log(JSON.stringify({ status: "PASS", directCloudImports: direct.size,
  serviceModules: modules.length, servicePayloadFiles: actualService.length,
  totalPayloadFiles: report.fileCount, ignoredFiles: report.ignoredCount,
  excludedExamples: excludedExamples.length }));
