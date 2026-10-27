#!/usr/bin/env node
// Disposable, synthetic-only cold-backup rehearsal. No source data or owner key.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, statfsSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { writeBoundedCiphertext } from "./bounded-ciphertext-writer.mjs";

const worktree = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const prefix = join(worktree, ".cold-backup-qa.");
const scratch = mkdtempSync(prefix);
const cipherDir = mkdtempSync("/private/tmp/do-cold-cipher-qa.");
const cipher = join(cipherDir, "synthetic-volumes.tar.age");
const base = "/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/cache/caches/b0992ab88f5a3c0c436bbb3065c01466f20dc1dd0eb0a60299d410176f21a1c3";
const sourceSocket = "unix:///Volumes/DIGITAL_OBSERVER/Development/gan-batuach/colima/gbi/docker.sock";
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const imageId = "sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb";
const limit = 1024 ** 3;
const floor = 3 * 1024 ** 3;
const passphrase = randomBytes(48).toString("base64url");
const evidence = { status: "FAIL", reason: null, syntheticOnly: true, sourceGbiTouched: false,
  sevenIds: false, stoppedInDependencyOrder: false, noWritersAtExport: false,
  encryptedArchiveVerified: false, ciphertextBytes: null, ciphertextSha256: null,
  internalFreeFloorBytes: floor, minimumObservedInternalFreeBytes: null,
  daemonUnavailableObserved: false, exactIdsRestartedAfterDaemonRecovery: false,
  sourceDataAfterRestart: false, separateEncryptedRestore: false,
  postgresRestore: false, storageRestore: false, cleanup: false };
const contexts = ["source", "restore"].map((kind, index) => ({
  kind, guest: `cold-qa-${process.pid}-${index}`, image: join(scratch, `${kind}.sparsebundle`),
  mount: mkdtempSync(`/private/tmp/do-cold-${kind}-qa.`), attached: false, started: false,
  home: null, ids: [], volumes: [],
}));
let keyPath = null;

