import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { chmodSync } from "node:fs";
import { isAbsolute } from "node:path";
import { HOME_LEGACY_MATCH_DEVICES, HOME_LEGACY_MATCH_SITE_ID } from "./home-legacy-match-service.mjs";

const PURPOSE = "HOME_TELEMETRY_LEGACY_MATCH";
const MAX_MS = 5 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Host-local preparation, never a Product route. The caller must supply a
// protected, encrypted-at-rest location and a verifier backed by the existing
// Product Auth + active-profile contracts. No bearer token is persisted.
export function openHomeLegacyApprovalStore({ path, verifyAdministrator, now = () => Date.now() }) {
  if (typeof path !== "string" || (path !== ":memory:" && !isAbsolute(path)) ||
    typeof verifyAdministrator !== "function")
    throw new TypeError("PROTECTED_APPROVAL_STORE_REQUIRED");
  const db = new DatabaseSync(path);
  if (path !== ":memory:") chmodSync(path, 0o600);
  db.exec(`pragma busy_timeout=5000;
    create table if not exists approvals (
      id text primary key, actor_id text not null, tenant_id text not null,
      device_id text not null, site_id text not null, purpose text not null,
      issued_at integer not null, expires_at integer not null, revoked_at integer
    );
    create table if not exists attempts (
      request_id text primary key, approval_id text not null references approvals(id),
      device_id text not null, created_at integer not null
    );
    create index if not exists attempts_approval_idx on attempts(approval_id,device_id);
    create table if not exists audit (
      id integer primary key, approval_id text, actor_id text, tenant_id text,
      device_id text not null, site_id text, request_id text not null,
      purpose text not null, phase text not null, outcome text,
      created_at integer not null
    );
    create trigger if not exists audit_no_update before update on audit begin select raise(abort,'AUDIT_APPEND_ONLY'); end;
    create trigger if not exists audit_no_delete before delete on audit begin select raise(abort,'AUDIT_APPEND_ONLY'); end;`);
  const active = db.prepare("select * from approvals where id=? and device_id=? and site_id=? and purpose=? and revoked_at is null and issued_at<=? and expires_at>?");
  function current(approvalId, deviceId) {
    const at = now();
    return active.get(approvalId, deviceId, HOME_LEGACY_MATCH_SITE_ID, PURPOSE, at, at);
  }
  function transaction(action) {
    db.exec("begin immediate");
    try { const result = action(); db.exec("commit"); return result; }
    catch (error) { db.exec("rollback"); throw error; }
  }
  return Object.freeze({
    async issueApproval({ accessToken, deviceId, tenantId, purpose, ttlMs = MAX_MS }) {
      if (!Object.hasOwn(HOME_LEGACY_MATCH_DEVICES, deviceId) ||
        !UUID.test(tenantId || "") || purpose !== PURPOSE ||
        !Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > MAX_MS) return null;
      const identity = await verifyAdministrator(accessToken);
      if (!identity || identity.authenticated !== true || identity.role !== "platform_admin" ||
        !UUID.test(identity.actorId || "")) return null;
      const at = now(), approvalId = randomUUID();
      transaction(() => {
        db.prepare("insert into approvals values (?,?,?,?,?,?,?,?,null)").run(
          approvalId, identity.actorId, tenantId, deviceId, HOME_LEGACY_MATCH_SITE_ID,
          PURPOSE, at, at + ttlMs);
        db.prepare("insert into audit(approval_id,actor_id,tenant_id,device_id,site_id,request_id,purpose,phase,created_at) values (?,?,?,?,?,?,?,?,?)")
          .run(approvalId, identity.actorId, tenantId, deviceId, HOME_LEGACY_MATCH_SITE_ID,
            randomUUID(), PURPOSE, "ISSUED", at);
      });
      return { approvalId, expiresAt: at + ttlMs };
    },
    async authorizeAdministrator(approvalId, deviceId, accessToken) {
      const approval = current(approvalId, deviceId);
      if (!approval) return null;
      const identity = await verifyAdministrator(accessToken);
      return identity?.authenticated === true && identity.role === "platform_admin" &&
        identity.actorId === approval.actor_id ? { authenticated: true, role: "platform_admin", purpose: PURPOSE,
        deviceId, siteId: approval.site_id, tenantId: approval.tenant_id,
        actorId: approval.actor_id, approvalId, issuedAt: approval.issued_at,
        expiresAt: approval.expires_at, revoked: false } : null;
    },
    async confirmApprovalActive({ approvalId, deviceId, tenantId, actorId }, accessToken) {
      const approval = current(approvalId, deviceId);
      if (!approval || approval.tenant_id !== tenantId || approval.actor_id !== actorId) return false;
      const identity = await verifyAdministrator(accessToken);
      return identity?.authenticated === true && identity.role === "platform_admin" && identity.actorId === actorId;
    },
    async consumeAttempt({ approvalId, deviceId, tenantId, actorId, requestId, maxAttempts }) {
      if (!UUID.test(requestId || "") || maxAttempts !== 2) return false;
      return transaction(() => {
        const approval = current(approvalId, deviceId);
        if (!approval || approval.tenant_id !== tenantId || approval.actor_id !== actorId) return false;
        if (db.prepare("select 1 from attempts where request_id=?").get(requestId)) return false;
        const count = db.prepare("select count(*) as n from attempts where approval_id=? and device_id=?").get(approvalId, deviceId).n;
        if (count >= 2) return false;
        db.prepare("insert into attempts values (?,?,?,?)").run(requestId, approvalId, deviceId, now());
        return true;
      });
    },
    async recordAudit(event) {
      const { approvalId, actorId, tenantId, deviceId, siteId, requestId, phase, outcome } = event;
      if (!Object.hasOwn(HOME_LEGACY_MATCH_DEVICES, deviceId) || !UUID.test(requestId || "") ||
        !["AUTHORIZED", "DENIED", "RESULT", "ERROR"].includes(phase) ||
        (outcome != null && !["MATCH", "MISMATCH", "UNKNOWN"].includes(outcome))) return false;
      db.prepare("insert into audit(approval_id,actor_id,tenant_id,device_id,site_id,request_id,purpose,phase,outcome,created_at) values (?,?,?,?,?,?,?,?,?,?)")
        .run(approvalId ?? null, actorId ?? null, tenantId ?? null, deviceId,
          siteId ?? null, requestId, PURPOSE, phase, outcome ?? null, now());
      return true;
    },
    async revokeApproval(approvalId, accessToken) {
      const identity = await verifyAdministrator(accessToken);
      if (!identity || identity.authenticated !== true || identity.role !== "platform_admin") return false;
      return transaction(() => {
        const approval = db.prepare("select * from approvals where id=? and actor_id=? and revoked_at is null")
          .get(approvalId, identity.actorId);
        if (!approval) return false;
        const at = now();
        db.prepare("update approvals set revoked_at=? where id=?").run(at, approvalId);
        db.prepare("insert into audit(approval_id,actor_id,tenant_id,device_id,site_id,request_id,purpose,phase,created_at) values (?,?,?,?,?,?,?,?,?)")
          .run(approvalId, identity.actorId, approval.tenant_id, approval.device_id,
            approval.site_id, randomUUID(), PURPOSE, "REVOKED", at);
        return true;
      });
    },
    close() { db.close(); }
  });
}

export function bindHomeLegacyApproval({ store, approvalId, deviceId, accessToken, reader, loadProtectedCredential, now }) {
  if (!store || !reader || !Object.hasOwn(HOME_LEGACY_MATCH_DEVICES, deviceId) ||
    typeof accessToken !== "string" || accessToken.length < 32 ||
    typeof loadProtectedCredential !== "function" || typeof now !== "function")
    throw new TypeError("TRUSTED_BINDING_REQUIRED");
  return Object.freeze({
    authorizeAdministrator: () => store.authorizeAdministrator(approvalId, deviceId, accessToken),
    confirmApprovalActive: scope => store.confirmApprovalActive(scope, accessToken),
    consumeAttempt: scope => store.consumeAttempt(scope),
    recordAudit: event => store.recordAudit(event),
    resolveApprovedBinding: deviceId => reader.resolveApprovedBinding(deviceId),
    loadScopedRows: binding => reader.loadScopedRows(binding),
    loadProtectedCredential,
    now
  });
}
