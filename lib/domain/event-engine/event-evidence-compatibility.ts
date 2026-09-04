import "server-only";
import { z } from "zod";
import type { ZoneType } from "./camera-zone-mapper";

export const eventEvidenceKindSchema = z.enum([
  "object_detection",
  "object_detection_off_hours",
  "line_crossing",
  "validated_rule",
  "stream_health"
]);

export const cloudCameraEventSchema = z.object({
  event_id: z.string().uuid(), camera_source_id: z.string().uuid(), stream_id: z.string().min(1).max(160),
  event_type: z.string().min(1).max(80), severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
  confidence: z.number().min(0).max(1), timestamp: z.string().datetime(),
  track_id: z.string().max(120).optional(), evidence_kind: eventEvidenceKindSchema,
  // Gateway inference provenance is metadata, not a replacement for server
  // validation. Accept it so a real edge event remains traceable end-to-end.
  model_provenance: z.object({
    model: z.string().min(1).max(160), runtime: z.string().min(1).max(160), execution_provider: z.string().min(1).max(80),
    expected_sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional()
  }).strict().optional(),
  media_failure_reason: z.enum(["capture_window_elapsed", "capture_failed"]).optional()
}).strict();

export type CloudCameraEvent = z.infer<typeof cloudCameraEventSchema>;
export type EventEvidenceCompatibilityReason =
  | "direction_not_verified"
  | "specialized_evidence_required"
  | "off_hours_evidence_type_mismatch"
  | "off_hours_zone_mismatch"
  | "off_hours_not_verified"
  | "crossing_evidence_type_mismatch"
  | "specialized_model_not_verified"
  | "health_evidence_type_mismatch";

type EvidenceContext = {
  zone_type: ZoneType;
  crossing_line_valid: boolean;
  off_hours_active: boolean;
  verified_event_models?: unknown;
};

const directionalEvents = new Set(["person_entered", "person_exited", "vehicle_entered", "vehicle_exited"]);
const healthEvents = new Set(["camera_offline", "camera_reconnected"]);
const offHoursEvents: Readonly<Record<string, ZoneType>> = {
  person_near_pool_off_hours: "POOL",
  unauthorized_night_motion: "PERIMETER"
};

function modelVerified(value: unknown, eventType: string): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, eventType)
    && (value as Record<string, unknown>)[eventType] === true);
}

export function eventEvidenceCompatibility(
  event: Pick<CloudCameraEvent, "evidence_kind" | "event_type">,
  context: EvidenceContext
): { compatible: true } | { compatible: false; reason: EventEvidenceCompatibilityReason } {
  if (directionalEvents.has(event.event_type)
    && (event.evidence_kind !== "line_crossing" || !context.crossing_line_valid)) {
    return { compatible: false, reason: "direction_not_verified" };
  }
  if (event.evidence_kind === "object_detection") {
    return event.event_type === "person_detected"
      ? { compatible: true }
      : { compatible: false, reason: "specialized_evidence_required" };
  }
  if (event.evidence_kind === "object_detection_off_hours") {
    const requiredZone = offHoursEvents[event.event_type];
    if (!requiredZone) return { compatible: false, reason: "off_hours_evidence_type_mismatch" };
    if (requiredZone !== context.zone_type) return { compatible: false, reason: "off_hours_zone_mismatch" };
    if (!context.off_hours_active) return { compatible: false, reason: "off_hours_not_verified" };
    if (!modelVerified(context.verified_event_models, event.event_type)) {
      return { compatible: false, reason: "specialized_model_not_verified" };
    }
    return { compatible: true };
  }
  if (event.evidence_kind === "line_crossing") {
    return directionalEvents.has(event.event_type)
      ? { compatible: true }
      : { compatible: false, reason: "crossing_evidence_type_mismatch" };
  }
  if (event.evidence_kind === "validated_rule") {
    return modelVerified(context.verified_event_models, event.event_type)
      ? { compatible: true }
      : { compatible: false, reason: "specialized_model_not_verified" };
  }
  return healthEvents.has(event.event_type)
    ? { compatible: true }
    : { compatible: false, reason: "health_evidence_type_mismatch" };
}
