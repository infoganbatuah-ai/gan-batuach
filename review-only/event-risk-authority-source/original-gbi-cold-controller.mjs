#!/usr/bin/env node
// REVIEW ONLY. No live Docker/Lima adapter is supplied by this module or CLI.
// A future operator must supply an independently reviewed adapter and fresh,
// exact owner risk acceptance before any source operation is possible.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, realpathSync, statfsSync, unlinkSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_CIPHERTEXT_BYTES, MIN_INTERNAL_FREE_BYTES, writeBoundedCiphertext } from "./bounded-ciphertext-writer.mjs";

export const PIN = Object.freeze({
  colimaHome: "/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/colima",
  limaInstance: "colima-gbi",
  socket: "unix:///Volumes/DIGITAL_OBSERVER/Development/gan-batuach/colima/gbi/docker.sock",
  daemonId: "cb406f3c-6987-4019-8ac7-bed803bf6a37",
  configSha256: "99b591d94bb332941d9ea2b62dbc8309252d3e0f74840fa86fea841c5611275e",
  recipientSha256: "1fc9645eff132753e75a26eb0856b6f9abe0a26af6002625346832a8a89d97b4",
  project: "gan-batuach-integration",
  excludedQaId: "aa3a55e6458ac9c15f10371cf12b9a613883f13339af796b58ea5f94eee08864",
  volumes: Object.freeze([
    ["supabase_db_gan-batuach-integration", "/var/lib/postgresql/data"],
    ["supabase_storage_gan-batuach-integration", "/mnt"],
  ]),
  stop: Object.freeze([
    ["kong", "89f1ab3290859f6cb45a231df78b12ff26108dbb2eeef934c168293b86dffeb3"],
    ["rest", "258505d581ef761d104499cab53cdda3a8fad4927e6a5077da3a024d8f0611ed"],
    ["realtime", "211cc3b6a89949ad7d867eebe9184a4541b8fa69c23ff848ebf0f1b4246317a7"],
    ["auth", "621338a2731538c4155d397ae9ba664b221715ac70b3dc8eba49e3b7b004ac71"],
    ["storage", "10d09ce7f92239b42b390364f9d5552f893e1367b734267afa3bdfe020a91602"],
    ["inbucket", "b9709ad9c976891cba175e54982fd72e1765031e223ab2f2206f2e24cd4b2b6e"],
    ["db", "7c30223f1a6f2b7be78e85d2ba44a5eeccb0704a3113f36c03bb8e6f84744d0a"],
  ]),
});
export const RESTART = Object.freeze(["db", "storage", "auth", "rest", "realtime", "inbucket", "kong"]);
export const DEADLINES_MS = Object.freeze({ apps: 90_000, db: 90_000, export: 480_000, restart: 240_000, total: 900_000 });

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = code => { throw new Error(code); };
const sha256 = value => createHash("sha256").update(value).digest("hex");
const ids = Object.fromEntries(PIN.stop);
const expectedIds = PIN.stop.map(([, id]) => id);

export function assertSourcePinned(snapshot) {
  assert.ok(snapshot && typeof snapshot === "object", "SOURCE_SNAPSHOT_REQUIRED");
  for (const [field, value] of [
    ["colimaHome", PIN.colimaHome], ["limaInstance", PIN.limaInstance],
    ["socket", PIN.socket], ["daemonId", PIN.daemonId], ["configSha256", PIN.configSha256],
  ]) assert.equal(snapshot[field], value, `SOURCE_PIN_MISMATCH:${field}`);
  assert.equal(snapshot.vmState, "Running", "SOURCE_VM_NOT_RUNNING");
  assert.equal(snapshot.daemonReady, true, "SOURCE_DAEMON_UNAVAILABLE");
  assert.equal(snapshot.excludedQaId, PIN.excludedQaId, "EXCLUDED_QA_ID_CHANGED");
  assert.equal(snapshot.excludedQaRunning, true, "EXCLUDED_QA_STATE_CHANGED");
  assert.ok(Array.isArray(snapshot.containers) && snapshot.containers.length === PIN.stop.length,
    "SOURCE_CONTAINER_SET_CHANGED");
  for (const [service, id] of PIN.stop) {
    const c = snapshot.containers.find(value => value.id === id);
    assert.ok(c && c.service === service && c.project === PIN.project && c.running === true,
      `SOURCE_CONTAINER_MISMATCH:${service}`);
  }
  assert.equal(new Set(snapshot.containers.map(c => c.id)).size, PIN.stop.length, "SOURCE_CONTAINER_DUPLICATE");
  assert.ok(same(snapshot.volumes, PIN.volumes), "SOURCE_VOLUME_MISMATCH");
  assert.ok(same(snapshot.mountOwners, [
    [PIN.volumes[0][0], ids.db], [PIN.volumes[1][0], ids.storage],
  ]), "SOURCE_VOLUME_OWNER_MISMATCH");
  assert.equal(snapshot.noOtherVolumeMounts, true, "OTHER_VOLUME_MOUNT_PRESENT");
  assert.equal(snapshot.noActiveClients, true, "ACTIVE_DEVELOPMENT_CLIENT");
  if (snapshot.exclusiveWriterWindow !== true) fail("EXCLUSIVE_WRITER_WINDOW_NOT_PROVEN");
  assert.equal(snapshot.independentKeyVerified, true, "INDEPENDENT_KEY_NOT_VERIFIED");
  assert.match(snapshot.recipient ?? "", /^age1[0-9a-z]+$/, "RECIPIENT_INVALID");
  assert.equal(sha256(snapshot.recipient), PIN.recipientSha256, "RECIPIENT_DIGEST_MISMATCH");
  return snapshot.recipient;
}

