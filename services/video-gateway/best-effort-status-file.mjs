import { randomUUID } from "node:crypto";
import { renameSync, unlinkSync, writeFileSync } from "node:fs";

// Runtime status snapshots are observability, not ownership of the live media
// process. Preserve the last complete snapshot and report a bounded failure to
// the caller when the local disk cannot accept a newer one. In particular,
// ENOSPC/EDQUOT must never terminate the Gateway or Connector supervisor.
export function writeBestEffortStatusJson(destination, value, {
  write = writeFileSync,
  rename = renameSync,
  unlink = unlinkSync,
  nonce = randomUUID
} = {}) {
  const temporary = `${destination}.${process.pid}.${nonce()}.tmp`;
  try {
    write(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    rename(temporary, destination);
    return { ok: true, error_code: null };
  } catch (error) {
    try { unlink(temporary); } catch {}
    return { ok: false,
      error_code: String(error?.code || error?.name || "STATUS_WRITE_FAILED") };
  }
}
