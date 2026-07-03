import { z } from "zod";
import { safetyIncidentTypes } from "@/lib/domain/safety-incident-framework";

export const aiCameraEventTypes = [
  "person_detected",
  "unauthorized_person",
  "child_missing_from_area",
  "restricted_area_entry",
  "fall_suspected",
  "crowding_suspected",
  "gate_or_door_open",
  "pickup_mismatch",
  "staff_behavior_concern",
  "distress_suspected",
  "violence_indicator",
  "aggressive_behavior_indicator",
  "prolonged_crying_indicator",
  "child_left_alone_indicator",
  "staff_absence_indicator",
  "unusual_crowding",
  "emergency_behavior_indicator",
  "camera_tampering",
  "camera_offline",
  "camera_frozen_suspected",
  "motion_detected",
  "no_motion_too_long",
  "multiple_persons_detected",
  "restricted_area_occupancy",
  "camera_obstruction_suspected"
] as const;

export const aiCameraEventSchema = z.object({
  kindergarten_id: z.string().uuid(),
  camera_id: z.string().uuid().optional(),
  child_id: z.string().uuid().optional(),
  staff_id: z.string().uuid().optional(),
  event_type: z.enum(aiCameraEventTypes),
  severity: z.enum(["info", "low", "medium", "high", "urgent", "critical"]).default("medium"),
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  confidence_score: z.coerce.number().min(0).max(1).optional(),
  snapshot_url: z.string().url().optional().or(z.literal("")),
  clip_url: z.string().url().optional().or(z.literal("")),
  detected_entities: z.array(z.record(z.string(), z.unknown())).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
  is_demo: z.boolean().optional()
});

export const aiCameraReviewActionSchema = z.object({
  action: z.enum(["review", "confirm", "dismiss", "escalate", "false_positive", "valid_detection", "needs_more_data"]),
  review_notes: z.string().optional()
});

export const aiEventTypeLabels: Record<(typeof aiCameraEventTypes)[number], string> = {
  person_detected: "דמות אפשרית לבדיקה",
  unauthorized_person: "חשד לאדם לא מורשה",
  child_missing_from_area: "חשד שילד חסר מאזור",
  restricted_area_entry: "כניסה אפשרית לאזור מוגבל",
  fall_suspected: "חשד לנפילה",
  crowding_suspected: "חשד לצפיפות",
  gate_or_door_open: "שער או דלת פתוחים לבדיקה",
  pickup_mismatch: "חשד לאי התאמה באיסוף",
  staff_behavior_concern: "אינדיקציה תפעולית לבדיקה",
  distress_suspected: "חשד למצוקה",
  violence_indicator: "אינדיקציה לתנועה חריגה לבדיקה",
  aggressive_behavior_indicator: "אינדיקציה לתנועה חריגה",
  prolonged_crying_indicator: "אינדיקציה חזותית למצוקה לבדיקה",
  child_left_alone_indicator: "אינדיקציה לילד ללא השגחה",
  staff_absence_indicator: "אינדיקציה לחוסר נוכחות צוות",
  unusual_crowding: "צפיפות חריגה לבדיקה",
  emergency_behavior_indicator: "אינדיקציה להתנהגות חירום",
  camera_tampering: "חשד לחבלה במצלמה",
  camera_offline: "מצלמה לא מחוברת",
  camera_frozen_suspected: "חשד לתמונה קפואה",
  motion_detected: "תנועה אפשרית לבדיקה",
  no_motion_too_long: "חשד לחוסר תנועה ממושך",
  multiple_persons_detected: "מספר דמויות אפשריות לבדיקה",
  restricted_area_occupancy: "נוכחות אפשרית באזור מוגבל",
  camera_obstruction_suspected: "חשד לחסימת מצלמה"
};

export function titleForAiCameraEvent(eventType: (typeof aiCameraEventTypes)[number]) {
  return aiEventTypeLabels[eventType] ?? "אירוע תצפיתן לבדיקה";
}

export function describeObserverPipeline() {
  return ["Camera Stream", "Video Gateway", "AI Observer Worker", "Frame Sampling", "AI/Event Rules", "ai_camera_events", "notifications", "manager/admin/inspector dashboards"];
}

export { safetyIncidentTypes };