export function assertQuiescent(observed) {
  assert.ok(observed && same(observed.stoppedIds, expectedIds), "SOURCE_NOT_FULLY_STOPPED");
  assert.equal(observed.daemonId, PIN.daemonId, "SOURCE_DAEMON_CHANGED_AFTER_STOP");
  assert.equal(observed.noOtherVolumeMounts, true, "OTHER_VOLUME_MOUNT_AFTER_STOP");
  assert.equal(observed.noActiveClients, true, "ACTIVE_CLIENT_AFTER_STOP");
  assert.equal(observed.noWriters, true, "SOURCE_WRITER_AFTER_STOP");
  assert.equal(observed.noUnexpectedSpecialFiles, true, "SPECIAL_FILE_OR_SYMLINK_UNRESOLVED");
  if (observed.postgresCleanShutdown !== true) fail("POSTGRES_NOT_CLEANLY_SHUT_DOWN");
}

export function canonicalManifest(entries) {
  assert.ok(Array.isArray(entries) && entries.length > 0, "MANIFEST_EMPTY");
  const seen = new Set();
  const roots = new Set();
  const normalized = entries.map(entry => {
    assert.ok(entry && typeof entry.path === "string" &&
      /^(supabase_db_gan-batuach-integration|supabase_storage_gan-batuach-integration)\/_data\//.test(entry.path) &&
      !entry.path.includes("..") && !entry.path.includes("\\") && !seen.has(entry.path), "MANIFEST_PATH_INVALID");
    assert.ok(Number.isSafeInteger(entry.bytes) && entry.bytes >= 0, "MANIFEST_SIZE_INVALID");
    assert.match(entry.sha256 ?? "", /^[a-f0-9]{64}$/, "MANIFEST_HASH_INVALID");
    seen.add(entry.path);
    roots.add(entry.path.split("/")[0]);
    return { path: entry.path, bytes: entry.bytes, sha256: entry.sha256 };
  }).sort((a, b) => a.path.localeCompare(b.path));
  assert.ok(PIN.volumes.every(([name]) => roots.has(name)), "MANIFEST_VOLUME_MISSING");
  return normalized;
}

export function assertArchivePreflight(outputPath, freeBytes) {
  assert.equal(typeof outputPath, "string", "OUTPUT_PATH_REQUIRED");
  assert.ok(isAbsolute(outputPath) && resolve(outputPath) === outputPath,
    "ABSOLUTE_INTERNAL_OUTPUT_REQUIRED");
  assert.match(realpathSync(dirname(outputPath)), /^\/private\/tmp\/do-gbi-cold\.[^/]+$/,
    "DEDICATED_INTERNAL_OUTPUT_REQUIRED");
  assert.ok(!existsSync(outputPath), "OUTPUT_ALREADY_EXISTS");
  const parent = lstatSync(dirname(outputPath));
  assert.ok(parent.isDirectory() && parent.uid === process.getuid() && (parent.mode & 0o077) === 0,
    "PRIVATE_OUTPUT_DIRECTORY_REQUIRED");
  const available = freeBytes();
  assert.ok(Number.isSafeInteger(available) && available >= MAX_CIPHERTEXT_BYTES + MIN_INTERNAL_FREE_BYTES,
    "FULL_CAP_FREE_SPACE_MISSING");
}

export function realFreeBytes(outputPath) {
  const stat = statfsSync(dirname(outputPath));
  return Number(stat.bavail) * Number(stat.bsize);
}

