import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PIN, RESTART, assertSourcePinned, canonicalManifest, runControlledCapture } from "./original-gbi-cold-controller.mjs";
import { writeBoundedCiphertext } from "./bounded-ciphertext-writer.mjs";

// Public encryption recipient only. No private identity or actual source access.
const recipient = "age1p6twvvyam8ezh453pwc4z4d2kwkeddh34pwu8axyd03dgs5fqfaq42eqn6";
assert.equal(createHash("sha256").update(recipient).digest("hex"), PIN.recipientSha256);
const approval = Object.freeze({ kind: "SEPARATE_EXACT_OWNER_RISK_ACCEPTANCE", source: "colima-gbi",
  acknowledgesNoCurrentRollback: true, acknowledgesProlongedOutage: true });
const entries = [
  { path: "supabase_db_gan-batuach-integration/_data/PG_VERSION", bytes: 2, sha256: "a".repeat(64) },
  { path: "supabase_storage_gan-batuach-integration/_data/object", bytes: 3, sha256: "b".repeat(64) },
];

function snapshot() {
  return { colimaHome: PIN.colimaHome, limaInstance: PIN.limaInstance, socket: PIN.socket,
    daemonId: PIN.daemonId, configSha256: PIN.configSha256, vmState: "Running", daemonReady: true,
    excludedQaId: PIN.excludedQaId, excludedQaRunning: true,
    containers: PIN.stop.map(([service, id]) => ({ service, id, project: PIN.project, running: true })),
    volumes: PIN.volumes, mountOwners: [[PIN.volumes[0][0], PIN.stop.at(-1)[1]],
      [PIN.volumes[1][0], PIN.stop.find(([service]) => service === "storage")[1]]],
    noOtherVolumeMounts: true, noActiveClients: true,
    exclusiveWriterWindow: true, independentKeyVerified: true, recipient };
}
function fixture(options = {}) {
  const dir = mkdtempSync("/private/tmp/do-gbi-cold.test.");
  const outputPath = join(dir, "new-only.tar.age");
  const calls = [];
  const running = new Map(PIN.stop.map(([, id]) => [id, true]));
  let manifestRead = 0;
  const adapter = {
    offlineFixture: true,
    async inspectSource() { calls.push("inspectSource"); return { ...snapshot(), ...options.snapshot }; },
    async stopGracefully(id, signal) {
      calls.push(`stop:${id}`);
      if (options.stopHang && id === PIN.stop[0][1])
        return new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("STOP_ABORTED")), { once: true }));
      if (options.ignoreStopAbort && id === PIN.stop[0][1]) return new Promise(() => {});
      if (options.stopFailure && id === PIN.stop[0][1]) throw new Error("STOP_FAILED");
      if (options.stopReturnsEarly && id === PIN.stop[0][1]) return;
      running.set(id, false);
    },
    async inspectQuiescence() {
      calls.push("inspectQuiescence");
      return { stoppedIds: PIN.stop.map(([, id]) => id), daemonId: PIN.daemonId,
        noOtherVolumeMounts: true, noActiveClients: true, noWriters: true,
        postgresCleanShutdown: !options.dirtyPg, noUnexpectedSpecialFiles: true };
    },
    async fileManifest() {
      calls.push("fileManifest"); manifestRead++;
      return options.manifestChanged && manifestRead === 2
        ? [{ ...entries[0], sha256: "c".repeat(64) }, entries[1]] : entries;
    },
    async beginEncryptedExport({ recipient: actual }) {
      calls.push("beginEncryptedExport"); assert.equal(actual, recipient);
      if (options.createRaceFile) writeFileSync(outputPath, "other-owner", { flag: "wx", mode: 0o600 });
      return { ciphertext: Readable.from([Buffer.from("synthetic-ciphertext")]),
        upstreamCompletion: options.producerFailure ? Promise.reject(new Error("PRODUCER_FAILED")) : Promise.resolve(),
        abortUpstream: () => { calls.push("abortUpstream"); } };
    },
    async waitForDaemon() { calls.push("waitForDaemon"); if (options.daemonUnavailable) throw new Error("DAEMON_UNAVAILABLE"); },
    async waitForPostgresHealthy() { calls.push("waitForPostgresHealthy"); },
    async startExisting(id) {
      calls.push(`start:${id}`);
      if (options.restartFailure && id === PIN.stop.at(-1)[1]) throw new Error("DB_RESTART_FAILED");
      running.set(id, true);
    },
    async isRunning(id) { calls.push(`running:${id}`); return running.get(id); },
    async verifySourceHealth() { calls.push("verifySourceHealth"); },
  };
  const run = (overrides = {}) => runControlledCapture({ adapter, outputPath,
    approval, freeBytes: () => 5 * 1024 ** 3, ...overrides });
  return { dir, outputPath, calls, adapter, run, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
async function usingFixture(options, check) {
  const f = fixture(options);
  try { await check(f); } finally { f.cleanup(); }
}

test("no-argument CLI is closed, explicit dry-run is static and read-only", () => {
  const path = fileURLToPath(new URL("./original-gbi-cold-controller.mjs", import.meta.url));
  const closed = spawnSync(process.execPath, [path], { encoding: "utf8" });
  const dry = spawnSync(process.execPath, [path, "--dry-run"], { encoding: "utf8" });
  assert.equal(closed.status, 2);
  assert.equal(JSON.parse(dry.stdout).sourceCommands, 0);
  assert.equal(JSON.parse(dry.stdout).status, "NO_GO");
});

test("no exact separate risk acceptance means no inspection or source action", async () => usingFixture({}, async f => {
  const result = await f.run({ approval: undefined });
  assert.equal(result.reason, "SOURCE_DOWNTIME_NOT_AUTHORIZED");
  assert.deepEqual(f.calls, []);
}));

test("live adapter and incomplete fake adapter are rejected before source inspection", async () => usingFixture({}, async f => {
  const live = { ...f.adapter, offlineFixture: false };
  assert.equal((await f.run({ adapter: live })).reason, "LIVE_ADAPTER_NOT_AUTHORIZED");
  const incomplete = { ...f.adapter, waitForPostgresHealthy: undefined };
  assert.equal((await f.run({ adapter: incomplete })).reason, "ADAPTER_METHOD_MISSING:waitForPostgresHealthy");
  assert.deepEqual(f.calls, []);
}));

test("pinned external source mismatch blocks before stop", async () => usingFixture({ snapshot: { socket: "unix:///wrong/docker.sock" } }, async f => {
  const result = await f.run();
  assert.match(result.reason, /^SOURCE_PIN_MISMATCH/);
  assert.deepEqual(f.calls, ["inspectSource"]);
}));

test("wrong or extra container and changed QA exclusion block before stop", () => {
  assert.throws(() => assertSourcePinned({ ...snapshot(), containers: [...snapshot().containers, { id: "other" }] }), /SOURCE_CONTAINER_SET_CHANGED/);
  assert.throws(() => assertSourcePinned({ ...snapshot(), excludedQaId: "other" }), /EXCLUDED_QA_ID_CHANGED/);
  assert.throws(() => assertSourcePinned({ ...snapshot(), mountOwners: [] }), /SOURCE_VOLUME_OWNER_MISMATCH/);
  assert.throws(() => assertSourcePinned({ ...snapshot(), recipient: "age1wrong" }), /RECIPIENT_DIGEST_MISMATCH/);
});

test("missing exclusive writer or independent key proof blocks before stop", async () => usingFixture({ snapshot: { exclusiveWriterWindow: false } }, async f => {
  assert.equal((await f.run()).reason, "EXCLUSIVE_WRITER_WINDOW_NOT_PROVEN");
  assert.ok(!f.calls.some(x => x.startsWith("stop:")));
}));

test("existing archive is never overwritten or removed", async () => usingFixture({}, async f => {
  writeFileSync(f.outputPath, "prior-archive", { flag: "wx", mode: 0o600 });
  assert.equal((await f.run()).reason, "OUTPUT_ALREADY_EXISTS");
  assert.equal(readFileSync(f.outputPath, "utf8"), "prior-archive");
  assert.ok(!f.calls.some(x => x.startsWith("stop:")));
}));

test("file created after preflight is not deleted on exclusive-open failure", async () => usingFixture({ createRaceFile: true }, async f => {
  const result = await f.run();
  assert.equal(result.status, "BLOCKED");
  assert.match(result.reason, /EEXIST/);
  assert.equal(readFileSync(f.outputPath, "utf8"), "other-owner");
  assert.ok(result.restartErrors.includes("ARCHIVE_FILE_NOT_PROVEN_OWNED_KEEP_FOR_REVIEW"));
}));

test("insufficient full-cap floor blocks before stop", async () => usingFixture({}, async f => {
  const result = await f.run({ freeBytes: () => 4 * 1024 ** 3 - 1 });
  assert.equal(result.reason, "FULL_CAP_FREE_SPACE_MISSING");
  assert.ok(!f.calls.some(x => x.startsWith("stop:")));
}));

test("non-internal output path is denied before any stop", async () => usingFixture({}, async f => {
  const result = await f.run({ outputPath: "/Volumes/DIGITAL_OBSERVER/unauthorized.tar.age" });
  assert.match(result.reason, /DEDICATED_INTERNAL_OUTPUT_REQUIRED/);
  assert.ok(!f.calls.some(x => x.startsWith("stop:")));
}));

test("mock PASS orders six app stops, PG stop, export, then source return first", async () => usingFixture({}, async f => {
  const result = await f.run();
  assert.equal(result.status, "MOCK_CAPTURE_ONLY");
  assert.equal(result.sourceReturned, true);
  assert.equal(result.archiveBytes, Buffer.byteLength("synthetic-ciphertext"));
  assert.deepEqual(f.calls.filter(x => x.startsWith("stop:")), PIN.stop.map(([, id]) => `stop:${id}`));
  assert.deepEqual(f.calls.filter(x => x.startsWith("start:")), RESTART.map(service => `start:${PIN.stop.find(([name]) => name === service)[1]}`));
  assert.ok(f.calls.indexOf("verifySourceHealth") > f.calls.lastIndexOf("fileManifest"));
  assert.equal(readFileSync(f.outputPath, "utf8"), "synthetic-ciphertext");
}));

test("stop timeout aborts and attempts exact source return; no export", async () => usingFixture({ stopHang: true }, async f => {
  const result = await f.run({ deadlines: { apps: 8, db: 8, export: 8, restart: 100, total: 200 } });
  assert.equal(result.status, "BLOCKED");
  assert.match(result.reason, /STOP_TIMEOUT:kong/);
  assert.ok(f.calls.includes("waitForDaemon"));
  assert.ok(!f.calls.includes("beginEncryptedExport"));
}));

test("early stop acknowledgement is rejected before proceeding to next container", async () => usingFixture({ stopReturnsEarly: true }, async f => {
  const result = await f.run();
  assert.match(result.reason, /STOP_NOT_CONFIRMED:kong/);
  assert.equal(result.sourceReturned, false);
  assert.ok(result.restartErrors.includes("LATE_STOP_POSSIBLE_AFTER_ABORT"));
  assert.equal(f.calls.filter(x => x.startsWith("stop:")).length, 1);
  assert.ok(!f.calls.includes("beginEncryptedExport"));
}));

test("uncooperative late stop never produces a source-return PASS", async () => usingFixture({ ignoreStopAbort: true }, async f => {
  const result = await f.run({ deadlines: { apps: 8, db: 8, export: 8, restart: 100, total: 200 } });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.sourceReturned, false);
  assert.match(result.reason, /LATE_STOP_POSSIBLE_AFTER_ABORT/);
  assert.ok(!f.calls.includes("beginEncryptedExport"));
}));

