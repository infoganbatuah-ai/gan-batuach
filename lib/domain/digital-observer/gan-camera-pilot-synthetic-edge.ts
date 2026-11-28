import "server-only";
import { createHash, sign, type KeyObject } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  ganCameraPilotLimits,
  type GanCameraPilotGrantStore,
  type GanCameraPilotScope
} from "./gan-camera-pilot-grant";

const maxChunkBytes = 1024 * 1024;
const evidenceLifetimeMs = 10 * 60_000;
const handlePattern = /^[A-Za-z0-9_-]{32,128}$/;
const shaPattern = /^[a-f0-9]{40}$/;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

// The trusted resolver supplies every dimension. An ordered encoding makes
// comparisons stable even when resolver and client property order differ.
function scopeHash(scope: GanCameraPilotScope) {
  return digest(JSON.stringify([scope.gardenId, scope.siteId, scope.tenantId, scope.cameraId,
    scope.sourceId, scope.gatewayId, scope.streamId, scope.viewerId, scope.role, scope.sessionId, scope.protocol]));
}

type WindowRow = {
  window_id: string;
  scope: string;
  deadline: number;
  clock: number;
  lease: string | null;
  stopped: string | null;
  reserved: number;
  delivered: number;
  frames: number;
  last_frame: number;
};

type Options = {
  databasePath: string;
  windowId: string;
  scope: GanCameraPilotScope;
  deadlineMs: number;
  now?: () => number;
};

