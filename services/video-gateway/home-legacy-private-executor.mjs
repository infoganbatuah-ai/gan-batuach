import { bindHomeLegacyApproval } from "./home-legacy-approval-store.mjs";
import { evaluateHomeLegacyMatch, HOME_LEGACY_MATCH_BINDINGS } from "./home-legacy-match-service.mjs";

// In-process composition only. This module opens no listener, database
// connection, Keychain item or network path. A separately reviewed deployment
// must supply the already-authorized store and a status-only comparator.
export function createHomeLegacyPrivateExecutor({ approvalStore, comparator, now = () => Date.now() }) {
  if (!approvalStore || !comparator ||
    typeof approvalStore.authorizeAdministrator !== "function" ||
    typeof approvalStore.confirmApprovalActive !== "function" ||
    typeof approvalStore.consumeAttempt !== "function" ||
    typeof approvalStore.recordAudit !== "function" ||
    typeof comparator.compareBoundCredential !== "function" ||
    typeof now !== "function") throw new TypeError("PRIVATE_EXECUTOR_CAPABILITIES_REQUIRED");

  return Object.freeze({
    async compare(input) {
      if (!input || typeof input !== "object" ||
        Object.keys(input).some(key => !["deviceId", "approvalId", "requestId", "administratorToken"].includes(key)) ||
        typeof input.deviceId !== "string" || !Object.hasOwn(HOME_LEGACY_MATCH_BINDINGS, input.deviceId) ||
        typeof input.approvalId !== "string" || typeof input.requestId !== "string" ||
        typeof input.administratorToken !== "string") return "UNKNOWN";
      try {
        const dependencies = bindHomeLegacyApproval({ store: approvalStore,
          approvalId: input.approvalId, deviceId: input.deviceId,
          accessToken: input.administratorToken, reader: comparator, now });
        const result = await evaluateHomeLegacyMatch({ deviceId: input.deviceId,
          requestId: input.requestId }, dependencies);
        return result === "MATCH" || result === "MISMATCH" ? result : "UNKNOWN";
      } catch {
        // Never surface adapter errors: SQL/Keychain errors may contain secrets.
        return "UNKNOWN";
      }
    }
  });
}
