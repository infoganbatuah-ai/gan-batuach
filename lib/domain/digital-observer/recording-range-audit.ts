import "server-only";

import { isCanonicalAuditId, writeAuditEventAcknowledged } from "@/lib/security/audit-log-service";
import { createRecordingRangeAdapter } from "./recording-range-retrieval";

export function createAuditedRecordingRangeAdapter(
  options: Omit<Parameters<typeof createRecordingRangeAdapter>[0], "writeAccessAudit">
) {
  return createRecordingRangeAdapter({
    ...options,
    async writeAccessAudit(entry) {
      const { actorId, tenantId, siteId, sourceId, eventId, evidenceId } = entry;
      if (![actorId, tenantId, siteId, sourceId, eventId, evidenceId].every(isCanonicalAuditId)) return false;
      return writeAuditEventAcknowledged({
        eventType: "observer_recording_range_authorized",
        eventCategory: "observer",
        actorProfileId: actorId,
        targetType: "observer_evidence",
        targetId: evidenceId,
        cameraId: sourceId,
        riskLevel: "high",
        metadata: {
          tenant_id: tenantId,
          observer_site_id: siteId,
          event_id: eventId,
          range_from_inclusive: entry.fromInclusive,
          range_to_exclusive: entry.toExclusive,
          confirmed_scope_at: entry.authorizedAt,
        },
      });
    },
  });
}