// Local synthetic QA only. All instances must share one SQLite file on the
// same host. There is deliberately no network listener or real media adapter.
export function openGanCameraPilotSyntheticEdge({ databasePath, windowId, scope, deadlineMs, now = Date.now }: Options) {
  const at = now();
  if (!databasePath.startsWith("/") || !handlePattern.test(windowId) || !Number.isSafeInteger(at) ||
      !Number.isSafeInteger(deadlineMs) || deadlineMs - at > ganCameraPilotLimits.durationSeconds * 1000) {
    throw new Error("INVALID_SYNTHETIC_WINDOW");
  }
  const expectedScope = scopeHash(scope);
  const db = new DatabaseSync(databasePath);
  function transaction<T>(operation: () => T): T {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  const read = () => db.prepare("SELECT * FROM pilot_window WHERE id = 1").get() as WindowRow | undefined;
  const stop = (reason: string) => db.prepare("UPDATE pilot_window SET stopped = COALESCE(stopped, ?) WHERE id = 1").run(reason);
  try {
    db.exec(`PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS pilot_window (
        id INTEGER PRIMARY KEY CHECK(id = 1), window_id TEXT NOT NULL, scope TEXT NOT NULL, deadline INTEGER NOT NULL,
        clock INTEGER NOT NULL, lease TEXT, stopped TEXT, reserved INTEGER NOT NULL DEFAULT 0,
        delivered INTEGER NOT NULL DEFAULT 0, frames INTEGER NOT NULL DEFAULT 0, last_frame INTEGER NOT NULL DEFAULT -1
      ) STRICT;
      CREATE TABLE IF NOT EXISTS pilot_grants (
        handle TEXT PRIMARY KEY, jti TEXT NOT NULL UNIQUE, expires INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0
      ) STRICT;`);
    transaction(() => {
      const previous = read();
      if (!previous && deadlineMs > at) {
        db.prepare("INSERT INTO pilot_window (id, window_id, scope, deadline, clock) VALUES (1, ?, ?, ?, ?)")
          .run(windowId, expectedScope, deadlineMs, at);
      } else if (!previous || previous.window_id !== windowId || previous.scope !== expectedScope || previous.deadline !== deadlineMs) {
        throw new Error("SYNTHETIC_WINDOW_MISMATCH");
      }
    });
  } catch (error) {
    db.close();
    throw error;
  }

  function active() {
    const row = read();
    if (!row || row.stopped) return null;
    const current = now();
    if (!Number.isSafeInteger(current) || current < row.clock) {
      stop("CLOCK"); return null;
    }
    if (current >= row.deadline) {
      stop("DEADLINE"); return null;
    }
    db.prepare("UPDATE pilot_window SET clock = ? WHERE id = 1").run(current);
    return { ...row, clock: current };
  }

  const store: GanCameraPilotGrantStore = {
    async issue(record, jti) {
      if (!handlePattern.test(record.handle) || !handlePattern.test(jti) || scopeHash(record.scope) !== expectedScope) return false;
      return transaction(() => {
        const row = active();
        if (!row || row.lease || !Number.isSafeInteger(record.expiresAtMs) ||
            record.expiresAtMs <= row.clock || record.expiresAtMs > row.deadline) return false;
        return db.prepare("INSERT OR IGNORE INTO pilot_grants (handle, jti, expires) VALUES (?, ?, ?)")
          .run(digest(record.handle), digest(jti), record.expiresAtMs).changes === 1;
      });
    },
    async consume(handle, requestedScope, assertionExpiresAtMs) {
      if (!handlePattern.test(handle) || scopeHash(requestedScope) !== expectedScope || !Number.isSafeInteger(assertionExpiresAtMs)) return null;
      return transaction(() => {
        const row = active();
        if (!row || row.lease || assertionExpiresAtMs <= row.clock) return null;
        const key = digest(handle);
        const grant = db.prepare("SELECT expires FROM pilot_grants WHERE handle = ? AND revoked = 0 AND expires > ?")
          .get(key, row.clock) as { expires: number } | undefined;
        if (!grant) return null;
        db.prepare("UPDATE pilot_window SET lease = ? WHERE id = 1").run(key);
        return { scope: requestedScope, handle, expiresAtMs: grant.expires };
      });
    },
    async revoke(handle) { revokeKnownHandle(handle); }
  };

  function revokeKnownHandle(handle: string) {
    if (!handlePattern.test(handle)) return false;
    return transaction(() => {
      const key = digest(handle);
      const result = db.prepare("UPDATE pilot_grants SET revoked = 1 WHERE handle = ?").run(key);
      if (read()?.lease === key) stop("REVOKED");
      return result.changes === 1;
    });
  }

  function transportAllowed(handle: string, requestedScope: GanCameraPilotScope) {
    if (!handlePattern.test(handle) || scopeHash(requestedScope) !== expectedScope) return false;
    try {
      return transaction(() => {
        const row = active();
        if (!row || row.lease !== digest(handle)) return false;
        if (row.reserved >= ganCameraPilotLimits.cumulativeBytes) {
          stop("BYTE_LIMIT");
          return false;
        }
        return true;
      });
    }
    catch { return false; }
  }

  // Charge the encrypted byte stream at the serving boundary, independently
  // of frame observations or the publisher's bitrate. Never refund a write.
  function reserveTransportBytes(handle: string, requestedScope: GanCameraPilotScope, bytes: number) {
    if (!handlePattern.test(handle) || scopeHash(requestedScope) !== expectedScope || !Number.isSafeInteger(bytes) ||
        bytes < 1 || bytes > maxChunkBytes) return false;
    try {
      return transaction(() => {
        const row = active();
        if (!row || row.lease !== digest(handle)) return false;
        if (row.reserved + bytes > ganCameraPilotLimits.cumulativeBytes) {
          stop("BYTE_LIMIT"); return false;
        }
        db.prepare("UPDATE pilot_window SET reserved = reserved + ? WHERE id = 1").run(bytes);
        return true;
      });
    } catch {
      try { transaction(() => stop("ACCOUNTING_OR_SINK")); } catch { /* An unavailable store cannot reserve bytes. */ }
      return false;
    }
  }

  function deliverSyntheticChunk({ handle, scope: requestedScope, payload, sequence, write }: {
    handle: string; scope: GanCameraPilotScope; payload: Buffer; sequence: number;
    write: (bytes: Buffer) => boolean;
  }) {
    if (!handlePattern.test(handle) || scopeHash(requestedScope) !== expectedScope || !Buffer.isBuffer(payload) ||
        payload.length < 1 || payload.length > maxChunkBytes || !Number.isSafeInteger(sequence) || sequence < 0) return false;
    const key = digest(handle);
    try {
      // Commit the reservation before transfer. Crashes and failed writes
      // never return bytes to the budget.
      const reserved = transaction(() => {
        const row = active();
        if (!row || row.lease !== key || sequence <= row.last_frame) return false;
        if (row.reserved + payload.length > ganCameraPilotLimits.cumulativeBytes) {
          stop("BYTE_LIMIT"); return false;
        }
        db.prepare("UPDATE pilot_window SET reserved = reserved + ? WHERE id = 1").run(payload.length);
        return true;
      });
      if (!reserved) return false;
      return transaction(() => {
        const row = active();
        if (!row || row.lease !== key || sequence <= row.last_frame) return false;
        // This is a synchronous synthetic sink. An external transport must
        // integrate cancellation, bounded writes and its own accounting.
        if (write(payload) !== true) {
          stop("SINK"); return false;
        }
        db.prepare("UPDATE pilot_window SET delivered = delivered + ?, frames = frames + 1, last_frame = ? WHERE id = 1")
          .run(payload.length, sequence);
        if (row.delivered + payload.length === ganCameraPilotLimits.cumulativeBytes) stop("BYTE_LIMIT");
        return true;
      });
    } catch {
      try { transaction(() => stop("ACCOUNTING_OR_SINK")); } catch { /* Unavailable store denies all further writes. */ }
      return false;
    }
  }

  function signSyntheticEvidence(commit: string, key: KeyObject) {
    const row = read();
    if (!row?.stopped || !shaPattern.test(commit) || key.type !== "private" || key.asymmetricKeyType !== "ed25519") return null;
    const recordedAtMs = now();
    const expiresAtMs = row.clock + evidenceLifetimeMs;
    if (!Number.isSafeInteger(recordedAtMs) || recordedAtMs < row.clock || recordedAtMs >= expiresAtMs) return null;
    const evidence = { version: 1, kind: "gan_camera_pilot_synthetic", environment: "development",
      playbackQualified: false, commit, windowId, scopeDigest: expectedScope, deadlineMs,
      recordedAtMs, expiresAtMs, stopped: row.stopped,
      bytesReserved: row.reserved, bytesDelivered: row.delivered, syntheticFrames: row.frames, lastSequence: row.last_frame };
    const payload = Buffer.from(JSON.stringify(evidence)).toString("base64url");
    return `${payload}.${sign(null, Buffer.from(payload), key).toString("base64url")}`;
  }

  return { store, revokeKnownHandle, transportAllowed, reserveTransportBytes, deliverSyntheticChunk, signSyntheticEvidence, close: () => db.close() };
}