function run(bin, args, { env, input, timeout = 30000, allowFailure = false } = {}) {
  const result = spawnSync(bin, args, { env: { ...process.env, ...env }, input,
    encoding: "utf8", timeout, maxBuffer: 2_000_000 });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure)
    throw new Error(`${bin.split("/").at(-1)} failed (${result.status}): ${result.stderr.trim().slice(0, 300)}`);
  return result;
}
function envFor(c) { return { LIMA_HOME: c.home }; }
function guest(c, args, timeout = 30000, allowFailure = false) {
  return run("/opt/homebrew/bin/limactl", ["shell", "--tty=false", c.guest, "--", ...args],
    { env: envFor(c), timeout, allowFailure });
}
function docker(c, args, timeout = 30000, allowFailure = false) {
  return guest(c, ["sudo", "docker", ...args], timeout, allowFailure);
}
function freeBytes() {
  const s = statfsSync(dirname(cipher));
  const free = Number(s.bavail) * Number(s.bsize);
  evidence.minimumObservedInternalFreeBytes = Math.min(evidence.minimumObservedInternalFreeBytes ?? free, free);
  if (free < floor) throw new Error("INTERNAL_FREE_FLOOR_BREACHED");
  return free;
}
async function waitFor(fn, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try { if (fn()) return true; } catch { /* service may still be starting */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return false;
}
function setup(c) {
  run("/usr/bin/hdiutil", ["create", "-size", "8g", "-type", "SPARSEBUNDLE", "-encryption", "AES-256",
    "-stdinpass", "-fs", "APFS", "-volname", `DO_COLD_${c.kind.toUpperCase()}_QA`, "-nospotlight", c.image],
  { input: `${passphrase}\n`, timeout: 120000 });
  run("/usr/bin/hdiutil", ["attach", "-nobrowse", "-owners", "on", "-stdinpass", "-mountpoint", c.mount, c.image],
    { input: `${passphrase}\n`, timeout: 120000 });
  c.attached = true;
  const info = run("/usr/bin/hdiutil", ["info"]).stdout;
  const entry = info.slice(info.indexOf(c.image));
  assert.ok(info.includes(c.image) && /^image-encrypted\s*:\s*(true|yes)/im.test(entry), "ENCRYPTED_VOLUME_UNVERIFIED");
  c.home = join(c.mount, "lima");
  mkdirSync(c.home, { mode: 0o700 });
  const config = join(c.mount, "lima.yaml");
  writeFileSync(config, `vmType: vz\narch: aarch64\nimages:\n  - location: ${base}\n    arch: aarch64\ncpus: 2\nmemory: 2GiB\ndisk: 6GiB\nmounts: []\nnetworks: []\nportForwards: []\npropagateProxyEnv: false\ncontainerd:\n  system: false\n  user: false\nssh:\n  loadDotSSHPubKeys: false\n  forwardAgent: false\nhostResolver:\n  enabled: false\nprovision: []\n`,
    { mode: 0o600, flag: "wx" });
  run("/opt/homebrew/bin/limactl", ["validate", config], { env: envFor(c) });
  run("/opt/homebrew/bin/limactl", ["start", "--tty=false", "--name", c.guest,
    "--plain", "--mount-none", "--containerd", "none", config], { env: envFor(c), timeout: 180000 });
  c.started = true;
  assert.ok(readdirSync(join(c.home, c.guest)).some(name => /disk/i.test(name)), "GUEST_DISK_NOT_ENCRYPTED");
  assert.equal(guest(c, ["sh", "-lc", "mount | grep -c virtiofs || true"]).stdout.trim(), "0", "HOST_MOUNT_PRESENT");
  assert.equal(guest(c, ["sh", "-lc", "env | cut -d= -f1 | grep -Eic '^(http_proxy|https_proxy|all_proxy|no_proxy)$' || true"]).stdout.trim(), "0", "PROXY_ENV_PRESENT");
  guest(c, ["sudo", "test", "!", "-e", "/etc/docker/daemon.json"]);
  const daemonConfig = join(c.mount, "daemon.json");
  writeFileSync(daemonConfig, '{"iptables":false,"ip6tables":false,"bridge":"none"}\n', { mode: 0o600, flag: "wx" });
  run("/opt/homebrew/bin/limactl", ["copy", "--backend=scp", daemonConfig,
    `${c.guest}:/tmp/do-cold-daemon.json`], { env: envFor(c) });
  guest(c, ["sudo", "install", "-o", "root", "-g", "root", "-m", "0644",
    "/tmp/do-cold-daemon.json", "/etc/docker/daemon.json"]);
  guest(c, ["sudo", "systemctl", "start", "docker"]);
  const ssh = guest(c, ["sh", "-lc", "printf '%s' \"$SSH_CONNECTION\""]).stdout.trim().split(/\s+/);
  assert.equal(ssh.length, 4, "MANAGEMENT_PEER_UNKNOWN");
  assert.match(ssh[0], /^(?:\d{1,3}\.){3}\d{1,3}$/);
  assert.match(ssh[3], /^\d{1,5}$/);
  guest(c, ["sudo", "iptables", "-A", "OUTPUT", "-o", "lo", "-j", "ACCEPT"]);
  guest(c, ["sudo", "ip6tables", "-A", "OUTPUT", "-o", "lo", "-j", "ACCEPT"]);
  guest(c, ["sudo", "iptables", "-A", "OUTPUT", "-d", `${ssh[0]}/32`, "-p", "tcp",
    "--sport", ssh[3], "-m", "conntrack", "--ctstate", "ESTABLISHED", "-j", "ACCEPT"]);
  for (const family of ["iptables", "ip6tables"]) {
    guest(c, ["sudo", family, "-I", "FORWARD", "1", "-j", "DROP"]);
    guest(c, ["sudo", family, "-P", "OUTPUT", "DROP"]);
  }
  assert.equal(guest(c, ["sudo", "iptables", "-S", "OUTPUT"]).stdout.split("\n")[0], "-P OUTPUT DROP", "EGRESS_NOT_CLOSED");
  assert.equal(guest(c, ["sudo", "ip6tables", "-S", "OUTPUT"]).stdout.split("\n")[0], "-P OUTPUT DROP", "IPV6_EGRESS_NOT_CLOSED");
  assert.equal(docker(c, ["volume", "ls", "--format", "{{.Name}}"]).stdout.trim(), "", "UNEXPECTED_VOLUME");
}
function loadImage(c, archive) {
  run("/opt/homebrew/bin/limactl", ["copy", "--backend=scp", archive,
    `${c.guest}:/tmp/do-cold-image.tar`], { env: envFor(c), timeout: 120000 });
  docker(c, ["image", "load", "-i", "/tmp/do-cold-image.tar"], 120000);
  guest(c, ["rm", "-f", "/tmp/do-cold-image.tar"]);
  assert.equal(docker(c, ["image", "inspect", image, "--format", "{{.Id}}"]).stdout.trim(), imageId);
}
function startPg(c, existing = false) {
  const init = existing ? "" : "if [ ! -s /var/lib/postgresql/data/PG_VERSION ]; then initdb -D /var/lib/postgresql/data -A trust --no-instructions >/dev/null; fi; ";
  const id = docker(c, ["run", "--detach", "--network", "none", "--pull", "never",
    "--restart", "no", "--name", `qa-pg-${c.kind}`, "--read-only",
    "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m", "--user", "postgres",
    "--volume", "qa_pgdata:/var/lib/postgresql/data", "--entrypoint", "/bin/sh", image,
    "-ec", `${init}exec postgres -D /var/lib/postgresql/data -c listen_addresses= -c unix_socket_directories=/tmp`], 60000).stdout.trim();
  assert.match(id, /^[0-9a-f]{64}$/);
  c.ids.push(id);
  return id;
}
function pgReady(c, id) {
  return docker(c, ["exec", id, "pg_isready", "-h", "/tmp", "-U", "postgres"], 10000, true).status === 0;
}
function pgValue(c, id) {
  return docker(c, ["exec", id, "psql", "-X", "-h", "/tmp", "-U", "postgres", "-d", "postgres",
    "-At", "-c", "SELECT value FROM qa_sentinel;"], 10000).stdout.trim();
}
function storageValue(c) {
  return docker(c, ["run", "--rm", "--network", "none", "--pull", "never", "--volume",
    "qa_storage:/mnt:ro", "--entrypoint", "/bin/cat", image, "/mnt/object"], 30000).stdout.trim();
}
function child(bin, args, env) {
  const p = spawn(bin, args, { env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "pipe"] });
  let stderr = "";
  p.stderr.on("data", data => { stderr = (stderr + data.toString()).slice(-600); });
  return { p, error: () => stderr };
}
function exitOf(p) {
  return new Promise((resolve, reject) => {
    p.on("error", reject);
    p.on("close", code => code === 0 ? resolve() : reject(new Error(`PIPE_PROCESS_FAILED_${code}`)));
  });
}
async function archive(c, recipient) {
  const tar = child("/opt/homebrew/bin/limactl", ["shell", "--tty=false", c.guest, "--",
    "sudo", "tar", "-C", "/var/lib/docker/volumes", "-cf", "-", "qa_pgdata/_data", "qa_storage/_data"], envFor(c));
  const age = child("/opt/homebrew/bin/age", ["-r", recipient]);
  const sourceToAge = pipeline(tar.p.stdout, age.p.stdin);
  try {
    const result = await writeBoundedCiphertext({
      ciphertext: age.p.stdout, outputPath: cipher, maxBytes: limit,
      minFreeBytes: floor, freeBytes,
      upstreamCompletion: Promise.all([sourceToAge, exitOf(tar.p), exitOf(age.p)]),
      abortUpstream: () => { tar.p.kill(); age.p.kill(); },
    });
    evidence.ciphertextBytes = result.bytes;
  }
  catch (error) { throw new Error(`ENCRYPTED_EXPORT_FAILED:${tar.error().slice(0, 150)}:${age.error().slice(0, 150)}:${error.message}`); }
  freeBytes();
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(cipher)) hash.update(chunk);
  evidence.ciphertextSha256 = hash.digest("hex");
}
async function restore(c) {
  const age = child("/opt/homebrew/bin/age", ["-d", "-i", keyPath, cipher]);
  const tar = child("/opt/homebrew/bin/limactl", ["shell", "--tty=false", c.guest, "--",
    "sudo", "tar", "-C", "/var/lib/docker/volumes", "-xf", "-"], envFor(c));
  age.p.stdout.pipe(tar.p.stdin);
  try { await Promise.all([exitOf(age.p), exitOf(tar.p)]); }
  catch (error) { throw new Error(`ISOLATED_RESTORE_FAILED:${age.error().slice(0, 150)}:${tar.error().slice(0, 150)}:${error.message}`); }
}
function cleanup(c) {
  if (c.started) {
    guest(c, ["sudo", "systemctl", "start", "docker"], 15000, true);
    for (const id of c.ids) docker(c, ["rm", "-f", id], 15000, true);
    for (const volume of c.volumes) docker(c, ["volume", "rm", volume], 15000, true);
    const stop = run("/opt/homebrew/bin/limactl", ["stop", c.guest],
      { env: envFor(c), timeout: 60000, allowFailure: true });
    if (stop.status !== 0) return false;
    c.started = false;
  }
  if (c.home && existsSync(join(c.home, c.guest))) {
    const del = run("/opt/homebrew/bin/limactl", ["delete", c.guest],
      { env: envFor(c), timeout: 60000, allowFailure: true });
    if (del.status !== 0) return false;
  }
  if (c.attached) {
    const detached = run("/usr/bin/hdiutil", ["detach", c.mount], { timeout: 60000, allowFailure: true });
    if (detached.status !== 0) return false;
    c.attached = false;
  }
  if (existsSync(c.mount)) rmdirSync(c.mount);
  return true;
}

