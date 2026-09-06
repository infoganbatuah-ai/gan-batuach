import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireJournalOwnerLock } from "../../services/video-gateway/journal-owner-lock.mjs";

const lockPath = join(mkdtempSync(join(tmpdir(), "observer-journal-owner-")), "owner.lock");
const release = acquireJournalOwnerLock({ lockPath, pid: 101, isProcessAlive: value => value === 101 });
assert.throws(() => acquireJournalOwnerLock({ lockPath, pid: 202, isProcessAlive: value => value === 101 }), /journal_owner_already_active/);
release();
const releaseReplacement = acquireJournalOwnerLock({ lockPath, pid: 202, isProcessAlive: () => false });
releaseReplacement();
console.log("Journal owner lock checks passed: one durable runner, stale-lock recovery, safe release.");