test("unclean PG state aborts export and returns source", async () => usingFixture({ dirtyPg: true }, async f => {
  const result = await f.run();
  assert.equal(result.reason, "POSTGRES_NOT_CLEANLY_SHUT_DOWN");
  assert.equal(result.sourceReturned, true);
  assert.ok(!f.calls.includes("beginEncryptedExport"));
}));

test("producer failure removes partial ciphertext and returns source", async () => usingFixture({ producerFailure: true }, async f => {
  const result = await f.run();
  assert.equal(result.status, "BLOCKED");
  assert.match(result.reason, /PRODUCER_FAILED/);
  assert.equal(result.sourceReturned, true);
  assert.ok(!existsSync(f.outputPath));
}));

test("export deadline aborts cooperative writer, removes partial, and returns source", async () => usingFixture({}, async f => {
  const result = await f.run({ deadlines: { apps: 100, db: 100, export: 8, restart: 100, total: 300 },
    writer: ({ outputPath, signal }) => {
      writeFileSync(outputPath, "partial", { flag: "wx", mode: 0o600 });
      return new Promise((_, reject) => signal.addEventListener("abort", () => {
        rmSync(outputPath); reject(new Error("WRITER_ABORTED"));
      }, { once: true }));
    } });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.reason, "EXPORT_TIMEOUT");
  assert.equal(result.sourceReturned, true);
  assert.ok(!existsSync(f.outputPath));
}));

