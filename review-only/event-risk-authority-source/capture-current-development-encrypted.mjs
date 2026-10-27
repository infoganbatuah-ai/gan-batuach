#!/usr/bin/env node
// Component-only Development capture. No common DB/Storage snapshot is claimed.
// Operator must independently verify the owner-held age identity before a real run.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { createReadStream, lstatSync, mkdtempSync, readFileSync, statfsSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { acquireCaptureLock, createComponentReceipt, compareStorageObservations, removeOwnedNewFile,
  MAX_ENCRYPTED_BYTES, MIN_INTERNAL_FREE_BYTES, STORAGE_METADATA_COPY_SQL,
  STORAGE_METADATA_PGOPTIONS } from "./component-backup-contract.mjs";
import { writeBoundedCiphertext } from "./bounded-ciphertext-writer.mjs";

const dockerBin = "/opt/homebrew/bin/docker";
const ageBin = "/opt/homebrew/bin/age";
const socket = "unix:///Volumes/DIGITAL_OBSERVER/Development/gan-batuach/colima/gbi/docker.sock";
const dockerBase = ["-H", socket];
const db = "supabase_db_gan-batuach-integration";
const storage = "supabase_storage_gan-batuach-integration";
const pgImage = "public.ecr.aws/supabase/postgres:17.6.1.167";
const pgImageId = "sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb";
const dbId = "7c30223f1a6f2b7be78e85d2ba44a5eeccb0704a3113f36c03bb8e6f84744d0a";
const backupRoot = "/Users/danielderi/DigitalObserverRecovery/current-gbi";
const recipientManifest = "/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/colima-safety.gUVg5H/manifest.json";
const expectedRecipientDigest = "1fc9645eff132753e75a26eb0856b6f9abe0a26af6002625346832a8a89d97b4";
const expectedDatabases = ["_supabase", "gan_batuach_baseline_builder_v2", "postgres"];
const writers = ["supabase_kong_gan-batuach-integration", "supabase_auth_gan-batuach-integration",
  "supabase_rest_gan-batuach-integration", "supabase_realtime_gan-batuach-integration",
  "supabase_storage_gan-batuach-integration", "supabase_inbucket_gan-batuach-integration"];
const inventorySource = readFileSync(new URL("./storage-file-inventory-noatime.py", import.meta.url), "utf8");
const receipt = createComponentReceipt({ expectedDatabases });
const controller = new AbortController();
const deadlineAt = Date.now() + 180_000;
let directory = null;
let active = null;
let postgresVersion = null;
let captureLock = null;

