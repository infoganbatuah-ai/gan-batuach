import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const SHA256 = /^[a-f0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TERMINAL = new Set(["acknowledged", "acknowledged_needs_reconciliation", "unknown_non_retryable", "failed"]);

function invalid(code) {
  throw Object.assign(new Error(code), { code });
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createPrivateNvrCommandStateStore({ databasePath, auditSigningKey, database, now = Date.now } = {}) {
  if (!database && typeof databasePath !== "string") invalid("command_state_database_required");
  if (!(Buffer.isBuffer(auditSigningKey) || typeof auditSigningKey === "string") || Buffer.byteLength(auditSigningKey) < 32) {
    invalid("command_audit_signing_key_invalid");
  }
  const db = database || new DatabaseSync(databasePath);
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS private_nvr_command_replay (
    request_id TEXT PRIMARY KEY,
    fingerprint TEXT NOT NULL,
    state TEXT NOT NULL,
    non_retryable INTEGER NOT NULL DEFAULT 0,
    error_code TEXT,
    result_json TEXT,
    expires_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  ) STRICT`);
  db.exec(`CREATE TABLE IF NOT EXISTS private_nvr_command_audit (
    request_id TEXT PRIMARY KEY,
    intent_digest TEXT NOT NULL,
    receipt_digest TEXT NOT NULL,
    signature TEXT NOT NULL,
    recorded_at INTEGER NOT NULL
  ) STRICT`);
  db.exec(`CREATE TABLE IF NOT EXISTS private_nvr_command_pending_results (
    request_id TEXT PRIMARY KEY,
    result_json TEXT NOT NULL,
    result_digest TEXT NOT NULL,
    created_at INTEGER NOT NULL
  ) STRICT`);
  db.exec(`CREATE TABLE IF NOT EXISTS private_nvr_authoritative_bindings (
    stream_id TEXT PRIMARY KEY,
    gateway_id TEXT NOT NULL,
    site_id TEXT NOT NULL,
    camera_id TEXT NOT NULL,
    channel INTEGER NOT NULL CHECK (channel > 0),
    source_generation TEXT NOT NULL,
    binding_generation TEXT NOT NULL,
    recorder_id TEXT NOT NULL,
    session_key TEXT NOT NULL,
    discovery_id TEXT NOT NULL,
    verified_at INTEGER NOT NULL
  ) STRICT`);

  const replayGet = db.prepare("SELECT fingerprint, state, non_retryable FROM private_nvr_command_replay WHERE request_id = ?");
  const replayInsert = db.prepare("INSERT INTO private_nvr_command_replay (request_id,fingerprint,state,expires_at,updated_at) VALUES (?,?,?,?,?)");
  const replayUpdate = db.prepare("UPDATE private_nvr_command_replay SET state=?,non_retryable=?,error_code=?,result_json=?,updated_at=? WHERE request_id=? AND fingerprint=? AND state='reserved'");
  const auditGet = db.prepare("SELECT intent_digest,receipt_digest,signature,recorded_at FROM private_nvr_command_audit WHERE request_id = ?");
  const auditInsert = db.prepare("INSERT INTO private_nvr_command_audit (request_id,intent_digest,receipt_digest,signature,recorded_at) VALUES (?,?,?,?,?)");
  const pendingUpsert = db.prepare("INSERT INTO private_nvr_command_pending_results (request_id,result_json,result_digest,created_at) VALUES (?,?,?,?) ON CONFLICT(request_id) DO UPDATE SET result_json=excluded.result_json,result_digest=excluded.result_digest");
  const pendingFirst = db.prepare("SELECT request_id,result_json,result_digest FROM private_nvr_command_pending_results ORDER BY created_at,request_id LIMIT 1");
  const pendingDelete = db.prepare("DELETE FROM private_nvr_command_pending_results WHERE request_id=? AND result_digest=?");
  const bindingGet = db.prepare(`SELECT stream_id,gateway_id,site_id,camera_id,channel,source_generation,
    binding_generation,recorder_id,session_key,discovery_id,verified_at FROM private_nvr_authoritative_bindings WHERE stream_id=?`);
  const bindingUpsert = db.prepare(`INSERT INTO private_nvr_authoritative_bindings
    (stream_id,gateway_id,site_id,camera_id,channel,source_generation,binding_generation,recorder_id,session_key,discovery_id,verified_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(stream_id) DO UPDATE SET gateway_id=excluded.gateway_id,site_id=excluded.site_id,
    camera_id=excluded.camera_id,channel=excluded.channel,source_generation=excluded.source_generation,
    binding_generation=excluded.binding_generation,recorder_id=excluded.recorder_id,session_key=excluded.session_key,
    discovery_id=excluded.discovery_id,verified_at=excluded.verified_at`);
  const bindingDeleteForIdentity = db.prepare("DELETE FROM private_nvr_authoritative_bindings WHERE gateway_id=? AND site_id=?");

  const receiptFor = (intentDigest, recordedAt) => {
    const signature = createHmac("sha256", auditSigningKey).update(`${intentDigest}:${recordedAt}`).digest("hex");
    return { immutable: true, intent_digest: intentDigest, digest: digest(`${intentDigest}:${recordedAt}:${signature}`), signature, recorded_at: recordedAt };
  };

  return Object.freeze({
    authoritativeBinding(streamId) {
      if (typeof streamId !== "string" || streamId.length < 1 || streamId.length > 256) invalid("invalid_authoritative_stream_id");
      const row = bindingGet.get(streamId);
      if (!row) return null;
      return Object.freeze({
        streamId: row.stream_id,
        gatewayId: row.gateway_id,
        siteId: row.site_id,
        cameraId: row.camera_id,
        channel: row.channel,
        generation: row.source_generation,
        bindingGeneration: row.binding_generation,
        recorderId: row.recorder_id,
        sessionKey: row.session_key,
        discoveryId: row.discovery_id,
        verifiedAt: row.verified_at
      });
    },
    replaceAuthoritativeBindings({ gatewayId, siteId, discoveryId, verifiedAt, bindings }) {
      if (typeof gatewayId !== "string" || !gatewayId || !UUID.test(siteId || "") || !UUID.test(discoveryId || "")
        || !Number.isInteger(verifiedAt) || Math.abs(now() - verifiedAt) > 5 * 60_000 || !Array.isArray(bindings)
        || bindings.length < 1 || bindings.length > 256) invalid("invalid_authoritative_binding_provisioning");
      const streamIds = new Set();
      for (const binding of bindings) {
        if (!binding || typeof binding.streamId !== "string" || !binding.streamId || streamIds.has(binding.streamId)
          || !UUID.test(binding.cameraId || "") || !Number.isInteger(binding.channel) || binding.channel < 1
          || !SHA256.test(binding.generation || "") || !SHA256.test(binding.bindingGeneration || "")
          || typeof binding.recorderId !== "string" || !binding.recorderId || typeof binding.sessionKey !== "string" || !binding.sessionKey) {
          invalid("invalid_authoritative_binding_provisioning");
        }
        streamIds.add(binding.streamId);
      }
      db.exec("BEGIN IMMEDIATE");
      try {
        bindingDeleteForIdentity.run(gatewayId, siteId);
        for (const binding of bindings) {
          bindingUpsert.run(binding.streamId, gatewayId, siteId, binding.cameraId, binding.channel, binding.generation,
            binding.bindingGeneration, binding.recorderId, binding.sessionKey, discoveryId, verifiedAt);
        }
        db.exec("COMMIT");
      } catch (error) {
        try { db.exec("ROLLBACK"); } catch {}
        throw error;
      }
      return bindings.length;
    },
    replay: Object.freeze({
      async reserve({ id, fingerprint, expires_at }) {
        if (!UUID.test(id || "") || !SHA256.test(fingerprint || "")) invalid("invalid_replay_reservation");
        const expires = Date.parse(expires_at);
        if (!Number.isFinite(expires) || expires <= now()) invalid("invalid_replay_expiry");
        db.exec("BEGIN IMMEDIATE");
        try {
          const existing = replayGet.get(id);
          if (existing) {
            db.exec("COMMIT");
            return { status: "existing", fingerprint: existing.fingerprint, state: existing.state, non_retryable: existing.non_retryable === 1 };
          }
          replayInsert.run(id, fingerprint, "reserved", expires, now());
          db.exec("COMMIT");
          return { status: "reserved", fingerprint };
        } catch (error) {
          try { db.exec("ROLLBACK"); } catch {}
          throw error;
        }
      },
      async finalize({ id, fingerprint, state, non_retryable, error_code = null, result = null }) {
        if (!UUID.test(id || "") || !SHA256.test(fingerprint || "") || !TERMINAL.has(state)) invalid("invalid_replay_finalization");
        if (["acknowledged", "acknowledged_needs_reconciliation", "unknown_non_retryable"].includes(state) && non_retryable !== true) {
          invalid("physical_terminal_must_be_non_retryable");
        }
        const changed = replayUpdate.run(state, non_retryable === true ? 1 : 0, error_code, result ? JSON.stringify(result) : null, now(), id, fingerprint).changes;
        if (changed !== 1) invalid("replay_finalization_conflict");
      }
    }),
    audit: Object.freeze({
      async appendIntent(intent, { intent_digest }) {
        if (!UUID.test(intent?.request_id || "") || !SHA256.test(intent_digest || "")) invalid("invalid_audit_intent");
        db.exec("BEGIN IMMEDIATE");
        try {
          const existing = auditGet.get(intent.request_id);
          if (existing) {
            db.exec("COMMIT");
            if (existing.intent_digest !== intent_digest) invalid("audit_intent_conflict");
            return { immutable: true, intent_digest: existing.intent_digest, digest: existing.receipt_digest,
              signature: existing.signature, recorded_at: existing.recorded_at };
          }
          const recordedAt = now();
          const receipt = receiptFor(intent_digest, recordedAt);
          auditInsert.run(intent.request_id, intent_digest, receipt.digest, receipt.signature, recordedAt);
          db.exec("COMMIT");
          return receipt;
        } catch (error) {
          try { db.exec("ROLLBACK"); } catch {}
          throw error;
        }
      },
      async verifyReceipt(receipt, intentDigest) {
        if (!receipt?.immutable || receipt.intent_digest !== intentDigest || !SHA256.test(receipt.digest || "") || !SHA256.test(receipt.signature || "")) return false;
        const expected = receiptFor(intentDigest, receipt.recorded_at);
        return safeEqual(receipt.signature, expected.signature) && safeEqual(receipt.digest, expected.digest);
      }
    }),
    savePendingResult(result) {
      if (!UUID.test(result?.request_id || "")) invalid("invalid_pending_result");
      const json = JSON.stringify(result);
      const resultDigest = digest(json);
      pendingUpsert.run(result.request_id, json, resultDigest, now());
      return resultDigest;
    },
    pendingResult() {
      const row = pendingFirst.get();
      if (!row) return null;
      const result = JSON.parse(row.result_json);
      if (digest(row.result_json) !== row.result_digest) invalid("pending_result_integrity_failed");
      return { result, resultDigest: row.result_digest };
    },
    acknowledgePendingResult(requestId, resultDigest) {
      return pendingDelete.run(requestId, resultDigest).changes === 1;
    },
    status() {
      return { ready: true, durable_replay: true, immutable_local_audit: true, durable_pending_results: true };
    },
    close() {
      if (!database) db.close();
    }
  });
}
