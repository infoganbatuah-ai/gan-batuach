import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { COMPONENT_FILES, verifyComponentCiphertexts, runSyntheticRestoreContract } from "./component-restore-preflight.mjs";
import { MAX_ENCRYPTED_BYTES, MIN_INTERNAL_FREE_BYTES } from "./component-backup-contract.mjs";
import { runGuardedComponentRestore } from "./component-restore-controller.mjs";

const sha = data => createHash("sha256").update(data).digest("hex");
const age = "/opt/homebrew/bin/age";
const keygen = "/opt/homebrew/bin/age-keygen";
const enough = () => MIN_INTERNAL_FREE_BYTES + MAX_ENCRYPTED_BYTES + 1;
const proof = () => ({ checkedAtMs: Date.now(), encrypted: true, noHostMounts: true,
  noProxyEnv: true, originalVolumesAbsent: true, guestIpv4OutputDrop: true,
  guestIpv6OutputDrop: true, guestIpv4ForwardDrop: true, guestIpv6ForwardDrop: true,
  ipv4EgressProbeDenied: true, ipv6EgressProbeDenied: true, dnsResolutionProbeDenied: true,
  egressProbesDeniedAfterReboot: true, bootRouteAbsentBeforePolicy: true,
  bootIpv6RouteAbsentBeforePolicy: true, postgresTool: true, pgNetworkNone: true,
  storageNetworkNone: true, scratchCleaned: false });

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "do-restore-contract."));
  const source = join(root, "source");
  const target = join(root, "target");
  mkdirSync(source, { mode: 0o700 });
  mkdirSync(target, { mode: 0o700 });
  const generated = execFileSync(keygen, [], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const publicRecipient = generated.match(/^# public key: (age1[023456789acdefghjklmnpqrstuvwxyz]+)$/m)?.[1];
  assert.ok(publicRecipient);
  const components = Object.entries(COMPONENT_FILES).map(([id, file]) => {
    const ciphertext = execFileSync(age, ["-r", publicRecipient], {
      input: Buffer.from(`synthetic ${id}\n`), maxBuffer: 65536,
      stdio: ["pipe", "pipe", "ignore"],
    });
    writeFileSync(join(source, file), ciphertext, { mode: 0o600, flag: "wx" });
    return { id, file, status: "CAPTURED_NOT_RESTORED",
      ciphertextBytes: ciphertext.length, ciphertextSha256: sha(ciphertext) };
  });
  const receipt = { status: "COMPONENT_BACKUPS_ONLY", scope: "synthetic-only",
    sourceContainerId: "synthetic-container", publicRecipientSha256: sha(publicRecipient),
    atomicSnapshot: false, verifiedCurrentRollback: false, restoreVerified: false,
    independentRestore: "NOT_RUN", maxEncryptedBytes: MAX_ENCRYPTED_BYTES,
    totalEncryptedBytes: components.reduce((sum, component) => sum + component.ciphertextBytes, 0),
    components };
  const receiptPath = join(source, "receipt.json");
  writeFileSync(receiptPath, JSON.stringify(receipt), { mode: 0o600, flag: "wx" });
  return { root, source, target, receiptPath, receipt,
    expected: { expectedScope: receipt.scope, expectedRecipientSha256: receipt.publicRecipientSha256,
      expectedSourceContainerId: receipt.sourceContainerId },
    saveReceipt() { writeFileSync(receiptPath, JSON.stringify(receipt), { mode: 0o600 }); },
    cleanup() { rmSync(root, { recursive: true, force: false }); } };
}
function adapter(failureAt) {
  const calls = [];
  const call = name => async () => {
    calls.push(name);
    if (name === failureAt) throw new Error(name === "restoreFreshDatabase" ? "PG_RESTORE_FAILED" :
      name === "verifyStorageTarBeforeExtraction" ? "TAR_MISMATCH" : "WRONG_KEY");
  };
  return { calls, decryptAndAuthenticate: call("decryptAndAuthenticate"),
    verifyStorageTarBeforeExtraction: call("verifyStorageTarBeforeExtraction"),
    restoreGlobals: call("restoreGlobals"), restoreFreshDatabase: call("restoreFreshDatabase"),
    verifyAuthRolesRlsSchemaMigrations: call("verifyAuthRolesRlsSchemaMigrations"),
    verifyStorageMetadataAndBytes: call("verifyStorageMetadataAndBytes"),
    cleanup: call("cleanup") };
}
async function run(f, options = {}) {
  const a = options.adapter ?? adapter();
  const result = await runSyntheticRestoreContract({ receiptPath: f.receiptPath,
    expected: f.expected, target: options.target ?? f.target,
    forbiddenRoots: options.forbiddenRoots ?? [f.source],
    adapter: a, proof: options.proof ?? proof(), availableBytes: options.availableBytes ?? enough,
    deadlineAt: options.deadlineAt });
  return { result, calls: a.calls };
}

test("exact five synthetic ciphertexts and ordered restore contract", async () => {
  const f = fixture();
  try {
    const verified = await verifyComponentCiphertexts(f.receiptPath, { ...f.expected, availableBytes: enough });
    assert.equal(verified.status, "CIPHERTEXT_SET_VERIFIED_NOT_DECRYPTED");
    const { result, calls } = await run(f);
    assert.equal(result.status, "SYNTHETIC_COMPONENT_RESTORE_CONTRACT_PASS");
    assert.equal(result.independentRestore, "NOT_RUN_ON_REAL_DATA");
    assert.deepEqual(calls, ["decryptAndAuthenticate", "verifyStorageTarBeforeExtraction", "restoreGlobals",
      "restoreFreshDatabase", "restoreFreshDatabase", "restoreFreshDatabase",
      "verifyAuthRolesRlsSchemaMigrations", "verifyStorageMetadataAndBytes", "cleanup"]);
    assert.equal(existsSync(join(f.target, ".synthetic-restore.lock")), false);
  } finally { f.cleanup(); }
});

for (const [name, mutate] of [
  ["receipt scope", f => { f.receipt.scope = "original-isolated-development"; f.saveReceipt(); }],
  ["recipient pin", f => { f.receipt.publicRecipientSha256 = "0".repeat(64); f.saveReceipt(); }],
  ["missing component", f => { f.receipt.components.pop(); f.saveReceipt(); }],
  ["duplicate component", f => { f.receipt.components[1].id = f.receipt.components[0].id; f.saveReceipt(); }],
  ["size", f => { f.receipt.components[0].ciphertextBytes++; f.saveReceipt(); }],
  ["hash", f => { f.receipt.components[0].ciphertextSha256 = "0".repeat(64); f.saveReceipt(); }],
  ["total cap", f => { f.receipt.totalEncryptedBytes = MAX_ENCRYPTED_BYTES + 1; f.saveReceipt(); }],
  ["archive tamper", f => { const p = join(f.source, "postgres.age"), b = readFileSync(p); b[b.length - 1] ^= 1; writeFileSync(p, b); }],
  ["symlink", f => { const p = join(f.source, "postgres.age"), copy = join(f.source, "copy.age");
    writeFileSync(copy, readFileSync(p), { mode: 0o600, flag: "wx" }); rmSync(p); symlinkSync(copy, p); }],
  ["world readable", f => chmodSync(join(f.source, "postgres.age"), 0o644)],
]) test(`fail closed on ${name}`, async () => {
  const f = fixture();
  try { mutate(f); const { result, calls } = await run(f);
    assert.equal(result.status, "BLOCKED");
    assert.deepEqual(calls, ["cleanup"]);
    assert.equal(existsSync(join(f.target, ".synthetic-restore.lock")), false);
  } finally { f.cleanup(); }
});

for (const [name, options] of [
  ["unencrypted target", { proof: { ...proof(), encrypted: false } }],
  ["IPv4 egress", { proof: { ...proof(), ipv4EgressProbeDenied: false } }],
  ["IPv6 egress", { proof: { ...proof(), ipv6EgressProbeDenied: false } }],
  ["DNS egress", { proof: { ...proof(), dnsResolutionProbeDenied: false } }],
  ["host mount", { proof: { ...proof(), noHostMounts: false } }],
  ["stale target proof", { proof: { ...proof(), checkedAtMs: Date.now() - 90_000 } }],
  ["free floor", { availableBytes: () => MIN_INTERNAL_FREE_BYTES + MAX_ENCRYPTED_BYTES - 1 }],
  ["deadline", { deadlineAt: Date.now() - 1 }],
]) test(`fail closed on ${name}`, async () => {
  const f = fixture();
  try { const { result, calls } = await run(f, options);
    assert.equal(result.status, "BLOCKED");
    assert.deepEqual(calls, ["cleanup"]);
  } finally { f.cleanup(); }
});

test("source/target alias is denied", async () => {
  const f = fixture();
  try { const { result } = await run(f, { target: f.source });
    assert.equal(result.reason, "RESTORE_TARGET_SOURCE_ALIAS");
  } finally { f.cleanup(); }
});

test("an existing lock is preserved and denies a second run", async () => {
  const f = fixture();
  try {
    writeFileSync(join(f.target, ".synthetic-restore.lock"), "preexisting", { mode: 0o600, flag: "wx" });
    const { result } = await run(f);
    assert.equal(result.status, "BLOCKED");
    assert.equal(readFileSync(join(f.target, ".synthetic-restore.lock"), "utf8"), "preexisting");
  } finally { f.cleanup(); }
});

for (const failureAt of ["decryptAndAuthenticate", "verifyStorageTarBeforeExtraction", "restoreFreshDatabase"]) {
  test(`adapter ${failureAt} failure blocks and cleans`, async () => {
    const f = fixture();
    try { const { result, calls } = await run(f, { adapter: adapter(failureAt) });
      assert.equal(result.status, "BLOCKED");
      assert.equal(calls.at(-1), "cleanup");
      assert.equal(existsSync(join(f.target, ".synthetic-restore.lock")), false);
      if (failureAt === "verifyStorageTarBeforeExtraction") assert.ok(!calls.includes("restoreGlobals"));
    } finally { f.cleanup(); }
  });
}

function controllerAdapter(failAt, cleanupPass = true) {
  const calls = [];
  const step = (name, value) => async () => {
    calls.push(name);
    if (name === failAt) throw new Error(name === "restoreAll" ? "POST_GLOBALS_FAILURE" :
      name === "decryptAndAuthenticate" ? "WRONG_KEY" : "CORRUPT_CONTENT");
    return value;
  };
  return { calls, decryptAndAuthenticate: step("decryptAndAuthenticate"),
    verifyStorageTarBeforeExtraction: step("verifyStorageTarBeforeExtraction"),
    restoreAll: step("restoreAll", { globals: true,
      databases: Object.keys(COMPONENT_FILES).filter(id => id.startsWith("database:")), storage: true }),
    verifyRestoredState: step("verifyRestoredState", { auth: true, roles: true,
      rls: true, migrations: true, metadataBytes: true }),
    stopAndCleanup: step("stopAndCleanup", { noActiveRestoreTarget: cleanupPass,
      guestPlaintextStageRemoved: cleanupPass }) };
}
async function runController(f, options = {}) {
  const a = options.adapter ?? controllerAdapter();
  const result = await runGuardedComponentRestore({ receiptPath: f.receiptPath,
    expected: f.expected, target: options.target ?? f.target,
    forbiddenRoots: [f.source], adapter: a,
    measureFreshIsolation: options.measureFreshIsolation ?? (async () => proof()),
    availableBytes: enough, deadlineAt: options.deadlineAt });
  return { result, calls: a.calls };
}

test("guarded synthetic controller orders authenticated restore and verifies cleanup", async () => {
  const f = fixture();
  try {
    const { result, calls } = await runController(f);
    assert.equal(result.status, "SYNTHETIC_CONTROLLER_PASS");
    assert.equal(result.independentRestore, "NOT_RUN_ON_REAL_DATA");
    assert.deepEqual(calls, ["decryptAndAuthenticate", "verifyStorageTarBeforeExtraction",
      "restoreAll", "verifyRestoredState", "stopAndCleanup"]);
    assert.equal(existsSync(join(f.target, ".component-restore.lock")), false);
  } finally { f.cleanup(); }
});

for (const failAt of ["decryptAndAuthenticate", "verifyStorageTarBeforeExtraction", "restoreAll"]) {
  test(`guarded synthetic controller denies ${failAt} failure`, async () => {
    const f = fixture();
    try {
      const { result, calls } = await runController(f, { adapter: controllerAdapter(failAt) });
      assert.equal(result.status, "NO_GO");
      assert.equal(calls.at(-1), "stopAndCleanup");
      assert.ok(!calls.includes("verifyRestoredState"));
      assert.equal(existsSync(join(f.target, ".component-restore.lock")), false);
    } finally { f.cleanup(); }
  });
}

test("guarded synthetic controller rejects receipt mismatch before decrypt", async () => {
  const f = fixture();
  try {
    f.receipt.totalEncryptedBytes++;
    f.saveReceipt();
    const { result, calls } = await runController(f);
    assert.equal(result.status, "NO_GO");
    assert.deepEqual(calls, ["stopAndCleanup"]);
  } finally { f.cleanup(); }
});

test("guarded synthetic controller rejects source-target alias", async () => {
  const f = fixture();
  try {
    const { result } = await runController(f, { target: f.source });
    assert.equal(result.reason, "RESTORE_TARGET_SOURCE_ALIAS");
  } finally { f.cleanup(); }
});

test("guarded synthetic controller fails closed on cleanup uncertainty", async () => {
  const f = fixture();
  try {
    const { result } = await runController(f, { adapter: controllerAdapter(null, false) });
    assert.equal(result.reason, "RESTORE_CLEANUP_UNVERIFIED");
    assert.equal(result.status, "NO_GO");
  } finally { f.cleanup(); }
});

test("guarded synthetic controller fails closed on cleanup exception", async () => {
  const f = fixture();
  try {
    const a = controllerAdapter();
    a.stopAndCleanup = async () => { throw new Error("DETACH_FAILED"); };
    const { result } = await runController(f, { adapter: a });
    assert.equal(result.reason, "RESTORE_CLEANUP_UNVERIFIED");
    assert.equal(existsSync(join(f.target, ".component-restore.lock")), false);
  } finally { f.cleanup(); }
});

test("guarded synthetic controller fails closed on residual plaintext", async () => {
  const f = fixture();
  try {
    writeFileSync(join(f.target, "residual.dump"), "synthetic-only", { mode: 0o600 });
    const { result } = await runController(f);
    assert.equal(result.reason, "RESTORE_CLEANUP_UNVERIFIED");
  } finally { f.cleanup(); }
});

test("guarded controller CLI has no real-data mode", () => {
  const result = spawnSync(process.execPath,
    [join(dirname(fileURLToPath(import.meta.url)), "component-restore-controller.mjs")],
    { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /REAL_RESTORE_ADAPTER_NOT_IMPLEMENTED/);
});

test("guarded synthetic controller requires a fresh isolation measurement", async () => {
  const f = fixture();
  try {
    const { result, calls } = await runController(f, {
      measureFreshIsolation: async () => ({ ...proof(), checkedAtMs: Date.now() - 90_000 }),
    });
    assert.equal(result.status, "NO_GO");
    assert.deepEqual(calls, ["stopAndCleanup"]);
  } finally { f.cleanup(); }
});
