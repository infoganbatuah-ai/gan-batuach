import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

const KINDS = new Set(["EVENT", "INCIDENT_INPUT", "EVIDENCE_METADATA", "EVIDENCE_MEDIA", "OPERATIONAL_STATE"]);
const SECRET_KEY = /(password|secret|private.?key|credential|authorization|stream.?url|refresh.?token)/i;

function keyBytes(value) {
  if (!value) throw new Error("offline_queue_key_required");
  return createHash("sha256").update(Buffer.isBuffer(value) ? value : Buffer.from(String(value))).digest();
}
function cleanPayload(value, depth = 0) {
  if (depth > 8) throw new Error("offline_queue_payload_depth");
  if (Array.isArray(value)) return value.map(item => cleanPayload(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [name, item] of Object.entries(value)) {
    if (SECRET_KEY.test(name)) throw new Error("offline_queue_secret_field_rejected");
    output[name] = cleanPayload(item, depth + 1);
  }
  return output;
}
function seal(value, key) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(cleanPayload(value))), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}
function open(value, key) {
  const bytes = Buffer.from(value), decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
}
function bounded(value, fallback, min, max) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback; }

export function createDurableOfflineQueue({ databasePath, encryptionKey, tenantId, siteId, deviceId, now = Date.now, policy = {} }) {
  for (const value of [databasePath, tenantId, siteId, deviceId]) if (typeof value !== "string" || !value) throw new Error("offline_queue_binding_required");
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(databasePath), key = keyBytes(encryptionKey);
  const limits = Object.freeze({ maxRecords: bounded(policy.maxRecords, 10_000, 10, 100_000), maxBytes: bounded(policy.maxBytes, 512 * 1024 * 1024, 1024, 10 * 1024 * 1024 * 1024),
    retentionMs: bounded(policy.retentionMs, 7 * 24 * 60 * 60_000, 60_000, 30 * 24 * 60 * 60_000), batchSize: bounded(policy.batchSize, 20, 1, 100),
    retryBaseMs: bounded(policy.retryBaseMs, 5_000, 100, 60_000), retryMaxMs: bounded(policy.retryMaxMs, 300_000, 1_000, 3_600_000) });
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS offline_queue(
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, schema_version INTEGER NOT NULL, tenant_id TEXT NOT NULL, site_id TEXT NOT NULL, device_id TEXT NOT NULL,
      source_id TEXT, ordering_key TEXT NOT NULL, observed_at INTEGER NOT NULL, queued_at INTEGER NOT NULL, priority INTEGER NOT NULL,
      payload BLOB NOT NULL, payload_bytes INTEGER NOT NULL, state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL DEFAULT 0,
      delivered_at INTEGER, last_error TEXT, UNIQUE(tenant_id,site_id,device_id,id));
    CREATE INDEX IF NOT EXISTS offline_queue_ready ON offline_queue(state,next_attempt_at,priority DESC,queued_at);
    CREATE TABLE IF NOT EXISTS offline_queue_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,at INTEGER NOT NULL,category TEXT NOT NULL,kind TEXT,record_id TEXT,detail TEXT);`);
  try { chmodSync(databasePath, 0o600); } catch {}
  let revoked = false, closed = false, resyncing = false, deliveredCount = 0;
  const audit = (category, kind = null, id = null, detail = null) => {
    db.prepare("INSERT INTO offline_queue_audit(at,category,kind,record_id,detail) VALUES(?,?,?,?,?)").run(now(), category, kind, id, detail);
    db.prepare("DELETE FROM offline_queue_audit WHERE id NOT IN (SELECT id FROM offline_queue_audit ORDER BY id DESC LIMIT 10000)").run();
  };
  function expire() {
    const rows = db.prepare("SELECT id,kind FROM offline_queue WHERE queued_at<? AND state IN ('PENDING','FAILED') LIMIT 100").all(now() - limits.retentionMs);
    for (const row of rows) { audit("RETENTION_EXPIRED_RECORDED", row.kind, row.id, "payload_removed_after_policy_expiry"); db.prepare("DELETE FROM offline_queue WHERE id=?").run(row.id); }
  }
  const totals = () => db.prepare("SELECT count(*) records,COALESCE(sum(payload_bytes),0) bytes FROM offline_queue WHERE state IN ('PENDING','DELIVERING','FAILED')").get();
  function enqueue(record) {
    if (closed) throw new Error("offline_queue_closed");
    if (!KINDS.has(record.kind) || typeof record.id !== "string" || !record.id || typeof record.orderingKey !== "string" || !record.orderingKey) throw new Error("offline_queue_record_invalid");
    if (record.tenantId && record.tenantId !== tenantId || record.siteId && record.siteId !== siteId || record.deviceId && record.deviceId !== deviceId) throw new Error("offline_queue_scope_mismatch");
    if ((record.schemaVersion ?? 1) !== 1) throw new Error("offline_queue_schema_unsupported");
    const observedAt = Date.parse(record.observedAt);
    if (!Number.isFinite(observedAt)) throw new Error("offline_queue_observation_time_invalid");
    expire();
    const payload = seal(record.payload, key), current = totals();
    if (Number(current.records) >= limits.maxRecords || Number(current.bytes) + payload.length > limits.maxBytes) {
      audit("DISK_PRESSURE_REJECTED", record.kind, record.id, record.priority === 0 ? "optional" : "critical_preserved");
      throw new Error(record.priority === 0 ? "offline_queue_optional_dropped_recorded" : "offline_queue_critical_capacity_reached");
    }
    db.prepare(`INSERT OR IGNORE INTO offline_queue(id,kind,schema_version,tenant_id,site_id,device_id,source_id,ordering_key,observed_at,queued_at,priority,payload,payload_bytes,state)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING')`).run(record.id, record.kind, record.schemaVersion ?? 1, tenantId, siteId, deviceId, record.sourceId ?? null,
      record.orderingKey, observedAt, now(), bounded(record.priority, 50, 0, 100), payload, payload.length);
    return { id: record.id, inserted: Number(db.prepare("SELECT changes() n").get().n) === 1 };
  }
  function ready() {
    if (revoked || closed) return [];
    expire();
    // The NOT EXISTS clause preserves ordering per Site/source/track key while allowing unrelated cameras in the same batch.
    return db.prepare(`SELECT q.* FROM offline_queue q WHERE q.state IN ('PENDING','FAILED') AND q.next_attempt_at<=? AND q.tenant_id=? AND q.site_id=? AND q.device_id=?
      AND NOT EXISTS(SELECT 1 FROM offline_queue p WHERE p.ordering_key=q.ordering_key AND (p.observed_at<q.observed_at OR (p.observed_at=q.observed_at AND p.rowid<q.rowid)) AND p.state IN ('PENDING','FAILED','DELIVERING'))
      ORDER BY q.priority DESC,q.queued_at LIMIT ?`).all(now(), tenantId, siteId, deviceId, limits.batchSize).map(row => ({ ...row, payload: open(row.payload, key) }));
  }
  function begin(id) { if (revoked) throw new Error("offline_queue_device_revoked"); db.prepare("UPDATE offline_queue SET state='DELIVERING' WHERE id=? AND tenant_id=? AND site_id=? AND device_id=? AND state IN ('PENDING','FAILED')").run(id, tenantId, siteId, deviceId); }
  function acknowledge(id) { db.prepare("DELETE FROM offline_queue WHERE id=? AND tenant_id=? AND site_id=? AND device_id=? AND state='DELIVERING'").run(id, tenantId, siteId, deviceId); audit("DELIVERY_ACKNOWLEDGED", null, id); }
  function discard(id, category = "policy_revoked") { db.prepare("DELETE FROM offline_queue WHERE id=? AND tenant_id=? AND site_id=? AND device_id=?").run(id, tenantId, siteId, deviceId); audit("QUEUE_ITEM_DISCARDED", null, id, String(category).slice(0, 80)); }
  function fail(id, category = "delivery_unavailable") {
    const row = db.prepare("SELECT attempts FROM offline_queue WHERE id=?").get(id); if (!row) return;
    const attempts = Number(row.attempts) + 1, wait = Math.min(limits.retryMaxMs, limits.retryBaseMs * 2 ** Math.min(attempts - 1, 8));
    db.prepare("UPDATE offline_queue SET state='FAILED',attempts=?,next_attempt_at=?,last_error=? WHERE id=?").run(attempts, now() + wait, String(category).replace(/[^a-z0-9_-]/gi, "_").slice(0, 80), id);
  }
  function recoverInterrupted() { db.prepare("UPDATE offline_queue SET state='PENDING' WHERE state='DELIVERING'").run(); }
  async function resync(deliver) {
    if (typeof deliver !== "function") throw new Error("offline_queue_delivery_required");
    if (revoked) return { state: "RESYNC_BLOCKED_REVOKED", delivered: 0 };
    if (resyncing) return { state: "RESYNCHRONIZING", delivered: 0 };
    resyncing = true; let delivered = 0;
    try {
      for (const row of ready()) {
        begin(row.id);
        try {
          const result = await deliver({ id: row.id, kind: row.kind, schemaVersion: row.schema_version, observedAt: new Date(row.observed_at).toISOString(),
            queuedAt: new Date(row.queued_at).toISOString(), deliveryDelayMs: Math.max(0, now() - row.observed_at), mode: now() - row.observed_at > 60_000 ? "BACKFILL_RESYNC" : "LIVE", payload: row.payload });
          if (result?.acknowledged !== true) throw new Error("ambiguous_or_missing_ack");
          acknowledge(row.id); delivered += 1; deliveredCount += 1;
        } catch (error) { fail(row.id, error instanceof Error ? error.message : "delivery_unavailable"); }
      }
    } finally { resyncing = false; }
    return { state: snapshot().queue_depth ? "BACKLOG_PENDING" : "SYNCHRONIZED", delivered };
  }
  function setRevoked(value = true) { revoked = value; audit(value ? "DEVICE_REVOKED_RESYNC_BLOCKED" : "DEVICE_REAUTHORIZED"); }
  function assertRebindSafe(nextTenant, nextSite) { if ((nextTenant !== tenantId || nextSite !== siteId) && Number(totals().records) > 0) throw new Error("offline_queue_rebind_requires_backlog_resolution"); }
  function snapshot() {
    expire();
    const row = db.prepare("SELECT count(*) depth,COALESCE(sum(payload_bytes),0) bytes,MIN(queued_at) oldest,SUM(CASE WHEN attempts>0 THEN 1 ELSE 0 END) retrying,SUM(CASE WHEN state='FAILED' THEN 1 ELSE 0 END) failed FROM offline_queue WHERE state IN ('PENDING','FAILED','DELIVERING')").get();
    return { contract: "observer-offline-buffer-v1", schema_versions: [1], state: revoked ? "RESYNC_BLOCKED_REVOKED" : resyncing ? "RESYNCHRONIZING" : Number(row.depth) ? "BACKLOG_PENDING" : "SYNCHRONIZED",
      queue_depth: Number(row.depth), queue_bytes: Number(row.bytes), oldest_item_age_ms: row.oldest == null ? null : Math.max(0, now() - Number(row.oldest)), retry_count: Number(row.retrying || 0), failed_items: Number(row.failed || 0),
      delivered_count: deliveredCount, disk_pressure: Number(row.depth) >= limits.maxRecords || Number(row.bytes) >= limits.maxBytes ? "LIMIT_REACHED" : Number(row.bytes) >= limits.maxBytes * 0.8 ? "HIGH" : "NORMAL", revoked, ...limits };
  }
  function close() { closed = true; db.close(); }
  recoverInterrupted();
  return { enqueue, ready, begin, acknowledge, discard, fail, resync, recoverInterrupted, setRevoked, assertRebindSafe, snapshot, close, binding: Object.freeze({ tenantId, siteId, deviceId }) };
}
