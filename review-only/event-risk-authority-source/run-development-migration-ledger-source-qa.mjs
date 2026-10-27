#!/usr/bin/env node
// Source-only reconciliation. Never connects to PostgreSQL or executes SQL.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const [snapshotPath, expectedSnapshotSha] = process.argv.slice(2);
assert.ok(snapshotPath && /^[0-9a-f]{64}$/.test(expectedSnapshotSha ?? ""), "supply snapshot path and approved SHA-256");
const hash = value => createHash("sha256").update(value).digest("hex");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const gitFile = (ref, path) => execFileSync("git", ["show", `${ref}:${path}`], { cwd: root, stdio: ["ignore", "pipe", "ignore"] });
const read = path => readFileSync(`${root}${path}`);
const rawSnapshot = readFileSync(snapshotPath);
assert.equal(hash(rawSnapshot), expectedSnapshotSha, "snapshot identity changed");
const snapshot = JSON.parse(rawSnapshot);
const manifest = JSON.parse(read("development/database/baselines/development-c0cf2de7-20260919-v1/provenance.json"));
const ledger = JSON.parse(read("DEVELOPMENT_MIGRATION_LEDGER.json")).migrations;
const integration = git("rev-parse", "origin/integration/development");
const expectedPath = /^supabase\/migrations\/(\d{14})_[a-z0-9_]+\.sql$/;
const seen = new Set();
function validateIdentity(file, version) {
  const match = file.match(expectedPath);
  assert.ok(match, `invalid migration filename: ${file}`);
  assert.equal(match[1], version, `version/path mismatch: ${file}`);
  assert.ok(!seen.has(version), `duplicate version: ${version}`);
  seen.add(version);
  const rows = ledger.filter(entry => entry.file === file && entry.version === version && entry.inIntegration === true);
  assert.equal(rows.length, 1, `missing/duplicate integration ledger row: ${file}`);
  return rows[0];
}
assert.equal(snapshot.length, 30, "unexpected post-baseline receipt count");
assert.equal(manifest.migrations.length, 227, "unexpected baseline inventory");
assert.equal(hash(read("development/database/baselines/development-c0cf2de7-20260919-v1/schema.sql")), manifest.schemaSha256);
for (const entry of manifest.migrations) {
  const ledgerRow = validateIdentity(entry.file, entry.version);
  assert.equal(hash(gitFile(manifest.sourceIntegrationSha, entry.file)), entry.sourceSha256, `${entry.file}: pinned baseline source drift`);
  assert.equal(hash(gitFile(integration, entry.file)), entry.sourceSha256, `${entry.file}: current integration source drift`);
  assert.equal(git("rev-parse", `${integration}:${entry.file}`), entry.gitBlob, `${entry.file}: blob drift`);
  assert.equal(ledgerRow.blob, entry.gitBlob, `${entry.file}: ledger blob drift`);
}
for (const receipt of snapshot) {
  const ledgerRow = validateIdentity(receipt.filename, receipt.version);
  assert.ok(/^[0-9a-f]{64}$/.test(receipt.schema_fingerprint), `${receipt.version}: missing fingerprint receipt`);
  assert.equal(hash(gitFile(receipt.source_commit, receipt.filename)), receipt.source_digest, `${receipt.version}: source commit drift`);
  assert.equal(hash(gitFile(integration, receipt.filename)), receipt.source_digest, `${receipt.version}: integration source drift`);
  assert.equal(hash(read(receipt.filename)), receipt.source_digest, `${receipt.version}: local source drift`);
  assert.equal(ledgerRow.developmentHistoryDigest, receipt.source_digest, `${receipt.version}: ledger history digest drift`);
  assert.equal(ledgerRow.developmentSchemaFingerprint, receipt.schema_fingerprint, `${receipt.version}: ledger fingerprint receipt drift`);
  assert.equal(ledgerRow.integrationCommit, receipt.source_commit, `${receipt.version}: integration commit drift`);
  assert.equal(ledgerRow.blob, git("rev-parse", `${integration}:${receipt.filename}`), `${receipt.version}: blob drift`);
  assert.equal(ledgerRow.developmentApplied, "YES", `${receipt.version}: ledger status drift`);
  execFileSync("git", ["merge-base", "--is-ancestor", receipt.source_commit, integration], { cwd: root, stdio: "ignore" });
}
assert.equal(seen.size, 257, "baseline + post-baseline coverage mismatch");
const tracked = git("ls-tree", "-r", "--name-only", integration, "supabase/migrations").split("\n").filter(path => path.endsWith(".sql"));
assert.equal(tracked.length, 257, "integration migration inventory changed");
assert.deepEqual(new Set(tracked), new Set([...manifest.migrations.map(x => x.file), ...snapshot.map(x => x.filename)]));
console.log(JSON.stringify({ status: "PASS_SOURCE_ONLY", integration, baseline: 227, postBaseline: 30, total: 257, snapshotSha256: expectedSnapshotSha, liveSchemaVerified: false, sqlExecuted: false }));
