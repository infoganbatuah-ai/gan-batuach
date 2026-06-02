import { z } from "zod";

export const localShadowDetectionTypes = [
  "camera_offline",
  "camera_frozen_suspected",
  "motion_detected",
  "no_motion_too_long",
  "person_detected",
  "multiple_persons_detected",
  "restricted_area_occupancy",
  "camera_obstruction_suspected"
] as const;

export const frameSampleInputSchema = z.object({
  camera_id: z.string().uuid().optional(),
  kindergarten_id: z.string().uuid(),
  gateway_snapshot_url: z.string().url().nullable().optional(),
  frame_metadata: z.record(z.string(), z.unknown()).default({}),
  zone_id: z.string().uuid().nullable().optional(),
  timestamp: z.string().datetime().default(() => new Date().toISOString()),
  previous_frame_hash: z.string().nullable().optional(),
  motion_score: z.number().min(0).max(1).nullable().optional(),
  mock_scenario: z.string().optional()
});

export type FrameSampleInput = z.infer<typeof frameSampleInputSchema>;

export type LocalShadowDetection = {
  event_type: (typeof localShadowDetectionTypes)[number];
  severity: "info" | "low" | "medium" | "high" | "urgent" | "critical";
  confidence_score: number;
  title: string;
  description: string;
  recommended_action: string;
  dedupe_key: string;
  metadata: Record<string, unknown>;
};

export interface LocalDetector {
  provider: "local_mock" | "opencv" | "yolo" | "local_model_endpoint";
  mode: "shadow";
  analyze(input: FrameSampleInput, context?: { camera?: Record<string, any> | null; zone?: Record<string, any> | null; routine?: Record<string, any> | null; learningProfile?: Record<string, any> | null }): Promise<LocalShadowDetection[]>;
}

function dedupe(input: FrameSampleInput, eventType: string, windowMinutes = 10) {
  const bucket = Math.floor(new Date(input.timestamp).getTime() / (windowMinutes * 60 * 1000));
  return [input.kindergarten_id, input.camera_id ?? "camera", input.zone_id ?? "zone", eventType, bucket, "shadow"].join(":");
}

export class LocalMockDetector implements LocalDetector {
  provider = "local_mock" as const;
  mode = "shadow" as const;