test("ciphertext cap and disk-floor failures clean only new partial file", async () => {
  for (const code of ["CIPHERTEXT_LIMIT_EXCEEDED", "FREE_SPACE_FLOOR_BREACHED"]) {
    await usingFixture({}, async f => {
      const result = await f.run({ writer: options => {
        let call = 0;
        return writeBoundedCiphertext({ ...options, maxBytes: code === "CIPHERTEXT_LIMIT_EXCEEDED" ? 4 : 32,
          minFreeBytes: 0, freeBytes: () => code === "CIPHERTEXT_LIMIT_EXCEEDED" ? 100 : (call++ === 0 ? 32 : 0) });
      } });
      assert.equal(result.reason, code);
      assert.equal(result.sourceReturned, true);
      assert.ok(!existsSync(f.outputPath));
    });
  }
});

test("changed per-file manifest invalidates and removes new archive", async () => usingFixture({ manifestChanged: true }, async f => {
  const result = await f.run();
  assert.equal(result.reason, "SOURCE_MANIFEST_CHANGED_DURING_EXPORT");
  assert.equal(result.sourceReturned, true);
  assert.ok(!existsSync(f.outputPath));
}));

test("restart failure is reported, other exact IDs still attempted", async () => usingFixture({ restartFailure: true }, async f => {
  const result = await f.run();
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.sourceReturned, false);
  assert.match(result.reason, /SOURCE_RETURN_UNVERIFIED/);
  assert.equal(f.calls.filter(x => x.startsWith("start:")).length, 7);
}));

test("daemon outage cannot guarantee return and never claims PASS", async () => usingFixture({ daemonUnavailable: true }, async f => {
  const result = await f.run();
  assert.equal(result.status, "BLOCKED");
  assert.match(result.reason, /DAEMON_UNAVAILABLE/);
  assert.ok(!f.calls.some(x => x.startsWith("start:")));
}));

test("manifest rejects traversal, duplicates and missing per-file hash", () => {
  assert.throws(() => canonicalManifest([{ ...entries[0], path: "../secrets" }]), /MANIFEST_PATH_INVALID/);
  assert.throws(() => canonicalManifest([entries[0], entries[0]]), /MANIFEST_PATH_INVALID/);
  assert.throws(() => canonicalManifest([{ ...entries[0], sha256: "bad" }]), /MANIFEST_HASH_INVALID/);
  assert.throws(() => canonicalManifest([entries[0]]), /MANIFEST_VOLUME_MISSING/);
});
