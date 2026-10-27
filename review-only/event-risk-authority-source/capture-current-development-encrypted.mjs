#!/usr/bin/env node
// One bounded, encrypted-only Development capture. Never invoke for Production.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { closeSync, createReadStream, createWriteStream, existsSync, mkdtempSync, openSync, readFileSync, readSync, rmSync, statSync, statfsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

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
const maxEncryptedBytes = 1024 ** 3;
const minInternalFreeBytes = 3 * 1024 ** 3;
const expectedDatabases = ["_supabase", "gan_batuach_baseline_builder_v2", "postgres"];
const writers = ["supabase_kong_gan-batuach-integration", "supabase_auth_gan-batuach-integration",
  "supabase_rest_gan-batuach-integration", "supabase_realtime_gan-batuach-integration",
  "supabase_storage_gan-batuach-integration", "supabase_inbucket_gan-batuach-integration"];
let directory = null;
let totalEncryptedBytes = 0;
let activeSource = null;
let activeAge = null;
const files = [];
const evidence = { status: "BLOCKED", reason: null, source: db, storage,
  databases: 0, encryptedBytes: 0, encryptedFiles: 0, stableSourceWindow: false,
  walUnchanged: false, storageUnchanged: false, backupDirectory: null };

function safeExec(bin, args, timeout = 15000) {
  return execFileSync(bin, args, { encoding: "utf8", timeout, maxBuffer: 4_000_000, stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function docker(args, timeout) { return safeExec(dockerBin, [...dockerBase, ...args], timeout); }
function freeBytes() {
  const s = statfsSync("/System/Volumes/Data");
  return s.bavail * s.bsize;
}
function query(sql) {
  return docker(["exec", "-u", "postgres", db, "psql", "-X", "-A", "-t", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-c", `BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; ${sql}; ROLLBACK;`], 15000)
    .split(/\r?\n/).filter(line => !["BEGIN", "SET", "ROLLBACK"].includes(line)).join("\n");
}
function inspect(name) { return JSON.parse(docker(["inspect", name]))[0]; }
async function storageDigest() {
  const source = spawn(dockerBin, [...dockerBase, "exec", storage, "/bin/tar", "-C", "/mnt", "-cf", "-", "."],
    { stdio: ["ignore", "pipe", "pipe"] });
  const exit = new Promise((resolve, reject) => {
    source.once("error", reject);
    source.once("close", resolve);
  });
  source.stderr.resume();
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of source.stdout) { bytes += chunk.length; hash.update(chunk); }
  const code = await exit;
  assert.equal(code, 0, "STORAGE_DIGEST_SOURCE_FAILED");
  return { hash: hash.digest("hex"), bytes };
}
function noActiveWriters() {
  return query("SELECT count(*) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND state='active' AND backend_type='client backend'") === "0";
}
function assertSource() {
  assert.ok(statSync(backupRoot).isDirectory());
  assert.equal(statSync(backupRoot).mode & 0o077, 0, "BACKUP_DIRECTORY_NOT_PRIVATE");
  assert.ok(freeBytes() > minInternalFreeBytes + maxEncryptedBytes, "INSUFFICIENT_INTERNAL_RESERVE");
  const original = inspect(db);
  const objects = inspect(storage);
  assert.equal(original.Id, dbId, "DEVELOPMENT_DB_ID_CHANGED");
  assert.equal(original.Config.Image, pgImage);
  assert.equal(original.Config.Labels["com.docker.compose.project"], "gan-batuach-integration");
  assert.equal(objects.Config.Labels["com.docker.compose.project"], "gan-batuach-integration");
  assert.ok(original.State.Running && objects.State.Running);
  assert.ok(original.Mounts.some(m => m.Name === db && m.Destination === "/var/lib/postgresql/data"));
  assert.ok(objects.Mounts.some(m => m.Name === storage && m.Destination === "/mnt"));
  assert.equal(original.NetworkSettings.Ports["5432/tcp"]?.[0]?.HostIp, "127.0.0.1");
  assert.equal(original.NetworkSettings.Ports["5432/tcp"]?.[0]?.HostPort, "55422");
  assert.ok(!Object.values(objects.NetworkSettings.Ports ?? {}).some(value => Array.isArray(value) && value.length),
    "STORAGE_HAS_PUBLISHED_PORT");
  assert.equal(docker(["image", "inspect", pgImage, "--format", "{{.Id}}"]).trim(), pgImageId);
  const names = query("SELECT datname FROM pg_database WHERE datallowconn AND NOT datistemplate ORDER BY datname").split("\n");
  assert.deepEqual(names, expectedDatabases, "DEVELOPMENT_DATABASE_SET_CHANGED");
  evidence.databases = names.length;
  const publicRecipient = JSON.parse(readFileSync(recipientManifest, "utf8")).publicRecipient;
  assert.match(publicRecipient, /^age1[023456789acdefghjklmnpqrstuvwxyz]+$/);
  assert.equal(createHash("sha256").update(publicRecipient).digest("hex"), expectedRecipientDigest);
  const active = docker(["ps", "--filter", "label=com.docker.compose.project=gan-batuach-integration", "--format", "{{.Names}}"]).split("\n").filter(Boolean).sort();
  assert.deepEqual(active, [db, ...writers].sort(), "UNEXPECTED_DEVELOPMENT_SERVICE_SET");
  assert.equal(query("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relpersistence='u' AND c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema')"), "0", "UNLOGGED_RELATIONS_PREVENT_WAL_STABILITY_PROOF");
  return publicRecipient;
}
async function capture(name, sourceArgs, recipient) {
  const target = join(directory, `${name}.age`);
  const source = spawn(dockerBin, [...dockerBase, ...sourceArgs], { stdio: ["ignore", "pipe", "pipe"] });
  const age = spawn(ageBin, ["-r", recipient], { stdio: ["pipe", "pipe", "pipe"] });
  activeSource = source;
  activeAge = age;
  source.stderr.resume();
  age.stderr.resume();
  source.stdout.pipe(age.stdin);
  age.stdin.on("error", () => {});
  const exited = child => new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", code => resolve(code));
  });
  const sourceExit = exited(source);
  const ageExit = exited(age);
  const guard = new Transform({ transform(chunk, _encoding, callback) {
    totalEncryptedBytes += chunk.length;
    if (totalEncryptedBytes > maxEncryptedBytes) return callback(new Error("ENCRYPTED_BYTE_CAP_EXCEEDED"));
    if (freeBytes() < minInternalFreeBytes) return callback(new Error("INTERNAL_FREE_FLOOR_BREACHED"));
    callback(null, chunk);
  } });
  try {
    await pipeline(age.stdout, guard, createWriteStream(target, { flags: "wx", mode: 0o600 }));
    assert.equal(await sourceExit, 0, "SOURCE_CAPTURE_FAILED");
    assert.equal(await ageExit, 0, "AGE_ENCRYPTION_FAILED");
    const size = statSync(target).size;
    assert.ok(size > 0);
    const fd = openSync(target, "r");
    const header = Buffer.alloc(32);
    try { readSync(fd, header, 0, header.length, 0); } finally { closeSync(fd); }
    const first = header.toString("utf8");
    assert.ok(first.startsWith("age-encryption.org/v1"), "NOT_AGE_FORMAT");
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(target)) hash.update(chunk);
    files.push({ name: `${name}.age`, bytes: size, sha256: hash.digest("hex") });
  } catch (error) {
    source.kill(); age.kill();
    throw error;
  } finally {
    activeSource = null; activeAge = null;
  }
}
const deadline = setTimeout(() => { activeSource?.kill(); activeAge?.kill(); }, 180_000);
try {
  const recipient = assertSource();
  assert.ok(noActiveWriters(), "ACTIVE_DATABASE_CLIENT_AT_PREFLIGHT");
  const walBefore = query("SELECT pg_current_wal_lsn()");
  const storageBefore = await storageDigest();
  await new Promise(resolve => setTimeout(resolve, 2000));
  assert.equal(query("SELECT pg_current_wal_lsn()"), walBefore, "SOURCE_WAL_MOVED_BEFORE_CAPTURE");
  assert.deepEqual(await storageDigest(), storageBefore, "STORAGE_MOVED_BEFORE_CAPTURE");
  assert.ok(noActiveWriters(), "ACTIVE_DATABASE_CLIENT_BEFORE_CAPTURE");
  directory = mkdtempSync(join(backupRoot, "snapshot-"));
  evidence.backupDirectory = directory;
  for (const name of expectedDatabases) {
    await capture(`db-${name}`, ["exec", "-u", "postgres", db, "pg_dump", "-U", "postgres", "-Fc", "-d", name], recipient);
  }
  await capture("cluster-globals", ["exec", "-u", "postgres", db, "pg_dumpall", "-U", "postgres", "--globals-only"], recipient);
  await capture("storage-bytes", ["exec", storage, "/bin/tar", "-C", "/mnt", "-cf", "-", "."], recipient);
  evidence.walUnchanged = query("SELECT pg_current_wal_lsn()") === walBefore;
  evidence.storageUnchanged = JSON.stringify(await storageDigest()) === JSON.stringify(storageBefore);
  assert.ok(evidence.walUnchanged, "SOURCE_WAL_CHANGED_DURING_CAPTURE");
  assert.ok(evidence.storageUnchanged, "SOURCE_STORAGE_CHANGED_DURING_CAPTURE");
  assert.ok(noActiveWriters(), "ACTIVE_DATABASE_CLIENT_AFTER_CAPTURE");
  evidence.stableSourceWindow = true;
  assert.ok(freeBytes() >= minInternalFreeBytes, "INTERNAL_FREE_FLOOR_BREACHED_AT_END");
  const manifest = { scope: "isolated-development-only", createdAtUtc: new Date().toISOString(),
    sourceContainerId: dbId, sourceImageId: pgImageId, publicRecipientSha256: expectedRecipientDigest,
    databaseCount: expectedDatabases.length, files, totalEncryptedBytes };
  writeFileSync(join(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  evidence.encryptedBytes = totalEncryptedBytes;
  evidence.encryptedFiles = files.length;
  evidence.status = "ENCRYPTED_CAPTURE_PASS_RESTORE_NOT_RUN";
} catch (error) {
  evidence.reason = error instanceof assert.AssertionError ? String(error.message).split("\n")[0].slice(0, 100)
    : "CAPTURE_PREFLIGHT_OR_STREAM_FAILED_REVIEW_LOCAL_DIAGNOSTIC";
} finally {
  clearTimeout(deadline);
  activeSource?.kill(); activeAge?.kill();
  if (evidence.reason) {
    evidence.status = "BLOCKED";
    if (directory?.startsWith(`${backupRoot}/snapshot-`) && existsSync(directory)) rmSync(directory, { recursive: true });
    evidence.backupDirectory = null;
  }
  console.log(JSON.stringify(evidence));
  if (evidence.status !== "ENCRYPTED_CAPTURE_PASS_RESTORE_NOT_RUN") process.exitCode = 1;
}