  async analyze(inputValue: FrameSampleInput, context: { camera?: Record<string, any> | null; zone?: Record<string, any> | null; routine?: Record<string, any> | null; learningProfile?: Record<string, any> | null } = {}) {
    const input = frameSampleInputSchema.parse(inputValue);
    const scenario = normalizeScenario(input.mock_scenario) ?? inferScenario(input, context);
    const zoneName = context.zone?.name ?? context.camera?.area ?? "אזור מצלמה";
    const baseMetadata = {
      shadow_mode: true,
      requires_human_review: true,
      parent_visible: false,
      provider: this.provider,
      mode: this.mode,
      frame_metadata: input.frame_metadata,
      routine_context_present: Boolean(context.routine),
      learning_profile_status: context.learningProfile?.learning_status ?? null,
      no_personal_identity: true,
      no_face_recognition: true,
      no_audio_analysis: true,
      no_external_ai: true
    };
    const detections: Record<(typeof localShadowDetectionTypes)[number], Omit<LocalShadowDetection, "dedupe_key">> = {
      camera_offline: {
        event_type: "camera_offline",
        severity: "urgent",
        confidence_score: 0.91,
        title: "מצלמה לא מחוברת לבדיקה",
        description: "זיהוי ניסיוני במצב shadow: אינדיקציה שהמצלמה אינה מחוברת. נדרשת בדיקת אדם.",
        recommended_action: "בדקי את חיבור המצלמה ואת סטטוס ה-Gateway.",
        metadata: { ...baseMetadata, signal: "camera_status" }
      },
      camera_frozen_suspected: {
        event_type: "camera_frozen_suspected",
        severity: "high",
        confidence_score: 0.82,
        title: "חשד לתמונה קפואה",
        description: "זיהוי ניסיוני במצב shadow: ייתכן שהפריים לא השתנה לאורך זמן. נדרשת בדיקת אדם.",
        recommended_action: "פתחי בדיקת מצלמה ובדקי אם השידור חי.",
        metadata: { ...baseMetadata, signal: "frame_hash" }
      },
      motion_detected: {
        event_type: "motion_detected",
        severity: "low",
        confidence_score: input.motion_score ?? 0.64,
        title: "תנועה זוהתה לבדיקה",
        description: `זיהוי ניסיוני במצב shadow: תנועה זוהתה באזור ${zoneName}. אין פעולה אוטומטית.`,
        recommended_action: "אין צורך בפעולה אלא אם קיימת אינדיקציה נוספת.",
        metadata: { ...baseMetadata, signal: "motion_score" }
      },
      no_motion_too_long: {
        event_type: "no_motion_too_long",
        severity: "medium",
        confidence_score: 0.74,
        title: "חשד לחוסר תנועה ממושך",
        description: `זיהוי ניסיוני במצב shadow: חוסר תנועה באזור ${zoneName} ביחס לשגרה המוגדרת. נדרשת בדיקת אדם.`,
        recommended_action: "בדקי את המצלמה ואת ההקשר היומי לפני כל מסקנה.",
        metadata: { ...baseMetadata, signal: "low_motion" }
      },
      person_detected: {
        event_type: "person_detected",
        severity: "info",
        confidence_score: 0.78,
        title: "דמות זוהתה לבדיקה",
        description: `זיהוי ניסיוני במצב shadow: דמות זוהתה באזור ${zoneName}. אין זיהוי אישי.`,
        recommended_action: "אין פעולה נדרשת. זהו signal ל-baseline בלבד.",
        metadata: { ...baseMetadata, signal: "person_presence" }
      },
      multiple_persons_detected: {
        event_type: "multiple_persons_detected",
        severity: "medium",
        confidence_score: 0.76,
        title: "מספר דמויות זוהו לבדיקה",
        description: `זיהוי ניסיוני במצב shadow: מספר דמויות באזור ${zoneName}. אין זיהוי אישי.`,
        recommended_action: "בדקי רק אם האזור מוגבל או מחוץ לשגרת היום.",
        metadata: { ...baseMetadata, signal: "multiple_persons" }
      },
      restricted_area_occupancy: {
        event_type: "restricted_area_occupancy",
        severity: "urgent",
        confidence_score: 0.84,
        title: "נוכחות אפשרית באזור מוגבל",
        description: `זיהוי ניסיוני במצב shadow: אינדיקציה לנוכחות באזור מוגבל ${zoneName}. נדרשת בדיקת אדם.`,
        recommended_action: "בדקי את האזור וסמני false positive אם אין בעיה.",
        metadata: { ...baseMetadata, signal: "restricted_zone" }
      },
      camera_obstruction_suspected: {
        event_type: "camera_obstruction_suspected",
        severity: "high",
        confidence_score: 0.8,
        title: "חשד לחסימת מצלמה",
        description: "זיהוי ניסיוני במצב shadow: ייתכן שהמצלמה חסומה או מכוסה. נדרשת בדיקת אדם.",
        recommended_action: "בדקי את המצלמה פיזית או דרך Preview מאובטח.",
        metadata: { ...baseMetadata, signal: "obstruction" }
      }
    };
    return [{ ...detections[scenario], dedupe_key: dedupe(input, scenario, scenario === "camera_offline" ? 30 : 10) }];
  }
}

function inferScenario(input: FrameSampleInput, context: { camera?: Record<string, any> | null; zone?: Record<string, any> | null }) {
  if (context.camera?.active === false || ["offline", "error", "disabled"].includes(String(context.camera?.status ?? ""))) return "camera_offline";
  if (context.zone?.is_restricted) return "restricted_area_occupancy";
  if (input.previous_frame_hash && input.frame_metadata?.frame_hash === input.previous_frame_hash) return "camera_frozen_suspected";
  if (typeof input.motion_score === "number" && input.motion_score < 0.08) return "no_motion_too_long";
  if (typeof input.motion_score === "number" && input.motion_score > 0.55) return "motion_detected";
  return "person_detected";
}

function normalizeScenario(scenario?: string): (typeof localShadowDetectionTypes)[number] | undefined {
  const map: Record<string, (typeof localShadowDetectionTypes)[number]> = {
    camera_offline: "camera_offline",
    camera_frozen_suspected: "camera_frozen_suspected",
    motion_detected: "motion_detected",
    no_motion_too_long: "no_motion_too_long",
    person_detected: "person_detected",
    multiple_persons_detected: "multiple_persons_detected",
    restricted_area_occupancy: "restricted_area_occupancy",
    camera_obstruction_suspected: "camera_obstruction_suspected",
    person_in_restricted_area: "restricted_area_occupancy",
    restricted_area_entry: "restricted_area_occupancy",
    child_missing_from_area: "no_motion_too_long",
    fall_suspected: "motion_detected",
    crowding_suspected: "multiple_persons_detected",
    door_open: "motion_detected",
    pickup_mismatch: "person_detected",
    audio_anomaly: "motion_detected",
    keyword_detected: "motion_detected"
  };
  return scenario ? map[scenario] : undefined;
}

export function createLocalDetector(): LocalDetector {
  return new LocalMockDetector();
}
