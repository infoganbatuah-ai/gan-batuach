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

// All dependencies are trusted, server-side capabilities, not caller-supplied
// request fields. An adapter must obtain administrator authorization from the
// approved identity system, enforce an atomic rate limit, and send a redacted
// audit record to an approved append-only sink before returning a result.
export async function evaluateHomeLegacyMatch({ deviceId }, {
  authorizeAdministrator, resolveApprovedBinding, consumeAttempt, loadScopedRows,
  loadProtectedCredential, recordAudit,
  now = () => Date.now()
} = {}) {
  const profile = HOME_LEGACY_MATCH_DEVICES[deviceId];
  if (!profile || !Object.hasOwn(HOME_LEGACY_MATCH_DEVICES, deviceId)) return "UNKNOWN";
  if (![authorizeAdministrator, resolveApprovedBinding, consumeAttempt, loadScopedRows,
    loadProtectedCredential, recordAudit, now]
    .every(value => typeof value === "function")) return "UNKNOWN";

  try {
    const authorization = await authorizeAdministrator();
    if (!authorization || authorization.authenticated !== true || authorization.role !== "platform_admin" ||
      authorization.purpose !== "HOME_TELEMETRY_LEGACY_MATCH" ||
      authorization.deviceId !== deviceId ||
      authorization.siteId !== HOME_LEGACY_MATCH_SITE_ID ||
      typeof authorization.tenantId !== "string" || !authorization.tenantId ||
      typeof authorization.actorId !== "string" || !authorization.actorId ||
      typeof authorization.approvalId !== "string" || !authorization.approvalId ||
      !Number.isSafeInteger(authorization.expiresAt) || authorization.expiresAt <= now()) return "UNKNOWN";

    // Must be atomic across workers. Fail closed if the approved limiter is
    // unavailable. Neither an enrollment lookup nor a secret read precedes it.
    const allowed = await consumeAttempt({ actorId: authorization.actorId, deviceId,
      approvalId: authorization.approvalId });
    if (allowed !== true) return "UNKNOWN";

    const approvedBinding = await resolveApprovedBinding(deviceId);
    if (!approvedBinding || approvedBinding.deviceId !== deviceId ||
      approvedBinding.siteId !== HOME_LEGACY_MATCH_SITE_ID ||
      approvedBinding.deploymentProfile !== profile ||
      approvedBinding.tenantId !== authorization.tenantId ||
      typeof approvedBinding.enrollmentId !== "string" || !approvedBinding.enrollmentId ||
      !Number.isInteger(approvedBinding.configVersion) || approvedBinding.configVersion < 1) return "UNKNOWN";

    const binding = Object.freeze({ ...approvedBinding });
    // Both loaders must execute only inside the approved host-local boundary.
    // The scoped reader must never return these rows to an HTTP response.
    const rows = await loadScopedRows(binding);
    const localCredential = await loadProtectedCredential({ deviceId, deploymentProfile: profile });
    const result = compareLegacyCredentialReadonly({ rows, expected: {
      id: binding.enrollmentId, gateway_id: binding.deviceId,
      observer_site_id: binding.siteId, tenant_id: binding.tenantId,
      deployment_profile: binding.deploymentProfile,
      config_version: binding.configVersion
    }, localCredential });
    const safeResult = RESULTS.has(result) ? result : "UNKNOWN";
    // Never include token, verifier, proof, request body, or raw error text.
    const audited = await recordAudit({ actorId: authorization.actorId,
      approvalId: authorization.approvalId, deviceId, siteId: binding.siteId,
      tenantId: binding.tenantId, outcome: safeResult });
    return audited === true ? safeResult : "UNKNOWN";
  } catch {
    return "UNKNOWN";
  }
}
