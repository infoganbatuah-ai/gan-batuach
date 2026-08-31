import { cameraZoneMapper, type CameraZone, type ZoneType } from "./camera-zone-mapper";

export type JournalSeverity = "INFO" | "WARNING" | "CRITICAL";
export type EventCandidate = { event_type: string; confidence?: number; severity?: string; title?: string; description?: string; metadata?: Record<string, unknown> };

export const CONTEXT_RULES_MATRIX: Record<ZoneType, ReadonlySet<string>> = {
  POOL: new Set(["drowning_hazard", "unsupervised_child", "person_near_pool_off_hours", "water_breach", "pool_entry_off_hours"]),
  PARKING: new Set(["vehicle_entered", "vehicle_exited", "lpr_unauthorized", "blocked_driveway", "unauthorized_parking", "unrecognized_vehicle"]),
  ENTRANCE: new Set(["face_identification", "pose_breach", "door_open", "door_close", "gate_or_door_open", "unrecognized_standing_visitor", "unauthorized_entry"]),
  PERIMETER: new Set(["fence_scaling", "unauthorized_night_motion", "fire_detected", "smoke_detected", "motion_after_hours"]),
  INDOOR: new Set(["person_detected", "person_entered", "person_exited", "room_entry", "room_exit", "fall_suspected", "distress_suspected", "camera_offline", "camera_obstruction_suspected", "restricted_area_entry"])
};

const aliases: Record<string, string> = { car_entered: "vehicle_entered", car_exited: "vehicle_exited", vehicle_entry: "vehicle_entered", vehicle_exit: "vehicle_exited", vehicle_in: "vehicle_entered", vehicle_out: "vehicle_exited", entry: "person_entered", exit: "person_exited", drowning: "drowning_hazard", pool_entry: "pool_entry_off_hours", fire: "fire_detected", smoke: "smoke_detected", door_closed: "door_close", visitor_unrecognized: "unrecognized_standing_visitor" };
const actionable = new Set(["CRITICAL", "WARNING"]);
const severity = (value: unknown): JournalSeverity => String(value ?? "INFO").toUpperCase() === "CRITICAL" || String(value ?? "").toLowerCase() === "urgent" ? "CRITICAL" : actionable.has(String(value ?? "").toUpperCase()) || ["high", "medium"].includes(String(value ?? "").toLowerCase()) ? "WARNING" : "INFO";

export type ValidationResult = { accepted: true; camera: CameraZone; event: EventCandidate & { event_type: string; severity: JournalSeverity }; shouldRecord: boolean } | { accepted: false; reason: string; camera: CameraZone };

export class EventValidationPipeline {
  constructor(private mapper = cameraZoneMapper) {}
  validate(candidate: EventCandidate, camera: Record<string, any>, zone?: Record<string, any> | null): ValidationResult {
    const mapped = this.mapper.map(camera, zone);
    const eventType = aliases[candidate.event_type.toLowerCase()] ?? candidate.event_type.toLowerCase();
    if (!CONTEXT_RULES_MATRIX[mapped.zone_type].has(eventType)) return { accepted: false, reason: `${eventType} is not allowed in ${mapped.zone_type}`, camera: mapped };
    const normalized = { ...candidate, event_type: eventType, severity: severity(candidate.severity) };
    return { accepted: true, camera: mapped, event: normalized, shouldRecord: actionable.has(normalized.severity) || ["fire_detected", "smoke_detected", "drowning_hazard", "pool_entry_off_hours", "unauthorized_entry", "lpr_unauthorized"].includes(eventType) };
  }
}

export const eventValidationPipeline = new EventValidationPipeline();
