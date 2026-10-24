import { createHash, createPublicKey, randomBytes, verify as verifySignature } from "node:crypto";
import { SYNTHETIC_QA, assertSyntheticQaDelegation } from "./push44-ch1-private-media.mjs";

// Host-local Development adapter. It does not open a listener or create a
// Supabase/Production device record. The caller owns a protected, durable SQLite
// connection and the existing canonical Development session/delegation adapters.
const protocol = "DO-P44-QA-POP-V1";
const challengeLifetimeMs = 30_000;
const bindingLifetimeMs = 300_000;
const maxChallenges = 600;
const denied = () => { throw new Error("QA_DEVICE_PROOF_DENIED"); };
const validId = value => typeof value === "string" && /^[A-Za-z0-9_-]{16,96}$/.test(value);
const validSession = p => p?.verified === true && p.active === true &&
  p.environment === SYNTHETIC_QA.viewerEnvironment && p.viewerId === SYNTHETIC_QA.viewerId &&
  validId(p.sessionId);

function publicKey(raw) {
  if (typeof raw !== "string" || !/^[A-Za-z0-9_-]{87}$/.test(raw)) denied();
  const bytes = Buffer.from(raw, "base64url");
  if (bytes.length !== 65 || bytes[0] !== 4 || bytes.toString("base64url") !== raw) denied();
  try {
    return createPublicKey({ key: { kty: "EC", crv: "P-256",
      x: bytes.subarray(1, 33).toString("base64url"), y: bytes.subarray(33).toString("base64url") }, format: "jwk" });
  } catch { denied(); }
}

export function qaDeviceKeyId(raw) {
  publicKey(raw);
  return createHash("sha256").update(Buffer.from(raw, "base64url")).digest("base64url");
}

function requestScope(method, path, operation) {
  if (operation === "ENROLL") return method === "POST" && path === "/qa-device/enroll";
  return (method === "POST" && ["/ch1/claim", "/ch1/renew"].includes(path)) ||
    (method === "GET" && /^\/ch1\/(index\.m3u8|segment-\d{1,16}\.ts)$/.test(path));
}

function approvalValid(a, keyId, sessionId, now) {
  return a?.adminVerified === true && a.ownerVerified === true && a.revoked === false &&
    a.viewerId === SYNTHETIC_QA.viewerId && a.tenantId === SYNTHETIC_QA.tenantId &&
    a.siteId === SYNTHETIC_QA.siteId && a.sourceId === SYNTHETIC_QA.sourceId &&
    a.sessionId === sessionId && a.keyId === keyId && validId(a.approvalId) &&
    typeof a.purpose === "string" && a.purpose.length >= 12 && a.purpose.length <= 256 &&
    Number.isSafeInteger(a.expiresAt) && a.expiresAt > now && a.expiresAt <= now + bindingLifetimeMs;
}

