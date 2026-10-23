import { constants, openSync, closeSync, writeSync, fsyncSync, lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { assertCh1Delegation } from "./push44-ch1-private-media.mjs";

// Metadata only. Caller must supply an owner-protected, ownership-enforcing
// directory. This module never creates a directory or changes volume settings.
export function createCh1OperatorJournal(directory) {
  const root = resolve(directory), uid = process.getuid?.();
  const info = lstatSync(root);
  if (uid === undefined || info.isSymbolicLink() || !info.isDirectory() || info.uid !== uid ||
    (info.mode & 0o077) !== 0) throw new Error("CH1_PROTECTED_DIRECTORY_REQUIRED");
  if (process.platform === "darwin") {
    const df = execFileSync("/bin/df", ["-P", root], { encoding: "utf8", timeout: 5000, stdio: "pipe" });
    const device = df.trim().split("\n").at(-1).trim().split(/\s+/)[0];
    if (!/^\/dev\/disk\d+(?:s\d+)+$/.test(device)) throw new Error("CH1_VOLUME_NOT_QUALIFIED");
    const plist = execFileSync("/usr/sbin/diskutil", ["info", "-plist", device], { timeout: 5000, stdio: "pipe" });
    const enforced = execFileSync("/usr/bin/plutil", ["-extract", "GlobalPermissionsEnabled", "raw", "-o", "-", "-"],
      { input: plist, encoding: "utf8", timeout: 5000, stdio: "pipe" }).trim();
    if (enforced !== "true") throw new Error("CH1_VOLUME_OWNERSHIP_REQUIRED");
  } else if (process.platform !== "linux") throw new Error("CH1_PLATFORM_NOT_QUALIFIED");
  function protectedRead(filename) {
    const path = join(root, filename), stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== uid || (stat.mode & 0o077) !== 0 || stat.size > 8192)
      throw new Error("CH1_PROTECTED_RECORD_REQUIRED");
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { return JSON.parse(readFileSync(fd, "utf8")); } finally { closeSync(fd); }
  }
  function append(filename, value, exclusive = false) {
    const fd = openSync(join(root, filename), constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW |
      (exclusive ? constants.O_EXCL : constants.O_APPEND), 0o600);
    try { writeSync(fd, JSON.stringify(value) + "\n"); fsyncSync(fd); } finally { closeSync(fd); }
  }
  let previous = "0".repeat(64);
  // A run is exclusive. Reopening an old journal is never a restart mechanism.
  const name = "ch1-audit.jsonl";
  append(name, { event: "JOURNAL_CREATED", version: 1 }, true);
  return Object.freeze({
    readDelegation: () => assertCh1Delegation(protectedRead("delegation.json")),
    consumeApproval: approvalId => {
      if (!/^[A-Za-z0-9_-]{16,96}$/.test(approvalId)) return false;
      try {
        append(`consumed-${approvalId}.json`, { approvalId, consumed: true }, true);
        const fd = openSync(root, constants.O_RDONLY);
        try { fsyncSync(fd); } finally { closeSync(fd); }
        return true;
      } catch { return false; }
    },
    audit: event => {
      const keys = ["event", "sourceId", "stopped", "reason", "reservedBytes", "submittedBytes", "requests", "active"];
      if (!event || Object.keys(event).some(key => !keys.includes(key)) ||
        !["CLOSED", "LEASE_CLAIMED", "GRANT_RENEWED", "TRANSFER_RESERVED", "TRANSFER_SUBMITTED"].includes(event.event) ||
        JSON.stringify(event).length > 1024) return false;
      const payload = { ...event, previous };
      const digest = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
      append(name, { ...payload, digest }); previous = digest;
      return true;
    }
  });
}
