// Preparation only: no HTTP route, Production connection, Keychain access, or
// device-side invocation is provided by this module. The trusted host adapter
// must keep both credential and verifier inside its protected process boundary.
export const HOME_LEGACY_MATCH_SITE_ID = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
// Read-only Production metadata observed 2026-10-21. These are exact enrollment
// bindings, not proof that either protected local credential matches.
export const HOME_LEGACY_MATCH_BINDINGS = Object.freeze({
  "62df97e2-3c0b-427f-9108-bde029bc10e7": Object.freeze({
    enrollmentId: "1c450dca-38a8-4e49-853f-c613ca498c27",
    tenantId: HOME_LEGACY_MATCH_SITE_ID, siteId: HOME_LEGACY_MATCH_SITE_ID,
    deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
    deploymentProfile: "PHYSICAL_GATEWAY", configVersion: 1
  }),
  "db267b52-6282-4944-bcee-5d4857698fb0": Object.freeze({
    enrollmentId: "d7ee3c9f-0b2e-4943-947b-c410c6bc2a41",
    tenantId: HOME_LEGACY_MATCH_SITE_ID, siteId: HOME_LEGACY_MATCH_SITE_ID,
    deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
    deploymentProfile: "SOFTWARE_CONNECTOR", configVersion: 4
  })
});
export const HOME_LEGACY_MATCH_DEVICES = Object.freeze(Object.fromEntries(
  Object.entries(HOME_LEGACY_MATCH_BINDINGS).map(([id, binding]) => [id, binding.deploymentProfile])));

const RESULTS = new Set(["MATCH", "MISMATCH", "UNKNOWN"]);
const MAX_APPROVAL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 2;
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// All dependencies are trusted, server-side capabilities, not caller-supplied
// request fields. An adapter must obtain administrator authorization from the
// approved identity system, enforce an atomic rate limit, and send a redacted
// audit record to an approved append-only sink before returning a result.
export async function evaluateHomeLegacyMatch(input, dependencies) {
  const deviceId = input && typeof input === "object" ? input.deviceId : null;
  const requestId = input && typeof input === "object" ? input.requestId : null;
  const { authorizeAdministrator, confirmApprovalActive, consumeAttempt, compareBoundCredential,
    recordAudit, now = () => Date.now() } = dependencies &&
      typeof dependencies === "object" ? dependencies : {};
  if (typeof deviceId !== "string" || typeof requestId !== "string" || !REQUEST_ID.test(requestId)) return "UNKNOWN";
  const profile = HOME_LEGACY_MATCH_DEVICES[deviceId];
  if (!profile || !Object.hasOwn(HOME_LEGACY_MATCH_DEVICES, deviceId)) return "UNKNOWN";
  if (![authorizeAdministrator, confirmApprovalActive, consumeAttempt, compareBoundCredential,
    recordAudit, now]
    .every(value => typeof value === "function")) return "UNKNOWN";

  let scope = null;
  try {
    const authorization = await authorizeAdministrator();
    const at = now();
    if (!authorization || authorization.authenticated !== true || authorization.role !== "platform_admin" ||
      authorization.purpose !== "HOME_TELEMETRY_LEGACY_MATCH" ||
      authorization.deviceId !== deviceId ||
      authorization.siteId !== HOME_LEGACY_MATCH_SITE_ID ||
      typeof authorization.tenantId !== "string" || !authorization.tenantId ||
      typeof authorization.actorId !== "string" || !authorization.actorId ||
      typeof authorization.approvalId !== "string" || !authorization.approvalId ||
      authorization.revoked !== false ||
      !Number.isSafeInteger(at) ||
      !Number.isSafeInteger(authorization.issuedAt) || authorization.issuedAt > at ||
      !Number.isSafeInteger(authorization.expiresAt) || authorization.expiresAt <= at ||
      authorization.expiresAt - authorization.issuedAt > MAX_APPROVAL_MS) {
      await recordAudit({ deviceId, requestId, phase: "DENIED" });
      return "UNKNOWN";
    }

    scope = Object.freeze({ actorId: authorization.actorId, approvalId: authorization.approvalId,
      deviceId, siteId: HOME_LEGACY_MATCH_SITE_ID, tenantId: authorization.tenantId, requestId });
    // The audit sink is append-only and must acknowledge the authorization
    // before the verifier or protected local credential can be accessed.
    if (await recordAudit({ ...scope, phase: "AUTHORIZED" }) !== true) return "UNKNOWN";

    // The trusted adapter must atomically consume this request ID and enforce
    // the two-attempt ceiling across processes. A replay must return false.
    const allowed = await consumeAttempt({ ...scope, maxAttempts: MAX_ATTEMPTS,
      expiresAt: authorization.expiresAt });
    if (allowed !== true) {
      await recordAudit({ ...scope, phase: "DENIED" });
      return "UNKNOWN";
    }

    const binding = HOME_LEGACY_MATCH_BINDINGS[deviceId];
    if (!binding || binding.tenantId !== authorization.tenantId ||
      binding.deploymentProfile !== profile) {
      await recordAudit({ ...scope, phase: "DENIED" });
      return "UNKNOWN";
    }

    // Recheck revocation/expiry against the authoritative approval store after
    // the attempt was consumed, not against a stale authorization snapshot.
    if (now() >= authorization.expiresAt || await confirmApprovalActive(scope) !== true) {
      await recordAudit({ ...scope, phase: "DENIED" });
      return "UNKNOWN";
    }
    // The trusted comparison component owns both sensitive inputs and returns
    // only a status. No verifier or credential crosses this interface.
    const result = await compareBoundCredential(binding);
    if (now() >= authorization.expiresAt || await confirmApprovalActive(scope) !== true) {
      await recordAudit({ ...scope, phase: "DENIED" });
      return "UNKNOWN";
    }
    const safeResult = RESULTS.has(result) ? result : "UNKNOWN";
    // Never include token, verifier, proof, request body, or raw error text.
    const audited = await recordAudit({ ...scope, phase: "RESULT", outcome: safeResult });
    return audited === true ? safeResult : "UNKNOWN";
  } catch {
    // Never log the exception: a trusted adapter may include sensitive values
    // in its error text. The audit record contains only approved metadata.
    if (scope) try { await recordAudit({ ...scope, phase: "ERROR" }); } catch { /* fail closed */ }
    return "UNKNOWN";
  }
}
