import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export const defaultJournalOwnerLockPath = () => process.env.GAN_BATUACH_JOURNAL_OWNER_LOCK_PATH
  || join(homedir(), ".local", "share", "gan-batuach", "video-gateway", "journal-owner.lock");

function activePid(pid, isProcessAlive) {
  return Number.isInteger(pid) && pid > 0 && isProcessAlive(pid);
}

function readOwner(lockPath) {
  try { return JSON.parse(readFileSync(lockPath, "utf8")); } catch { return null; }
}

/** One durable Journal/outbox owner prevents two Gateway runners from emitting
 * independent event IDs for the same physical observation. */
export function acquireJournalOwnerLock({ lockPath = defaultJournalOwnerLockPath(), pid = process.pid,
  isProcessAlive = candidate => { try { process.kill(candidate, 0); return true; } catch { return false; } } } = {}) {
  mkdirSync(dirname(lockPath), { recursive: true, mode: 0o700 });
  const token = randomUUID();
  const write = () => {
    const fd = openSync(lockPath, "wx", 0o600);
    try { writeFileSync(fd, JSON.stringify({ pid, token, started_at: new Date().toISOString() })); }
    finally { closeSync(fd); }
    return () => {
      const owner = existsSync(lockPath) ? readOwner(lockPath) : null;
      if (owner?.token === token) unlinkSync(lockPath);
    };
  };
  try { return write(); }
  catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const owner = readOwner(lockPath);
    if (activePid(owner?.pid, isProcessAlive)) throw new Error("journal_owner_already_active");
    // A stale lock cannot permanently disable the local safety runtime.
    unlinkSync(lockPath);
    return write();
  }
}