async function timed(work, milliseconds, clock, code) {
  const abort = new AbortController();
  let timer;
  let graceTimer;
  let expired = false;
  let settled = false;
  const operation = Promise.resolve().then(() => work(abort.signal));
  operation.then(() => { settled = true; }, () => { settled = true; });
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => { timer = clock.setTimeout(() => {
        expired = true; abort.abort(); reject(new Error(code));
      }, milliseconds); }),
    ]);
  } catch (error) {
    if (expired) {
      // Abort is cooperative. An adapter that ignores it is not safe to treat
      // as stopped; in particular, its archive file must not be unlinked yet.
      await Promise.race([operation.catch(() => {}), new Promise(resolve => {
        graceTimer = clock.setTimeout(resolve, 2_000);
      })]);
      if (!settled) {
        const unconfirmed = new Error(`${code}:ABORT_UNCONFIRMED`);
        unconfirmed.operationUnsettled = true;
        throw unconfirmed;
      }
    }
    throw error;
  } finally { clock.clearTimeout(timer); if (graceTimer) clock.clearTimeout(graceTimer); }
}

const systemClock = { now: () => Date.now(), setTimeout, clearTimeout };
function remaining(start, clock, budget) {
  const left = budget - (clock.now() - start);
  if (left <= 0) fail("TOTAL_DEADLINE_EXCEEDED");
  return left;
}

