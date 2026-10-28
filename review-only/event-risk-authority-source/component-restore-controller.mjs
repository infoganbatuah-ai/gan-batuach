// Review-only orchestration boundary. The only wired adapter is synthetic.
// This file has no real-data CLI and never reads an owner identity.
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { acquireCaptureLock } from "./component-backup-contract.mjs";
import { assertDisjointTarget, assertFreshIsolatedTarget, COMPONENT_FILES,
  verifyComponentCiphertexts } from "./component-restore-preflight.mjs";

const expectedDatabaseIds = Object.keys(COMPONENT_FILES).filter(id => id.startsWith("database:")).sort();
const safeReason = error => /^[A-Z][A-Z0-9_]{4,100}$/.test(String(error?.message))
  ? error.message : "RESTORE_CONTROLLER_FAILED";

function requireDeadline(deadlineAt) {
  assert.ok(Number.isSafeInteger(deadlineAt) && Date.now() < deadlineAt,
    "RESTORE_CONTROLLER_DEADLINE");
}

export async function runGuardedComponentRestore({ receiptPath, expected, target,
  forbiddenRoots = [], measureFreshIsolation, adapter,
  availableBytes, deadlineAt = Date.now() + 180_000 }) {
  let lock;
  let result = { status: "NO_GO", reason: "RESTORE_NOT_STARTED",
    independentRestore: "NOT_RUN_ON_REAL_DATA", atomicSnapshot: false };
  try {
    requireDeadline(deadlineAt);
    assertDisjointTarget(target, [dirname(receiptPath), ...forbiddenRoots]);
    for (const method of ["decryptAndAuthenticate", "verifyStorageTarBeforeExtraction",
      "restoreAll", "verifyRestoredState", "stopAndCleanup"]) {
      assert.equal(typeof adapter?.[method], "function", "RESTORE_ADAPTER_INCOMPLETE");
    }
    assert.equal(typeof measureFreshIsolation, "function", "RESTORE_PROOF_PROVIDER_MISSING");
    const proof = await measureFreshIsolation();
    assertFreshIsolatedTarget(proof);
    requireDeadline(deadlineAt);
    lock = acquireCaptureLock(join(target, ".component-restore.lock"));
    const checked = await verifyComponentCiphertexts(receiptPath, {
      ...expected, availableBytes, deadlineAt,
    });
    assert.deepEqual(checked.components, Object.keys(COMPONENT_FILES).sort(),
      "RESTORE_COMPONENT_SET_MISMATCH");
    requireDeadline(deadlineAt);
    await adapter.decryptAndAuthenticate(checked, { deadlineAt, target });
    requireDeadline(deadlineAt);
    await adapter.verifyStorageTarBeforeExtraction(checked, { deadlineAt, target });
    requireDeadline(deadlineAt);
    const restored = await adapter.restoreAll(checked, { deadlineAt, target });
    assert.equal(restored?.globals, true, "RESTORE_GLOBALS_UNVERIFIED");
    assert.deepEqual(restored?.databases?.slice().sort(), expectedDatabaseIds,
      "RESTORE_DATABASE_SET_UNVERIFIED");
    assert.equal(restored?.storage, true, "RESTORE_STORAGE_UNVERIFIED");
    requireDeadline(deadlineAt);
    const verified = await adapter.verifyRestoredState(checked, { deadlineAt, target });
    for (const field of ["auth", "roles", "rls", "migrations", "metadataBytes"]) {
      assert.equal(verified?.[field], true, `RESTORE_${field.toUpperCase()}_UNVERIFIED`);
    }
    requireDeadline(deadlineAt);
    result = { status: "SYNTHETIC_CONTROLLER_PASS", reason: null,
      independentRestore: "NOT_RUN_ON_REAL_DATA", atomicSnapshot: false };
  } catch (error) {
    result = { status: "NO_GO", reason: safeReason(error),
      independentRestore: "NOT_RUN_ON_REAL_DATA", atomicSnapshot: false };
  } finally {
    let cleaned = false;
    try {
      const cleanup = await adapter?.stopAndCleanup?.();
      cleaned = cleanup?.noActiveRestoreTarget === true && cleanup?.guestPlaintextStageRemoved === true;
    } catch { cleaned = false; }
    try { lock?.release(); } catch { cleaned = false; }
    if (lock) {
      try {
        if (readdirSync(target).some(name => name !== ".synthetic-only")) cleaned = false;
      } catch { cleaned = false; }
    }
    if (!cleaned) result = { status: "NO_GO", reason: "RESTORE_CLEANUP_UNVERIFIED",
      independentRestore: "NOT_RUN_ON_REAL_DATA", atomicSnapshot: false };
  }
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stderr.write("REAL_RESTORE_ADAPTER_NOT_IMPLEMENTED\n");
  process.exitCode = 2;
}
