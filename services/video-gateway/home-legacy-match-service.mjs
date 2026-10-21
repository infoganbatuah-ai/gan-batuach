// Preparation only: no HTTP route, Production connection, Keychain access, or
// device-side invocation is provided by this module. The trusted host adapter
// must keep both credential and verifier inside its protected process boundary.
import { compareLegacyCredentialReadonly } from "./legacy-identity-bridge.mjs";
export const HOME_LEGACY_MATCH_SITE_ID = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
export const HOME_LEGACY_MATCH_DEVICES = Object.freeze({
  "62df97e2-3c0b-427f-9108-bde029bc10e7": "PHYSICAL_GATEWAY",
  "db267b52-6282-4944-bcee-5d4857698fb0": "SOFTWARE_CONNECTOR"
});

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
  const { authorizeAdministrator, confirmApprovalActive, resolveApprovedBinding, consumeAttempt, loadScopedRows,
    loadProtectedCredential, recordAudit, now = () => Date.now() } = dependencies &&
      typeof dependencies === "object" ? dependencies : {};
  if (typeof deviceId !== "string" || typeof requestId !== "string" || !REQUEST_ID.test(requestId)) return "UNKNOWN";
  const profile = HOME_LEGACY_MATCH_DEVICES[deviceId];
  if (!profile || !Object.hasOwn(HOME_LEGACY_MATCH_DEVICES, deviceId)) return "UNKNOWN";
  if (![authorizeAdministrator, confirmApprovalActive, resolveApprovedBinding, consumeAttempt, loadScopedRows,
    loadProtectedCredential, recordAudit, now]
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

    const approvedBinding = await resolveApprovedBinding(deviceId);
    if (!approvedBinding || approvedBinding.deviceId !== deviceId ||
      approvedBinding.siteId !== HOME_LEGACY_MATCH_SITE_ID ||
      approvedBinding.deploymentProfile !== profile ||
      approvedBinding.tenantId !== authorization.tenantId ||
      typeof approvedBinding.enrollmentId !== "string" || !approvedBinding.enrollmentId ||
      !Number.isInteger(approvedBinding.configVersion) || approvedBinding.configVersion < 1) {
      await recordAudit({ ...scope, phase: "DENIED" });
      return "UNKNOWN";
    }

    const binding = Object.freeze({ ...approvedBinding });
    // Recheck revocation/expiry against the authoritative approval store after
    // the attempt was consumed, not against a stale authorization snapshot.
    if (now() >= authorization.expiresAt || await confirmApprovalActive(scope) !== true) {
      await recordAudit({ ...scope, phase: "DENIED" });
      return "UNKNOWN";
    }
    // Both loaders must execute only inside the approved host-local boundary.
    // The scoped reader must never return these rows to an HTTP response.
    const rows = await loadScopedRows(binding);
    const localCredential = await loadProtectedCredential({ deviceId, deploymentProfile: profile });
    if (now() >= authorization.expiresAt || await confirmApprovalActive(scope) !== true) {
      await recordAudit({ ...scope, phase: "DENIED" });
      return "UNKNOWN";
    }
    const result = compareLegacyCredentialReadonly({ rows, expected: {
      id: binding.enrollmentId, gateway_id: binding.deviceId,
      observer_site_id: binding.siteId, tenant_id: binding.tenantId,
      deployment_profile: binding.deploymentProfile,
      config_version: binding.configVersion
    }, localCredential });
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
