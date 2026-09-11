import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const HA_COORDINATION_CONTRACT = "observer-ha-coordination-v1";
const required = (value, name) => { if (typeof value !== "string" || !value || value.length > 200) throw new Error(`ha_coordination_${name}_invalid`); return value; };

export function createSqliteHaCoordinationStore({ databasePath, now = Date.now } = {}) {
  required(databasePath, "database_path"); mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(databasePath); db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;");
  db.exec(`CREATE TABLE IF NOT EXISTS ha_leases(resource_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, epoch INTEGER NOT NULL, expires_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS ha_effects(effect_key TEXT PRIMARY KEY, resource_id TEXT NOT NULL, epoch INTEGER NOT NULL, owner_id TEXT NOT NULL, effect_type TEXT NOT NULL, payload_digest TEXT, completed_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS ha_audit(id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, category TEXT NOT NULL, resource_id TEXT, owner_id TEXT, epoch INTEGER, detail TEXT);`);
  try { chmodSync(databasePath, 0o600); } catch {}
  const audit = (category, resourceId, ownerId, epoch, detail = null) => db.prepare("INSERT INTO ha_audit(at,category,resource_id,owner_id,epoch,detail) VALUES(?,?,?,?,?,?)").run(now(), category, resourceId, ownerId, epoch, detail);
  function acquire({ resourceId, ownerId, leaseMs = 30_000 }) {
    required(resourceId, "resource_id"); required(ownerId, "owner_id"); const ttl = Math.max(100, Math.min(300_000, Number(leaseMs)));
    db.exec("BEGIN IMMEDIATE");
    try {
      const current = db.prepare("SELECT * FROM ha_leases WHERE resource_id=?").get(resourceId);
      if (current && Number(current.expires_at) > now() && current.owner_id !== ownerId) { db.exec("COMMIT"); return { acquired: false, resource_id: resourceId, owner_id: current.owner_id, epoch: Number(current.epoch), expires_at: Number(current.expires_at) }; }
      const epoch = current ? Number(current.epoch) + (current.owner_id === ownerId && Number(current.expires_at) > now() ? 0 : 1) : 1;
      db.prepare("INSERT INTO ha_leases(resource_id,owner_id,epoch,expires_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(resource_id) DO UPDATE SET owner_id=excluded.owner_id,epoch=excluded.epoch,expires_at=excluded.expires_at,updated_at=excluded.updated_at").run(resourceId, ownerId, epoch, now() + ttl, now());
      db.exec("COMMIT"); audit("LEASE_ACQUIRED", resourceId, ownerId, epoch); return { acquired: true, resource_id: resourceId, owner_id: ownerId, epoch, expires_at: now() + ttl };
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  function current(resourceId) { const row = db.prepare("SELECT * FROM ha_leases WHERE resource_id=?").get(resourceId); return row ? { resource_id: row.resource_id, owner_id: row.owner_id, epoch: Number(row.epoch), expires_at: Number(row.expires_at), active: Number(row.expires_at) > now() } : null; }
  function assertFence({ resourceId, ownerId, epoch }) {
    const lease = current(resourceId);
    if (!lease?.active || lease.owner_id !== ownerId || lease.epoch !== Number(epoch)) throw new Error("ha_fencing_token_rejected");
    return lease;
  }
  function renew({ resourceId, ownerId, epoch, leaseMs = 30_000 }) {
    assertFence({ resourceId, ownerId, epoch }); const ttl = Math.max(100, Math.min(300_000, Number(leaseMs)));
    const changed = db.prepare("UPDATE ha_leases SET expires_at=?,updated_at=? WHERE resource_id=? AND owner_id=? AND epoch=? AND expires_at>?").run(now() + ttl, now(), resourceId, ownerId, Number(epoch), now());
    if (!changed.changes) throw new Error("ha_fencing_token_rejected"); audit("LEASE_RENEWED", resourceId, ownerId, Number(epoch)); return { renewed: true, expires_at: now() + ttl };
  }
  function executeOnce({ resourceId, ownerId, epoch, effectKey, effectType, payloadDigest = null }) {
    assertFence({ resourceId, ownerId, epoch }); required(effectKey, "effect_key"); required(effectType, "effect_type");
    const existing = db.prepare("SELECT * FROM ha_effects WHERE effect_key=?").get(effectKey);
    if (existing) return { accepted: false, duplicate: true, epoch: Number(existing.epoch), owner_id: existing.owner_id };
    db.exec("BEGIN IMMEDIATE");
    try {
      assertFence({ resourceId, ownerId, epoch });
      const result = db.prepare("INSERT OR IGNORE INTO ha_effects(effect_key,resource_id,epoch,owner_id,effect_type,payload_digest,completed_at) VALUES(?,?,?,?,?,?,?)").run(effectKey, resourceId, Number(epoch), ownerId, effectType, payloadDigest, now());
      db.exec("COMMIT"); if (result.changes) audit("EFFECT_ACCEPTED", resourceId, ownerId, Number(epoch), effectType); return { accepted: Boolean(result.changes), duplicate: !result.changes, epoch: Number(epoch), owner_id: ownerId };
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  function snapshot() { const leases = db.prepare("SELECT * FROM ha_leases ORDER BY resource_id").all().map(row => ({ ...row, epoch: Number(row.epoch), expires_at: Number(row.expires_at), active: Number(row.expires_at) > now() })); const effects = Number(db.prepare("SELECT count(*) n FROM ha_effects").get().n); const auditCounts = Object.fromEntries(db.prepare("SELECT category,count(*) n FROM ha_audit GROUP BY category").all().map(row => [row.category, Number(row.n)])); return { contract: HA_COORDINATION_CONTRACT, backend: "SQLITE_WAL_LOCAL_MULTI_PROCESS", evidence_level: "LOCAL_MULTI_NODE", multi_host: false, leases, effects, audit: auditCounts }; }
  function close() { db.close(); }
  return Object.freeze({ contract: HA_COORDINATION_CONTRACT, acquire, renew, current, assertFence, executeOnce, snapshot, close });
}
