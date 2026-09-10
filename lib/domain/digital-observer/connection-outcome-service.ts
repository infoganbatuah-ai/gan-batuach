import "server-only";
import { writeAuditEvent } from "@/lib/security/audit-log-service";
import { sanitizeConnectivityObservation } from "./connection-intelligence";
import type { PersistentPathProof } from "./connection-orchestrator";

// Reuses append-only audit storage. Caller derives outcome from authenticated
// runtime, never browser JSON. Missing telemetry must not fail activation.
export async function recordConnectivityOutcome(input: unknown, scope: {
  siteId: string; actorId: string; proof?: PersistentPathProof;
}) {
  try {
    const observation = sanitizeConnectivityObservation(input, scope.siteId, scope.proof);
    await writeAuditEvent({ eventType: "connectivity_outcome", eventCategory: "camera",
      actorProfileId: scope.actorId, targetType: "observer_site", targetId: scope.siteId,
      requestId: observation.attemptId, riskLevel: "low", metadata: { connectivity_observation: observation } });
  } catch {
    // Never log rejected input; it may contain forbidden private fields.
    console.warn("[connectivity] observation unavailable", { category: "TELEMETRY_VALIDATION" });
  }
}