function remainingMs() {
  if (controller.signal.aborted || Date.now() >= deadlineAt) throw new Error("CAPTURE_DEADLINE_EXCEEDED");
  return deadlineAt - Date.now();
}
function exec(bin, args, timeout = 15_000) {
  return execFileSync(bin, args, { encoding: "utf8", timeout: Math.min(timeout, remainingMs()), maxBuffer: 4_000_000,
    stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function docker(args, timeout) { return exec(dockerBin, [...dockerBase, ...args], timeout); }
function freeBytes() {
  const fs = statfsSync(backupRoot);
  return Number(fs.bavail) * Number(fs.bsize);
}
function query(sql) {
  return docker(["exec", "-u", "postgres", db, "psql", "-X", "-A", "-t", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-c", `BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; ${sql}; ROLLBACK;`])
    .split(/\r?\n/).filter(line => !["BEGIN", "SET", "ROLLBACK"].includes(line)).join("\n");
}
function inspect(name) { return JSON.parse(docker(["inspect", name]))[0]; }
function assertSource() {
  const root = lstatSync(backupRoot);
  assert.ok(root.isDirectory() && root.uid === process.getuid() && (root.mode & 0o077) === 0,
    "BACKUP_DIRECTORY_NOT_PRIVATE");
  assert.ok(freeBytes() >= MIN_INTERNAL_FREE_BYTES + MAX_ENCRYPTED_BYTES, "INSUFFICIENT_INTERNAL_RESERVE");
  const original = inspect(db);
  const objects = inspect(storage);
  assert.equal(original.Id, dbId, "DEVELOPMENT_DB_ID_CHANGED");
  assert.equal(original.Config.Image, pgImage, "DEVELOPMENT_DB_IMAGE_CHANGED");
  assert.equal(original.Config.Labels["com.docker.compose.project"], "gan-batuach-integration");
  assert.equal(objects.Config.Labels["com.docker.compose.project"], "gan-batuach-integration");
  assert.ok(original.State.Running && objects.State.Running, "SOURCE_NOT_RUNNING");
  assert.ok(original.Mounts.some(m => m.Name === db && m.Destination === "/var/lib/postgresql/data"));
  assert.ok(objects.Mounts.some(m => m.Name === storage && m.Destination === "/mnt"));
  assert.equal(original.NetworkSettings.Ports["5432/tcp"]?.[0]?.HostIp, "127.0.0.1");
  assert.equal(original.NetworkSettings.Ports["5432/tcp"]?.[0]?.HostPort, "55422");
  assert.ok(!Object.values(objects.NetworkSettings.Ports ?? {}).some(value => Array.isArray(value) && value.length),
    "STORAGE_HAS_PUBLISHED_PORT");
  assert.equal(docker(["image", "inspect", pgImage, "--format", "{{.Id}}"]), pgImageId);
  assert.deepEqual(query("SELECT datname FROM pg_database WHERE datallowconn AND NOT datistemplate ORDER BY datname")
    .split("\n"), expectedDatabases, "DEVELOPMENT_DATABASE_SET_CHANGED");
  const activeNames = docker(["ps", "--filter", "label=com.docker.compose.project=gan-batuach-integration",
    "--format", "{{.Names}}"] ).split("\n").filter(Boolean).sort();
  assert.deepEqual(activeNames, [db, ...writers].sort(), "UNEXPECTED_DEVELOPMENT_SERVICE_SET");
  postgresVersion = query("SHOW server_version");
  assert.match(postgresVersion, /^17\./, "POSTGRES_MAJOR_CHANGED");
  const recipient = JSON.parse(readFileSync(recipientManifest, "utf8")).publicRecipient;
  assert.match(recipient, /^age1[023456789acdefghjklmnpqrstuvwxyz]+$/);
  assert.equal(createHash("sha256").update(recipient).digest("hex"), expectedRecipientDigest,
    "AGE_RECIPIENT_CHANGED");
  return recipient;
}
function completion(child, reason) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolve() : reject(new Error(reason)));
  });
}
function stderrBytes(child) {
  let bytes = 0;
  child.stderr.on("data", chunk => { bytes += chunk.length; });
  return () => bytes;
}
async function fileDigest(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path, { signal: controller.signal })) hash.update(chunk);
  return hash.digest("hex");
}
async function capture(name, sourceArgs, recipient) {
  remainingMs();
  assert.ok(receipt.remainingBytes > 0, "CUMULATIVE_CIPHERTEXT_CAP_EXCEEDED");
  const path = join(directory, `${name}.age`);
  const source = spawn(dockerBin, [...dockerBase, ...sourceArgs], { stdio: ["ignore", "pipe", "pipe"] });
  const age = spawn(ageBin, ["-r", recipient], { stdio: ["pipe", "pipe", "pipe"] });
  const sourceWarnings = stderrBytes(source);
  const ageWarnings = stderrBytes(age);
  const sourceDone = completion(source, "SOURCE_CAPTURE_FAILED");
  const ageDone = completion(age, "AGE_ENCRYPTION_FAILED");
  source.stdout.pipe(age.stdin);
  age.stdin.on("error", () => {});
  active = { source, age };
  const startedAtUtc = new Date().toISOString();
  let newCiphertextInode = null;
  try {
    const { bytes } = await writeBoundedCiphertext({
      ciphertext: age.stdout, outputPath: path, maxBytes: receipt.remainingBytes,
      minFreeBytes: MIN_INTERNAL_FREE_BYTES, freeBytes,
      upstreamCompletion: Promise.all([sourceDone, ageDone]), signal: controller.signal,
      abortUpstream: () => { source.kill(); age.kill(); },
    });
    newCiphertextInode = lstatSync(path).ino;
    assert.equal(sourceWarnings(), 0, "SOURCE_WARNINGS_REQUIRE_REVIEW");
    assert.equal(ageWarnings(), 0, "AGE_WARNINGS_REQUIRE_REVIEW");
    const handle = await import("node:fs/promises").then(fs => fs.open(path, "r"));
    const header = Buffer.alloc(32);
    try { await handle.read(header, 0, header.length, 0); } finally { await handle.close(); }
    assert.ok(header.toString("utf8").startsWith("age-encryption.org/v1"), "NOT_AGE_FORMAT");
    assert.equal(statSync(path).size, bytes, "CIPHERTEXT_FILE_SIZE_CHANGED");
    return { file: `${name}.age`, outputInode: newCiphertextInode,
      bytes, ciphertextSha256: await fileDigest(path),
      startedAtUtc, endedAtUtc: new Date().toISOString() };
  } catch (error) {
    // The writer removes its own partial file. Only a successful exclusive
    // creation can be removed by this later validation path.
    if (newCiphertextInode) removeOwnedNewFile(path, newCiphertextInode);
    throw error;
  } finally { active = null; }
}
async function metadataDigest() {
  remainingMs();
  const source = spawn(dockerBin, [...dockerBase, "exec", "-u", "postgres",
    "-e", STORAGE_METADATA_PGOPTIONS, db,
    "psql", "-X", "-q", "-A", "-t", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-c", STORAGE_METADATA_COPY_SQL], { stdio: ["ignore", "pipe", "pipe"] });
  const warnings = stderrBytes(source);
  const done = completion(source, "STORAGE_METADATA_READ_FAILED");
  const onAbort = () => source.kill();
  controller.signal.addEventListener("abort", onAbort, { once: true });
  const hash = createHash("sha256");
  let rows = 0;
  let bytes = 0;
  try {
    for await (const chunk of source.stdout) {
      bytes += chunk.length;
      if (bytes > 16 * 1024 ** 2) throw new Error("STORAGE_METADATA_SIZE_CAP");
      for (const byte of chunk) if (byte === 10) rows += 1;
      hash.update(chunk);
    }
    await done;
    assert.equal(warnings(), 0, "STORAGE_METADATA_WARNINGS_REQUIRE_REVIEW");
    return { metadataDigest: hash.digest("hex"), metadataRows: rows, metadataBytes: bytes };
  } catch (error) { source.kill(); done.catch(() => {}); throw error; }
  finally { controller.signal.removeEventListener("abort", onAbort); }
}
function storageInventory() {
  const raw = docker(["exec", "-e", "DO_STORAGE_ROOT=/mnt", storage,
    "python3", "-c", inventorySource], 60_000);
  const result = JSON.parse(raw);
  assert.ok(Number.isSafeInteger(result.count) && result.count === result.files?.length,
    "STORAGE_INVENTORY_INVALID");
  assert.ok(Number.isSafeInteger(result.totalBytes) && result.totalBytes >= 0,
    "STORAGE_INVENTORY_INVALID");
  for (const file of result.files) {
    assert.match(file.pathDigest, /^[a-f0-9]{64}$/);
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
  }
  return result;
}
async function observeStorage() { return { ...await metadataDigest(), ...storageInventory() }; }
function safeReason(error) {
  const message = String(error?.message ?? "");
  return /^[A-Z][A-Z0-9_]{4,80}$/.test(message) ? message : "CAPTURE_OR_PREFLIGHT_FAILED";
}
async function runComponent(kind, name, sourceArgs, recipient, details = {}) {
  const startedAtUtc = new Date().toISOString();
  let result;
  try {
    result = await capture(name ?? kind, sourceArgs, recipient);
    receipt.addSuccess({ kind, name, ...result, details });
  } catch (error) {
    if (result) removeOwnedNewFile(join(directory, result.file), result.outputInode);
    receipt.addFailure({ kind, name, reason: safeReason(error), startedAtUtc,
      endedAtUtc: new Date().toISOString() });
    throw error;
  }
}
async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== "--capture-components-only")
    throw new Error("EXPLICIT_COMPONENT_ONLY_MODE_REQUIRED");
  remainingMs();
  const recipient = assertSource();
  captureLock = acquireCaptureLock(join(backupRoot, ".component-capture.lock"));
  directory = mkdtempSync(join(backupRoot, "snapshot-"));
  for (const name of expectedDatabases) await runComponent("database", name,
    ["exec", "-u", "postgres", db, "pg_dump", "-U", "postgres", "-Fc", "-d", name],
    recipient, { sourceContainerId: dbId, postgresVersion });
  await runComponent("globals", null,
    ["exec", "-u", "postgres", db, "pg_dumpall", "-U", "postgres", "--globals-only"],
    recipient, { sourceContainerId: dbId, postgresVersion });
  const storageBefore = await observeStorage();
  const storageStartedAtUtc = new Date().toISOString();
  let storageResult;
  try {
    storageResult = await capture("storage-bytes", ["exec", storage, "/bin/tar", "-C", "/mnt", "-cf", "-", "."], recipient);
    const storageAfter = await observeStorage();
    const exceptions = compareStorageObservations(storageBefore, storageAfter);
    if (exceptions.length) {
      receipt.addFailure({ kind: "storage-bytes", reason: exceptions.join("+"),
        startedAtUtc: storageStartedAtUtc, endedAtUtc: new Date().toISOString() });
      throw new Error("STORAGE_SOURCE_CHANGED_DURING_CAPTURE");
    }
    receipt.addSuccess({ kind: "storage-bytes", ...storageResult,
      details: { sourceContainer: storage, metadataRows: storageAfter.metadataRows,
        metadataDigest: storageAfter.metadataDigest, metadataBytes: storageAfter.metadataBytes,
        fileCount: storageAfter.count, logicalFileBytes: storageAfter.totalBytes,
        sampledSourceFileManifest: storageAfter.files, metadataObjectMapping: "NOT_PROVEN",
        archivedPerObjectHashVerification: "NOT_PROVEN", crossStoreAtomicity: "NOT_PROVEN" } });
  } catch (error) {
    if (storageResult) removeOwnedNewFile(join(directory, storageResult.file), storageResult.outputInode);
    if (!receipt.receipt().components.some(item => item.id === "storage-bytes"))
      receipt.addFailure({ kind: "storage-bytes", reason: safeReason(error),
        startedAtUtc: storageStartedAtUtc, endedAtUtc: new Date().toISOString() });
    throw error;
  }
}