// Adapter contract: every inspect method is read-only; stopGracefully must not
// use Docker's finite --time/--timeout (which eventually SIGKILLs). There is
// deliberately no real adapter here. Injected adapters are exercised only by
// isolated tests until a separately approved source-specific review.
export async function runControlledCapture({ adapter, outputPath, approval, clock = systemClock,
  deadlines = DEADLINES_MS, writer = writeBoundedCiphertext, freeBytes = () => realFreeBytes(outputPath) }) {
  const receipt = { status: "BLOCKED", reason: null, sourceReturned: false, archiveBytes: null,
    stopAttempted: false, sourceAction: false, restartErrors: [] };
  let archiveCreated = false;
  let archiveComplete = false;
  let archiveWriteUnsettled = false;
  let lateStopRisk = false;
  let ownedArchiveIdentity;
  let stopAttempted = false;
  const start = clock.now();
  try {
    // This contract runner is deliberately restricted to fake adapters. A
    // caller-supplied approval object is test input, not owner authorization.
    if (adapter?.offlineFixture !== true) fail("LIVE_ADAPTER_NOT_AUTHORIZED");
    for (const method of ["inspectSource", "stopGracefully", "isRunning", "inspectQuiescence",
      "fileManifest", "beginEncryptedExport", "waitForDaemon", "startExisting",
      "waitForPostgresHealthy", "verifySourceHealth"])
      if (typeof adapter[method] !== "function") fail(`ADAPTER_METHOD_MISSING:${method}`);
    if (approval?.kind !== "SEPARATE_EXACT_OWNER_RISK_ACCEPTANCE") fail("SOURCE_DOWNTIME_NOT_AUTHORIZED");
    assert.equal(approval?.source, PIN.limaInstance, "APPROVAL_SOURCE_MISMATCH");
    assert.equal(approval?.acknowledgesNoCurrentRollback, true, "ROLLBACK_RISK_NOT_ACCEPTED");
    assert.equal(approval?.acknowledgesProlongedOutage, true, "OUTAGE_RISK_NOT_ACCEPTED");
    assert.ok(adapter && typeof adapter.inspectSource === "function", "SOURCE_ADAPTER_MISSING");
    const snapshot = await adapter.inspectSource();
    const recipient = assertSourcePinned(snapshot);
    assertArchivePreflight(outputPath, freeBytes);
    const appsStart = clock.now();
    for (const [service, id] of PIN.stop.slice(0, -1)) {
      const budget = Math.min(remaining(appsStart, clock, deadlines.apps),
        remaining(start, clock, deadlines.total));
      stopAttempted = true; // A stop can time out after reaching Docker.
      receipt.stopAttempted = true;
      receipt.sourceAction = true;
      try {
        await timed(signal => adapter.stopGracefully(id, signal), budget, clock, `STOP_TIMEOUT:${service}`);
        if (await adapter.isRunning(id)) fail(`STOP_NOT_CONFIRMED:${service}`);
      } catch (error) {
        // Even a settled CLI can have sent a signal whose effect arrives later.
        lateStopRisk = true;
        throw error;
      }
    }
    stopAttempted = true;
    receipt.stopAttempted = true;
    receipt.sourceAction = true;
    try {
      await timed(signal => adapter.stopGracefully(ids.db, signal),
        Math.min(deadlines.db, remaining(start, clock, deadlines.total)), clock, "STOP_TIMEOUT:db");
      if (await adapter.isRunning(ids.db)) fail("STOP_NOT_CONFIRMED:db");
    } catch (error) { lateStopRisk = true; throw error; }
    assertQuiescent(await adapter.inspectQuiescence());
    const before = canonicalManifest(await adapter.fileManifest());
    const stream = await adapter.beginEncryptedExport({ recipient, signalDeadlineMs: deadlines.export });
    archiveCreated = true;
    const written = await timed(signal => writer({ ciphertext: stream.ciphertext, outputPath,
      maxBytes: MAX_CIPHERTEXT_BYTES, minFreeBytes: MIN_INTERNAL_FREE_BYTES,
      freeBytes, upstreamCompletion: stream.upstreamCompletion,
      abortUpstream: stream.abortUpstream, signal }),
    Math.min(deadlines.export, remaining(start, clock, deadlines.total)), clock, "EXPORT_TIMEOUT");
    receipt.archiveBytes = written.bytes;
    const file = lstatSync(outputPath);
    assert.ok(file.isFile() && (file.mode & 0o077) === 0 && file.size === written.bytes,
      "CIPHERTEXT_FILE_IDENTITY_INVALID");
    ownedArchiveIdentity = { dev: file.dev, ino: file.ino };
    const after = canonicalManifest(await adapter.fileManifest());
    assert.ok(same(before, after), "SOURCE_MANIFEST_CHANGED_DURING_EXPORT");
    archiveComplete = true;
  } catch (error) {
    archiveWriteUnsettled = Boolean(error.operationUnsettled && archiveCreated);
    receipt.reason = error.message;
  } finally {
    if (stopAttempted) {
      // Source return always precedes off-source archive verification.
      try {
        await timed(async signal => {
          await adapter.waitForDaemon(signal);
          for (const service of RESTART) {
            try {
              if (!(await adapter.isRunning(ids[service]))) await adapter.startExisting(ids[service], signal);
              if (service === "db") await adapter.waitForPostgresHealthy(signal);
            }
            catch (error) { receipt.restartErrors.push(`${service}:${error.message}`); }
          }
          for (const id of expectedIds) {
            try { if (!(await adapter.isRunning(id))) receipt.restartErrors.push(`NOT_RUNNING:${id}`); }
            catch (error) { receipt.restartErrors.push(`INSPECT:${error.message}`); }
          }
          if (receipt.restartErrors.length === 0) await adapter.verifySourceHealth(signal);
        }, deadlines.restart, clock, "SOURCE_RESTART_DEADLINE_EXCEEDED");
        if (lateStopRisk) receipt.restartErrors.push("LATE_STOP_POSSIBLE_AFTER_ABORT");
        receipt.sourceReturned = receipt.restartErrors.length === 0;
      } catch (error) { receipt.restartErrors.push(error.message); }
    }
    if (archiveCreated && !archiveComplete && existsSync(outputPath)) {
      try {
        const file = lstatSync(outputPath);
        if (ownedArchiveIdentity && !archiveWriteUnsettled && file.dev === ownedArchiveIdentity.dev &&
          file.ino === ownedArchiveIdentity.ino) unlinkSync(outputPath);
        else receipt.restartErrors.push("ARCHIVE_FILE_NOT_PROVEN_OWNED_KEEP_FOR_REVIEW");
      } catch (error) { receipt.restartErrors.push(`ARCHIVE_CLEANUP_FAILED:${error.message}`); }
    }
    if (archiveWriteUnsettled) receipt.restartErrors.push("ARCHIVE_WRITER_ABORT_UNCONFIRMED_KEEP_PARTIAL");
  }
  if (!receipt.sourceReturned && stopAttempted)
    receipt.reason = `SOURCE_RETURN_UNVERIFIED:${receipt.reason ?? "UNKNOWN_CAUSE"}:${receipt.restartErrors.join("|")}`;
  if (archiveComplete && receipt.sourceReturned) receipt.status = "MOCK_CAPTURE_ONLY";
  return receipt;
}

// Deliberately cannot execute: no live adapter, no owner acceptance parser.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length === 3 && process.argv[2] === "--dry-run") {
    process.stdout.write(JSON.stringify({ status: "NO_GO", source: PIN.limaInstance,
      reason: "STATIC_PINS_ONLY_RUNTIME_GATES_AND_OWNER_RISK_ACCEPTANCE_REQUIRED",
      sourceCommands: 0 }) + "\n");
  } else {
    process.stderr.write("NO_GO: this review-only controller has no live execution entrypoint; use --dry-run for static pins.\n");
    process.exitCode = 2;
  }
}