export function createPush44QaDeviceProof({ database, authenticate, readDelegation,
  readApprovedEnrollment, consumeApproval, authorizeOwnerAction, now = Date.now } = {}) {
  if (!database || ![authenticate, readDelegation, readApprovedEnrollment, consumeApproval,
    authorizeOwnerAction, now].every(x => typeof x === "function")) throw new Error("QA_DEVICE_ADAPTERS_REQUIRED");
  database.exec(`CREATE TABLE IF NOT EXISTS push44_qa_binding (
    id INTEGER PRIMARY KEY CHECK (id = 1), key_id TEXT NOT NULL, public_key TEXT NOT NULL,
    session_id TEXT NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS push44_qa_challenge (
    id TEXT PRIMARY KEY, operation TEXT NOT NULL, key_id TEXT NOT NULL, session_id TEXT NOT NULL,
    method TEXT NOT NULL, path TEXT NOT NULL, payload TEXT NOT NULL, expires_at INTEGER NOT NULL,
    consumed_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS push44_qa_audit (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, event TEXT NOT NULL,
    key_id TEXT NOT NULL, previous_digest TEXT NOT NULL, digest TEXT NOT NULL
  );`);
  const transaction = fn => {
    database.exec("BEGIN IMMEDIATE");
    try { const value = fn(); database.exec("COMMIT"); return value; }
    catch (error) { database.exec("ROLLBACK"); throw error; }
  };
  const audit = (event, keyId) => {
    const previous = database.prepare("SELECT digest FROM push44_qa_audit ORDER BY seq DESC LIMIT 1").get()?.digest || "0".repeat(64);
    const at = now();
    const digest = createHash("sha256").update(`${previous}\n${at}\n${event}\n${keyId}`).digest("hex");
    database.prepare("INSERT INTO push44_qa_audit(at,event,key_id,previous_digest,digest) VALUES(?,?,?,?,?)")
      .run(at, event, keyId, previous, digest);
  };
  const binding = () => database.prepare("SELECT * FROM push44_qa_binding WHERE id=1").get();
  const active = (principal, keyId) => {
    const b = binding();
    return b && b.revoked_at === null && b.expires_at > now() &&
      b.session_id === principal.sessionId && b.key_id === keyId;
  };
  async function principal(context) {
    const p = await authenticate(context);
    if (!validSession(p)) denied();
    assertSyntheticQaDelegation(await readDelegation(), now());
    return p;
  }
  async function issueChallenge({ context, operation, publicKey: raw, method, path }) {
    const p = await principal(context);
    if (!["ENROLL", "ACCESS"].includes(operation) || !requestScope(method, path, operation)) denied();
    const keyId = operation === "ENROLL" ? qaDeviceKeyId(raw) : binding()?.key_id;
    if (!keyId) denied();
    if (operation === "ENROLL") {
      const approval = await readApprovedEnrollment();
      if (!approvalValid(approval, keyId, p.sessionId, now()) || active(p, keyId)) denied();
      const previous = binding();
      if (previous && previous.revoked_at === null && previous.expires_at > now()) denied();
    } else if (!active(p, keyId)) denied();
    const id = randomBytes(24).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const expiresAt = now() + challengeLifetimeMs;
    const payload = [protocol, operation, SYNTHETIC_QA.viewerEnvironment, SYNTHETIC_QA.viewerId,
      SYNTHETIC_QA.tenantId, SYNTHETIC_QA.siteId, SYNTHETIC_QA.sourceId,
      p.sessionId, keyId, method, path, nonce, String(expiresAt)].join("\n");
    transaction(() => {
      const count = database.prepare("SELECT COUNT(*) AS n FROM push44_qa_challenge WHERE session_id=?").get(p.sessionId).n;
      if (count >= maxChallenges) denied();
      database.prepare("INSERT INTO push44_qa_challenge VALUES(?,?,?,?,?,?,?,?,NULL)")
        .run(id, operation, keyId, p.sessionId, method, path, payload, expiresAt);
      audit("CHALLENGE_ISSUED", keyId);
    });
    return { challengeId: id, payload: Buffer.from(payload).toString("base64url"), expiresAt };
  }
  function consumeChallenge(id, operation, p, method, path) {
    if (!validId(id) || !requestScope(method, path, operation)) denied();
    return transaction(() => {
      const c = database.prepare("SELECT * FROM push44_qa_challenge WHERE id=?").get(id);
      if (!c || c.operation !== operation || c.session_id !== p.sessionId || c.method !== method ||
        c.path !== path || c.consumed_at !== null || c.expires_at <= now()) denied();
      database.prepare("UPDATE push44_qa_challenge SET consumed_at=? WHERE id=? AND consumed_at IS NULL").run(now(), id);
      audit("CHALLENGE_CONSUMED", c.key_id);
      return c;
    });
  }
  function signed(c, raw, signature) {
    if (typeof signature !== "string" || !/^[A-Za-z0-9_-]{64,192}$/.test(signature)) denied();
    const bytes = Buffer.from(signature, "base64url");
    if (bytes.toString("base64url") !== signature || !verifySignature("sha256", Buffer.from(c.payload),
      publicKey(raw), bytes)) denied();
  }
  async function enroll({ context, publicKey: raw, challengeId, signature }) {
    const p = await principal(context);
    const c = consumeChallenge(challengeId, "ENROLL", p, "POST", "/qa-device/enroll");
    const keyId = qaDeviceKeyId(raw);
    if (c.key_id !== keyId) denied();
    signed(c, raw, signature);
    const approval = await readApprovedEnrollment();
    if (!approvalValid(approval, keyId, p.sessionId, now()) ||
      await consumeApproval(approval.approvalId) !== true) denied();
    transaction(() => {
      const previous = binding();
      if (previous && previous.revoked_at === null && previous.expires_at > now()) denied();
      database.prepare("INSERT OR REPLACE INTO push44_qa_binding VALUES(1,?,?,?,?,NULL)")
        .run(keyId, raw, p.sessionId, Math.min(approval.expiresAt, now() + bindingLifetimeMs));
      audit("KEY_ENROLLED", keyId);
    });
    return { enrolled: true, expiresAt: binding().expires_at };
  }
  async function verifyRequest({ context, challengeId, signature, method, path }) {
    const p = await principal(context);
    const c = consumeChallenge(challengeId, "ACCESS", p, method, path);
    const b = binding();
    if (!active(p, c.key_id) || !b || b.key_id !== c.key_id) denied();
    signed(c, b.public_key, signature);
    transaction(() => { if (!active(p, c.key_id)) denied(); audit("PROOF_ACCEPTED", c.key_id); });
    return p;
  }
  async function assertActive(context) {
    const p = await principal(context);
    const b = binding();
    if (!b || !active(p, b.key_id)) denied();
    return p;
  }
  async function revoke({ keyId, purpose }) {
    if (typeof purpose !== "string" || purpose.length < 12 || !validId(keyId) ||
      await authorizeOwnerAction({ keyId, purpose, operation: "REVOKE" }) !== true) denied();
    transaction(() => {
      const b = binding();
      if (!b || b.key_id !== keyId || b.revoked_at !== null) denied();
      database.prepare("UPDATE push44_qa_binding SET revoked_at=? WHERE id=1").run(now());
      audit("KEY_REVOKED", keyId);
    });
    return { revoked: true };
  }
  return Object.freeze({ issueChallenge, enroll, verifyRequest, assertActive, revoke,
    currentKeyId: () => binding()?.key_id || null,
    auditCount: () => database.prepare("SELECT COUNT(*) AS n FROM push44_qa_audit").get().n });
}

// The existing gate revalidates the canonical Supabase session both before and
// after reading a segment. Cache proof only for that exact request object;
// assertActive still checks revocation/expiry on every call.
export function withPush44QaDeviceProof(authenticate, proof) {
  if (typeof authenticate !== "function" || !proof) throw new Error("QA_DEVICE_ADAPTERS_REQUIRED");
  const accepted = new WeakMap();
  return async request => {
    const p = await authenticate(request);
    if (!validSession(p)) denied();
    const requestBinding = [request.method, request.url, request.headers?.["x-do-qa-challenge"],
      request.headers?.["x-do-qa-signature"]].join("\n");
    if (accepted.has(request) && accepted.get(request) !== requestBinding) denied();
    if (!accepted.has(request)) {
      await proof.verifyRequest({ context: request, method: request.method, path: request.url,
        challengeId: request.headers?.["x-do-qa-challenge"], signature: request.headers?.["x-do-qa-signature"] });
      accepted.set(request, requestBinding);
    }
    const current = await proof.assertActive(request);
    // The media lease must pin the proven key, never a caller-supplied device label.
    return { ...current, deviceId: proof.currentKeyId() };
  };
}
