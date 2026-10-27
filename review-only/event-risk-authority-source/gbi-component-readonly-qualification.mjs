#!/usr/bin/env node
// Bounded read-only qualification. No dump, object archive, key or restore.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statfsSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { collectGbiReadOnly } from "./gbi-readonly-preflight.mjs";
import { PIN } from "./original-gbi-cold-controller.mjs";
import { MAX_ENCRYPTED_BYTES, MIN_INTERNAL_FREE_BYTES, STORAGE_METADATA_COPY_SQL,
  STORAGE_METADATA_PGOPTIONS } from "./component-backup-contract.mjs";

const dockerBin = "/opt/homebrew/bin/docker";
const dockerBase = ["-H", PIN.socket];
const ids = Object.fromEntries(PIN.stop);
const backupRoot = "/Users/danielderi/DigitalObserverRecovery/current-gbi";
const recipientManifest = "/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/colima-safety.gUVg5H/manifest.json";
const inventorySource = readFileSync(new URL("./storage-file-inventory-noatime.py", import.meta.url), "utf8");

function run(args, timeout = 15_000) {
  const started = performance.now();
  const stdout = execFileSync(dockerBin, [...dockerBase, ...args], { encoding: "utf8", timeout,
    maxBuffer: 4_000_000, stdio: ["ignore", "pipe", "pipe"] });
  return { stdout: stdout.trim(), durationMs: Math.round(performance.now() - started) };
}
function serverVersion() {
  const raw = run(["exec", "-u", "postgres", ids.db, "psql", "-X", "-A", "-t", "-U", "postgres",
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c",
    "BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; SHOW server_version; ROLLBACK;" ]);
  const value = raw.stdout.split(/\r?\n/).filter(line => !["BEGIN", "SET", "ROLLBACK"].includes(line)).join("\n");
  assert.match(value, /^17\./, "POSTGRES_MAJOR_CHANGED");
  return { version: value, durationMs: raw.durationMs };
}
function mountOptions() {
  const code = "import os; x=next((s for s in open('/proc/self/mountinfo').read().splitlines() if s.split(' ')[4]=='/mnt'),None); print(x.split(' ')[5] if x else 'MISSING')";
  const result = run(["exec", ids.storage, "python3", "-c", code]);
  assert.notEqual(result.stdout, "MISSING", "STORAGE_MOUNT_MISSING");
  return result.stdout;
}
function storageInventory() {
  const started = performance.now();
  const raw = run(["exec", "-e", "DO_STORAGE_ROOT=/mnt", ids.storage,
    "python3", "-c", inventorySource], 60_000);
  const parsed = JSON.parse(raw.stdout);
  assert.ok(Number.isSafeInteger(parsed.count) && parsed.count === parsed.files?.length,
    "STORAGE_INVENTORY_INVALID");
  assert.ok(Number.isSafeInteger(parsed.totalBytes) && parsed.totalBytes >= 0 &&
    parsed.totalBytes <= MAX_ENCRYPTED_BYTES, "STORAGE_INVENTORY_INVALID");
  assert.ok(parsed.files.every(item => /^[a-f0-9]{64}$/.test(item.pathDigest) &&
    /^[a-f0-9]{64}$/.test(item.sha256) && Number.isSafeInteger(item.bytes) && item.bytes >= 0),
  "STORAGE_INVENTORY_INVALID");
  return { fileCount: parsed.count, logicalBytes: parsed.totalBytes,
    opaqueManifestSha256: createHash("sha256").update(raw.stdout).digest("hex"),
    durationMs: Math.round(performance.now() - started) };
}
async function metadataCopy() {
  const started = performance.now();
  const child = spawn(dockerBin, [...dockerBase, "exec", "-u", "postgres", "-e",
    STORAGE_METADATA_PGOPTIONS, ids.db, "psql", "-X", "-q", "-A", "-t", "-U", "postgres",
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", STORAGE_METADATA_COPY_SQL],
  { stdio: ["ignore", "pipe", "pipe"] });
  let stderrBytes = 0;
  child.stderr.on("data", chunk => { stderrBytes += chunk.length; });
  const done = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolve() : reject(new Error("STORAGE_METADATA_COPY_FAILED")));
  });
  const timer = setTimeout(() => child.kill(), 15_000);
  let bytes = 0;
  let rows = 0;
  const hash = createHash("sha256");
  try {
    for await (const chunk of child.stdout) {
      bytes += chunk.length;
      if (bytes > 16 * 1024 ** 2) throw new Error("STORAGE_METADATA_SIZE_CAP");
      for (const byte of chunk) if (byte === 10) rows += 1;
      hash.update(chunk);
    }
    await done;
    assert.equal(stderrBytes, 0, "STORAGE_METADATA_WARNINGS_REQUIRE_REVIEW");
    return { rowCount: rows, outputBytes: bytes, digestSha256: hash.digest("hex"),
      durationMs: Math.round(performance.now() - started) };
  } catch (error) { child.kill(); done.catch(() => {}); throw error; }
  finally { clearTimeout(timer); }
}

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== "--read-only")
    throw new Error("READ_ONLY_FLAG_REQUIRED");
  const source = collectGbiReadOnly();
  assert.equal(source.status, "PINS_MATCH_NOT_GO", "SOURCE_PIN_MISMATCH");
  assert.equal(source.containers.length, 7);
  assert.equal(source.selectedVolumeCount, 2);
  const free = statfsSync(backupRoot);
  const freeBytes = Number(free.bavail) * Number(free.bsize);
  assert.ok(freeBytes >= MIN_INTERNAL_FREE_BYTES + MAX_ENCRYPTED_BYTES,
    "INSUFFICIENT_INTERNAL_RESERVE");
  const recipient = JSON.parse(readFileSync(recipientManifest, "utf8")).publicRecipient;
  assert.match(recipient, /^age1[023456789acdefghjklmnpqrstuvwxyz]+$/);
  assert.equal(createHash("sha256").update(recipient).digest("hex"), PIN.recipientSha256,
    "PUBLIC_RECIPIENT_MISMATCH");
  const postgres = serverVersion();
  const mount = mountOptions();
  // The source mount is rw,relatime. The inventory implementation opens every
  // file and directory O_NOATIME, checks access times and fails on unsupported
  // runtime/permissions before reporting PASS.
  const inventory = storageInventory();
  const metadata = await metadataCopy();
  const after = collectGbiReadOnly();
  assert.equal(after.status, "PINS_MATCH_NOT_GO", "SOURCE_PIN_CHANGED_DURING_QUALIFICATION");
  assert.equal(after.daemonId, source.daemonId, "SOURCE_DAEMON_CHANGED_DURING_QUALIFICATION");
  return { status: "READ_ONLY_COMMANDS_QUALIFIED_NOT_BACKUP", daemonId: source.daemonId,
    containers: 7, volumes: 2, sourcePinnedBeforeAfter: true,
    qaExcluded: source.excludedQaRunning && source.selectedMountOwnersMatch,
    postgres, recipientDigestMatches: true, internalFreeBytes: freeBytes,
    storageMountOptions: mount, inventory, metadata, sourceWritesRequested: 0,
    archivePerObjectHashesVerified: false, metadataObjectMappingVerified: false,
    crossStoreAtomicityVerified: false, actualCapture: false };
}

try { process.stdout.write(JSON.stringify(await main()) + "\n"); }
catch (error) {
  // No command stderr, object name, row or private material is echoed.
  const code = /^[A-Z][A-Z0-9_]{4,80}$/.test(error.message) ? error.message : "READ_ONLY_QUALIFICATION_FAILED";
  process.stdout.write(JSON.stringify({ status: "BLOCKED", reason: code, actualCapture: false }) + "\n");
  process.exitCode = 1;
}
