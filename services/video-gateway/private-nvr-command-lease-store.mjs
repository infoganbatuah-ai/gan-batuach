import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const SHA256 = /^[a-f0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalid(code) {
  throw Object.assign(new Error(code), { code });
}

export function createDurablePrivateNvrCommandLeaseStore({ databasePath, database, now = Date.now } = {}) {
  if (!database && typeof databasePath !== "string") invalid("lease_database_required");
  const db = database || new DatabaseSync(databasePath);
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(`CREATE TABLE IF NOT EXISTS private_nvr_command_leases (
    lease_key TEXT PRIMARY KEY,
    lease_id TEXT NOT NULL,
    owner TEXT NOT NULL,
    acquired_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  ) STRICT`);
  const purge = db.prepare("DELETE FROM private_nvr_command_leases WHERE expires_at <= ?");
  const current = db.prepare("SELECT lease_id, owner, expires_at FROM private_nvr_command_leases WHERE lease_key = ?");
  const insert = db.prepare("INSERT INTO private_nvr_command_leases (lease_key, lease_id, owner, acquired_at, expires_at) VALUES (?, ?, ?, ?, ?)");
  const release = db.prepare("DELETE FROM private_nvr_command_leases WHERE lease_key = ? AND lease_id = ? AND owner = ?");

  return Object.freeze({
    async acquire({ key, owner, ttl_ms }) {
      if (!SHA256.test(key || "") || !UUID.test(owner || "") || !Number.isInteger(ttl_ms) || ttl_ms < 1_000 || ttl_ms > 60_000) invalid("invalid_lease_request");
      const at = now();
      db.exec("BEGIN IMMEDIATE");
      try {
        purge.run(at);
        const held = current.get(key);
        if (held) {
          db.exec("COMMIT");
          return { status: "busy", expires_at: held.expires_at };
        }
        const leaseId = randomUUID();
        insert.run(key, leaseId, owner, at, at + ttl_ms);
        db.exec("COMMIT");
        return { status: "acquired", lease_id: leaseId, expires_at: at + ttl_ms };
      } catch (error) {
        try { db.exec("ROLLBACK"); } catch {}
        throw error;
      }
    },
    async release({ key, owner, lease_id }) {
      if (!SHA256.test(key || "") || !UUID.test(owner || "") || !UUID.test(lease_id || "")) invalid("invalid_lease_release");
      return { released: release.run(key, lease_id, owner).changes === 1 };
    },
    close() {
      if (!database) db.close();
    }
  });
}
