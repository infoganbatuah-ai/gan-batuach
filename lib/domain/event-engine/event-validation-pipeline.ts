import { cameraZoneMapper, type CameraZone, type ZoneType } from "./camera-zone-mapper";

export type JournalSeverity = "INFO" | "WARNING" | "CRITICAL";
export type EventCandidate = { event_type: string; confidence?: number; severity?: string; title?: string; description?: string; metadata?: Record<string, unknown> };

export const CONTEXT_RULES_MATRIX: Record<ZoneType, ReadonlySet<string>> = {
  POOL: new Set(["drowning_hazard", "unsupervised_child", "person_near_pool_off_hours", "water_breach", "pool_entry_off_hours"]),
  PARKING: new Set(["vehicle_entered", "vehicle_exited", "lpr_unauthorized", "blocked_driveway", "unauthorized_parking", "unrecognized_vehicle"]),
  ENTRANCE: new Set(["person_detected", "person_entered", "person_exited", "authorized_entry", "face_identification", "pose_breach", "door_open", "door_close", "gate_or_door_open", "unrecognized_standing_visitor", "unauthorized_entry"]),
  PERIMETER: new Set(["fence_scaling", "unauthorized_night_motion", "fire_detected", "smoke_detected", "motion_after_hours"]),
  INDOOR: new Set(["person_detected", "person_entered", "person_exited", "room_entry", "room_exit", "fall_suspected", "distress_suspected", "camera_offline", "camera_obstruction_suspected", "restricted_area_entry"])
};

const aliases: Record<string, string> = { car_entered: "vehicle_entered", car_exited: "vehicle_exited", vehicle_entry: "vehicle_entered", vehicle_exit: "vehicle_exited", vehicle_in: "vehicle_entered", vehicle_out: "vehicle_exited", entry: "person_entered", exit: "person_exited", drowning: "drowning_hazard", fire: "fire_detected", smoke: "smoke_detected", door_closed: "door_close", visitor_unrecognized: "unrecognized_standing_visitor" };
export function canonicalJournalEventType(value: string): string {
  const type = value.trim().toLowerCase();
  return aliases[type] ?? type;
}

/** Read-time compatibility only. This does not authorize a legacy detector or
 * turn a generic vehicle sighting into directional/identity evidence. */
export function journalEventMatchesZone(value: string, zone: ZoneType): boolean | null {
  const type = canonicalJournalEventType(value);
  if (["camera_offline", "camera_reconnected"].includes(type)) return true;
  if (["vehicle_detected", "car_detected"].includes(type)) return zone === "PARKING";
  if (!Object.values(CONTEXT_RULES_MATRIX).some(types => types.has(type))) return null;
  return CONTEXT_RULES_MATRIX[zone].has(type);
}
const actionable = new Set(["CRITICAL", "WARNING"]);
const healthEvents = new Set(["camera_offline", "camera_reconnected"]);
const passiveEvents = new Set(["person_detected", "person_entered", "person_exited", "room_entry", "room_exit", "vehicle_entered", "vehicle_exited", "authorized_entry", "face_identification", "door_open", "door_close", "camera_reconnected"]);
const criticalEvents = new Set(["drowning_hazard", "fire_detected", "smoke_detected"]);
const recordedContextEvents: Partial<Record<ZoneType, ReadonlySet<string>>> = {
  ENTRANCE: new Set(["person_detected", "person_entered", "person_exited", "authorized_entry", "face_identification", "unrecognized_standing_visitor", "unauthorized_entry"]),
  PARKING: new Set(["vehicle_entered", "vehicle_exited", "unrecognized_vehicle", "lpr_unauthorized", "unauthorized_parking"]),
  POOL: new Set(["pool_entry_off_hours", "person_near_pool_off_hours"])
};
const severity = (value: unknown): JournalSeverity => String(value ?? "INFO").toUpperCase() === "CRITICAL" || String(value ?? "").toLowerCase() === "urgent" ? "CRITICAL" : actionable.has(String(value ?? "").toUpperCase()) || ["high", "medium"].includes(String(value ?? "").toLowerCase()) ? "WARNING" : "INFO";

export type ValidationResult = { accepted: true; camera: CameraZone; event: EventCandidate & { event_type: string; severity: JournalSeverity }; shouldRecord: boolean } | { accepted: false; reason: string; camera: CameraZone };

export class EventValidationPipeline {
  constructor(private mapper = cameraZoneMapper) {}
  validate(candidate: EventCandidate, camera: Record<string, any>, zone?: Record<string, any> | null): ValidationResult {
    const mapped = this.mapper.map(camera, zone);
    const eventType = canonicalJournalEventType(candidate.event_type);
    if (candidate.confidence !== undefined && (!Number.isFinite(candidate.confidence) || candidate.confidence < 0.55 || candidate.confidence > 1)) return { accepted: false, reason: "insufficient_detection_confidence", camera: mapped };
    if (mapped.source === "default" && !healthEvents.has(eventType) && !["person_detected", "camera_obstruction_suspected"].includes(eventType)) return { accepted: false, reason: "camera_zone_unmapped", camera: mapped };
    if (!healthEvents.has(eventType) && !CONTEXT_RULES_MATRIX[mapped.zone_type].has(eventType)) return { accepted: false, reason: `${eventType} is not allowed in ${mapped.zone_type}`, camera: mapped };
    const requestedSeverity = severity(candidate.severity);
    const normalized = { ...candidate, event_type: eventType, severity: criticalEvents.has(eventType) ? "CRITICAL" as const : passiveEvents.has(eventType) ? "INFO" as const : requestedSeverity === "INFO" ? "WARNING" as const : requestedSeverity };
    const contextRequiresEvidence = recordedContextEvents[mapped.zone_type]?.has(eventType) === true;
    return { accepted: true, camera: mapped, event: normalized, shouldRecord: !healthEvents.has(eventType) && (contextRequiresEvidence || actionable.has(normalized.severity) || ["fire_detected", "smoke_detected", "drowning_hazard"].includes(eventType)) };
  }
}

export const eventValidationPipeline = new EventValidationPipeline();