const timeout = setTimeout(() => controller.abort(new Error("CAPTURE_DEADLINE_EXCEEDED")), 180_000);
let failure = null;
try { await main(); } catch (error) { failure = safeReason(error); }
finally {
  clearTimeout(timeout);
  active?.source.kill();
  active?.age.kill();
  if (captureLock) {
    try { captureLock.release(); } catch { failure = "CAPTURE_LOCK_CLEANUP_FAILED"; }
  }
  const result = receipt.receipt({ scope: "original-isolated-development", createdAtUtc: new Date().toISOString(),
    sourceContainerId: dbId, sourceImageId: pgImageId, postgresVersion,
    publicRecipientSha256: expectedRecipientDigest,
    storageMetadataObjectMapping: "NOT_PROVEN", crossStoreAtomicity: "NOT_PROVEN",
    independentRestore: "NOT_RUN", reason: failure });
  if (directory) {
    try { writeFileSync(join(directory, "receipt.json"), JSON.stringify(result, null, 2) + "\n",
      { mode: 0o600, flag: "wx" }); }
    catch { failure = "RECEIPT_WRITE_FAILED"; }
  }
  console.log(JSON.stringify({ status: failure ? "BLOCKED" : result.status, reason: failure, backupDirectory: directory,
    componentCount: result.components.length, encryptedBytes: result.totalEncryptedBytes,
    atomicSnapshot: false, independentRestore: "NOT_RUN" }));
  if (result.status !== "COMPONENT_BACKUPS_ONLY" || failure) process.exitCode = 1;
}