try {
  assert.ok(existsSync(base) && statSync(base).size > 300_000_000, "CACHED_BASE_MISSING");
  freeBytes();
  const sourceImage = run("/opt/homebrew/bin/docker", ["-H", sourceSocket,
    "image", "inspect", image, "--format", "{{.Id}}"], { timeout: 30000 }).stdout.trim();
  assert.equal(sourceImage, imageId, "CACHED_IMAGE_CHANGED");
  for (const c of contexts) setup(c);
  const [src, dst] = contexts;
  const imageTar = join(src.mount, "postgres-image.tar");
  run("/opt/homebrew/bin/docker", ["-H", sourceSocket, "image", "save", "-o", imageTar, image],
    { timeout: 120000 });
  for (const c of contexts) loadImage(c, imageTar);
  for (const c of contexts) for (const volume of ["qa_pgdata", "qa_storage"]) {
    docker(c, ["volume", "create", volume]); c.volumes.push(volume);
  }
  docker(src, ["run", "--rm", "--network", "none", "--pull", "never", "--user", "root",
    "--volume", "qa_pgdata:/data", "--entrypoint", "/bin/sh", image, "-ec", "chown postgres:postgres /data"]);
  const pg = startPg(src);
  assert.ok(await waitFor(() => pgReady(src, pg)), "SYNTHETIC_POSTGRES_NOT_READY");
  docker(src, ["exec", pg, "psql", "-X", "-h", "/tmp", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-c", "CREATE TABLE qa_sentinel (value text NOT NULL); INSERT INTO qa_sentinel VALUES ('synthetic-cold-backup');"]);
  docker(src, ["run", "--rm", "--network", "none", "--pull", "never", "--volume", "qa_storage:/mnt",
    "--entrypoint", "/bin/sh", image, "-ec", "printf synthetic-storage-object > /mnt/object"]);
  assert.equal(pgValue(src, pg), "synthetic-cold-backup");
  assert.equal(storageValue(src), "synthetic-storage-object");
  for (let i = 0; i < 6; i++) {
    const args = ["run", "--detach", "--network", "none", "--pull", "never", "--restart", "no",
      "--name", `qa-service-${i}`, "--read-only"];
    if (i === 0) args.push("--volume", "qa_storage:/mnt");
    args.push("--entrypoint", "/bin/sleep", image, "3600");
    const id = docker(src, args).stdout.trim();
    assert.match(id, /^[0-9a-f]{64}$/); src.ids.push(id);
  }
  evidence.sevenIds = src.ids.length === 7 && new Set(src.ids).size === 7 &&
    src.ids.every(id => docker(src, ["inspect", id, "--format", "{{.State.Running}} {{.HostConfig.NetworkMode}}"]).stdout.trim() === "true none");
  assert.ok(evidence.sevenIds, "SEVEN_SERVICE_IDS_NOT_READY");
  for (const id of src.ids.slice(1).reverse()) docker(src, ["stop", "--time", "10", id]);
  docker(src, ["stop", "--time", "30", pg]);
  evidence.stoppedInDependencyOrder = src.ids.every(id =>
    docker(src, ["inspect", id, "--format", "{{.State.Running}}" ]).stdout.trim() === "false");
  evidence.noWritersAtExport = evidence.stoppedInDependencyOrder &&
    docker(src, ["ps", "-q"]).stdout.trim() === "" &&
    docker(src, ["exec", pg, "pg_isready", "-h", "/tmp", "-U", "postgres"], 10000, true).status !== 0;
  assert.ok(evidence.noWritersAtExport, "SYNTHETIC_WRITER_REMAINED");
  keyPath = join(src.mount, "disposable-age-identity.txt");
  run("/opt/homebrew/bin/age-keygen", ["-o", keyPath]);
  assert.equal(statSync(keyPath).mode & 0o077, 0, "DISPOSABLE_KEY_PERMISSIONS");
  const recipient = run("/opt/homebrew/bin/age-keygen", ["-y", keyPath]).stdout.trim();
  assert.match(recipient, /^age1[0-9a-z]+$/);
  await archive(src, recipient);
  const checkAge = child("/opt/homebrew/bin/age", ["-d", "-i", keyPath, cipher]);
  const checkTar = child("/usr/bin/tar", ["-tf", "-"]);
  let listing = "";
  checkAge.p.stdout.pipe(checkTar.p.stdin);
  checkTar.p.stdout.on("data", data => { listing += data.toString(); });
  await Promise.all([exitOf(checkAge.p), exitOf(checkTar.p)]);
  evidence.encryptedArchiveVerified = listing.includes("qa_pgdata/_data/PG_VERSION") &&
    listing.includes("qa_storage/_data/object");
  assert.ok(evidence.encryptedArchiveVerified, "ENCRYPTED_ARCHIVE_CONTENTS_INVALID");
  guest(src, ["sudo", "systemctl", "stop", "docker.service", "docker.socket"], 30000);
  evidence.daemonUnavailableObserved = docker(src, ["info"], 10000, true).status !== 0;
  assert.ok(evidence.daemonUnavailableObserved, "DAEMON_UNAVAILABILITY_NOT_OBSERVED");
  guest(src, ["sudo", "systemctl", "start", "docker.socket", "docker.service"], 30000);
  assert.ok(await waitFor(() => docker(src, ["info", "--format", "{{.ID}}"], 10000, true).status === 0),
    "DAEMON_RECOVERY_FAILED");
  for (const id of src.ids) docker(src, ["start", id]);
  evidence.exactIdsRestartedAfterDaemonRecovery = src.ids.every(id =>
    docker(src, ["inspect", id, "--format", "{{.State.Running}}" ]).stdout.trim() === "true");
  assert.ok(evidence.exactIdsRestartedAfterDaemonRecovery, "EXACT_ID_RESTART_FAILED");
  assert.ok(await waitFor(() => pgReady(src, pg)), "POST_RESTART_POSTGRES_NOT_READY");
  evidence.sourceDataAfterRestart = pgValue(src, pg) === "synthetic-cold-backup" &&
    storageValue(src) === "synthetic-storage-object";
  assert.ok(evidence.sourceDataAfterRestart, "SOURCE_SENTINEL_LOST");
  await restore(dst);
  evidence.separateEncryptedRestore = true;
  const restoredPg = startPg(dst, true);
  assert.ok(await waitFor(() => pgReady(dst, restoredPg)), "RESTORED_POSTGRES_NOT_READY");
  evidence.postgresRestore = pgValue(dst, restoredPg) === "synthetic-cold-backup";
  evidence.storageRestore = storageValue(dst) === "synthetic-storage-object";
  assert.ok(evidence.postgresRestore && evidence.storageRestore, "RESTORED_SENTINEL_MISMATCH");
  freeBytes();
  evidence.status = "PASS";
} catch (error) {
  evidence.reason = String(error.message).slice(0, 400);
} finally {
  if (keyPath && existsSync(keyPath)) unlinkSync(keyPath);
  const cleaned = contexts.map(cleanup);
  if (cleaned.every(Boolean) && scratch.startsWith(prefix) && cipherDir.startsWith("/private/tmp/do-cold-cipher-qa.")) {
    rmSync(scratch, { recursive: true });
    rmSync(cipherDir, { recursive: true });
    evidence.cleanup = true;
  }
  if (!evidence.cleanup) evidence.status = "FAIL";
  console.log(JSON.stringify(evidence));
  if (evidence.status !== "PASS") process.exitCode = 1;
}
