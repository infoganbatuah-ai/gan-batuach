import { createHash, randomBytes } from "node:crypto";
import { SYNTHETIC_QA, assertSyntheticQaDelegation } from "./push44-ch1-private-media.mjs";

const deny = () => { throw new Error("QA_ENROLLMENT_APPROVAL_DENIED"); };
const validId = value => typeof value === "string" && /^[A-Za-z0-9_-]{16,96}$/.test(value);

// Trusted host only. This is deliberately not an HTTP approval endpoint: the
// owner/admin ceremony is supplied by a separately authenticated operator.
export function createPush44QaEnrollmentApproval({ database, authenticate,
  readDelegation, verifyOwnerAction, now = Date.now } = {}) {
  if (!database || ![authenticate, readDelegation, verifyOwnerAction, now].every(fn => typeof fn === "function"))
    throw new Error("QA_APPROVAL_ADAPTERS_REQUIRED");
  database.exec(`CREATE TABLE IF NOT EXISTS push44_qa_enrollment_approval (
    id INTEGER PRIMARY KEY CHECK(id=1), approval_id TEXT NOT NULL, key_id TEXT NOT NULL,
    session_id TEXT NOT NULL, purpose TEXT NOT NULL, expires_at INTEGER NOT NULL,
    consumed_at INTEGER, revoked_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS push44_qa_enrollment_audit (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, event TEXT NOT NULL,
    key_id TEXT NOT NULL, previous_digest TEXT NOT NULL, digest TEXT NOT NULL
  );`);
  const transaction = fn => {
    database.exec("BEGIN IMMEDIATE");
    try { const result = fn(); database.exec("COMMIT"); return result; }
    catch (error) { database.exec("ROLLBACK"); throw error; }
  };
  const audit = (event, keyId) => {
    const previous = database.prepare("SELECT digest FROM push44_qa_enrollment_audit ORDER BY seq DESC LIMIT 1").get()?.digest || "0".repeat(64);
    const at = now();
    const digest = createHash("sha256").update(`${previous}\n${at}\n${event}\n${keyId}`).digest("hex");
    database.prepare("INSERT INTO push44_qa_enrollment_audit(at,event,key_id,previous_digest,digest) VALUES(?,?,?,?,?)")
      .run(at, event, keyId, previous, digest);
  };
  const row = () => database.prepare("SELECT * FROM push44_qa_enrollment_approval WHERE id=1").get();
  async function principal(context) {
    const p = await authenticate(context);
    if (p?.verified !== true || p.active !== true || p.environment !== SYNTHETIC_QA.viewerEnvironment ||
      p.viewerId !== SYNTHETIC_QA.viewerId || !validId(p.sessionId)) deny();
    assertSyntheticQaDelegation(await readDelegation(), now());
    return p;
  }
  async function authorize({ context, keyId, purpose, ownerAction }) {
    const p = await principal(context);
    if (!validId(keyId) || typeof purpose !== "string" || purpose.trim().length < 12 || purpose.length > 256 ||
      await verifyOwnerAction({ context, principal: p, keyId, purpose, ownerAction,
        operation: "AUTHORIZE_ENROLLMENT" }) !== true) deny();
    return transaction(() => {
      const current = row();
      if (current && current.consumed_at === null && current.revoked_at === null && current.expires_at > now()) deny();
      const approvalId = randomBytes(24).toString("base64url");
      const expiresAt = now() + 60_000;
      database.prepare(`INSERT OR REPLACE INTO push44_qa_enrollment_approval
        VALUES(1,?,?,?,?,?,NULL,NULL)`).run(approvalId, keyId, p.sessionId, purpose, expiresAt);
      audit("APPROVAL_ISSUED", keyId);
      return { approvalId, expiresAt };
    });
  }
  async function readApprovedEnrollment() {
    const current = row();
    if (!current || current.consumed_at !== null || current.revoked_at !== null || current.expires_at <= now()) return null;
    return { approvalId: current.approval_id, keyId: current.key_id, sessionId: current.session_id,
      viewerId: SYNTHETIC_QA.viewerId, tenantId: SYNTHETIC_QA.tenantId,
      siteId: SYNTHETIC_QA.siteId, sourceId: SYNTHETIC_QA.sourceId,
      purpose: current.purpose, adminVerified: true, ownerVerified: true,
      revoked: false, expiresAt: current.expires_at };
  }
  async function consumeApproval(approvalId) {
    if (!validId(approvalId)) return false;
    return transaction(() => {
      const current = row();
      if (!current || current.approval_id !== approvalId || current.consumed_at !== null ||
        current.revoked_at !== null || current.expires_at <= now()) return false;
      if (database.prepare(`UPDATE push44_qa_enrollment_approval SET consumed_at=?
        WHERE id=1 AND approval_id=? AND consumed_at IS NULL AND revoked_at IS NULL`).run(now(), approvalId).changes !== 1) return false;
      audit("APPROVAL_CONSUMED", current.key_id);
      return true;
    });
  }
  async function revoke({ context, purpose, ownerAction }) {
    const p = await principal(context);
    if (typeof purpose !== "string" || purpose.trim().length < 12 || purpose.length > 256 ||
      await verifyOwnerAction({ context, principal: p, purpose, ownerAction,
        operation: "REVOKE_APPROVAL" }) !== true) deny();
    return transaction(() => {
      const current = row();
      if (!current || current.revoked_at !== null || current.consumed_at !== null) deny();
      database.prepare("UPDATE push44_qa_enrollment_approval SET revoked_at=? WHERE id=1").run(now());
      audit("APPROVAL_REVOKED", current.key_id);
      return { revoked: true };
    });
  }
  return Object.freeze({ authorize, readApprovedEnrollment, consumeApproval, revoke });
}
