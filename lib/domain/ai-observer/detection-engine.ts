import { z } from "zod";

export const detectionProviderSchema = z.enum(["mock", "openai_vision", "gemini_vision", "azure_vision", "yolo", "custom"]);

export type DetectionProvider = z.infer<typeof detectionProviderSchema>;

export type ObserverDetection = {
  rule_key: string;
  event_type: string;
  confidence: number;
  title: string;
  description: string;
  explanation?: string;
  cost_estimate?: {
    provider: DetectionProvider;
    units: number;
    estimated_usd: number;
  };
  zone_type?: string;
  metadata?: Record<string, unknown>;
};

export type DetectionInput = {
  provider?: DetectionProvider;
  imageFrame?: {
    storagePath?: string;
    signedUrl?: string;
    capturedAt?: string;
    width?: number;
    height?: number;
  };
  videoClip?: {
    storagePath?: string;
    signedUrl?: string;
    durationSeconds?: number;
    startedAt?: string;
    endedAt?: string;
  };
  camera?: Record<string, any> | null;
  zone?: Record<string, any> | null;
  rule?: Record<string, any> | null;
  childContext?: Record<string, any> | null;
  staffContext?: Record<string, any> | null;
  consentContext?: {
    aiEnabled: boolean;
    externalProviderAllowed: boolean;
  };
  budgetContext?: {
    monthlyLimitUsd?: number;
    spentThisMonthUsd?: number;
    perCameraRateLimitPerHour?: number;
  };
  mockScenario?: string;
};

export interface DetectionEngine {
  provider: DetectionProvider;
  analyze(input: DetectionInput): Promise<ObserverDetection[]>;
}

export class MockDetectionEngine implements DetectionEngine {
  provider: DetectionProvider = "mock";

  async analyze(input: DetectionInput): Promise<ObserverDetection[]> {
    const scenario = input.mockScenario ?? input.rule?.rule_key ?? "fall_suspected";
    const zoneName = input.zone?.name ?? input.camera?.area ?? "אזור מצלמה";
    const labels: Record<string, ObserverDetection> = {
      camera_offline: {
        rule_key: "camera_offline",
        event_type: "camera_offline",
        confidence: 0.91,
        title: "מצלמה לא מחוברת לבדיקה",
        description: "בדיקת mock סימנה שהמצלמה דורשת בדיקת חיבור. אין עיבוד וידאו אמיתי.",
        zone_type: input.zone?.zone_type,
        metadata: { mock: true, scenario }
      },
      person_in_restricted_area: {
        rule_key: "person_in_restricted_area",
        event_type: "restricted_area_entry",
        confidence: 0.83,
        title: "כניסה אפשרית לאזור מוגבל",
        description: `זוהתה אינדיקציית mock באזור ${zoneName}. נדרש review אנושי לפני הסלמה.`,
        zone_type: input.zone?.zone_type ?? "restricted_area",
        metadata: { mock: true, scenario }
      },
      child_missing_from_area: {
        rule_key: "child_missing_from_area",
        event_type: "child_missing_from_area",
        confidence: 0.84,
        title: "חשד שילד חסר מאזור",
        description: `אינדיקציית mock באזור ${zoneName}. אין קביעה אוטומטית, רק משימת review.`,
        zone_type: input.zone?.zone_type,
        metadata: { mock: true, scenario }
      },
      fall_suspected: {
        rule_key: "fall_suspected",
        event_type: "fall_suspected",
        confidence: 0.79,
        title: "חשד לנפילה",
        description: `זוהתה אינדיקציית mock לנפילה באזור ${zoneName}. נדרש review אנושי.`,
        zone_type: input.zone?.zone_type,
        metadata: { mock: true, scenario }
      },
      crowding_suspected: {
        rule_key: "crowding_suspected",
        event_type: "crowding_suspected",
        confidence: 0.73,
        title: "חשד לצפיפות",
        description: `אינדיקציית mock לצפיפות באזור ${zoneName}.`,
        zone_type: input.zone?.zone_type,
        metadata: { mock: true, scenario }
      },
      door_open: {
        rule_key: "door_open",
        event_type: "gate_or_door_open",
        confidence: 0.76,
        title: "שער או דלת פתוחים לבדיקה",
        description: "אינדיקציית mock לדלת/שער פתוחים. נדרש review אנושי.",
        zone_type: input.zone?.zone_type ?? "entrance",
        metadata: { mock: true, scenario }
      },
      pickup_mismatch: {
        rule_key: "pickup_mismatch",
        event_type: "pickup_mismatch",
        confidence: 0.86,
        title: "חשד לאי התאמה באיסוף",
        description: "אינדיקציית mock בלבד. אין הודעה להורים לפני review אנושי.",
        zone_type: input.zone?.zone_type ?? "exit",
        metadata: { mock: true, scenario }
      },
      distress_suspected: {
        rule_key: "distress_suspected",
        event_type: "distress_suspected",
        confidence: 0.72,
        title: "חשד למצוקה - דורש בדיקת אדם",
        description: "אינדיקציית mock בלבד. אין מסקנה ואין הודעה להורים לפני review.",
        zone_type: input.zone?.zone_type,
        metadata: { mock: true, scenario, safety_framework: true }
      },
      violence_indicator: {
        rule_key: "violence_indicator",
        event_type: "violence_indicator",
        confidence: 0.74,
        title: "אינדיקציה לתנועה חריגה לבדיקה",
        description: "אינדיקציית mock בלבד. אין האשמה, אין זיהוי אלימות ואין מסקנה משמעתית.",
        zone_type: input.zone?.zone_type,
        metadata: { mock: true, scenario, safety_framework: true }
      },
      aggressive_behavior_indicator: {
        rule_key: "aggressive_behavior_indicator",
        event_type: "aggressive_behavior_indicator",
        confidence: 0.7,
        title: "אינדיקציה לתנועה חריגה",
        description: "אינדיקציית mock לתנועה חריגה. נדרש review אנושי.",
        zone_type: input.zone?.zone_type,
        metadata: { mock: true, scenario, safety_framework: true }
      },
      prolonged_crying_indicator: {
        rule_key: "prolonged_crying_indicator",
        event_type: "prolonged_crying_indicator",
        confidence: 0.68,
        title: "אינדיקציה חזותית למצוקה לבדיקה",
        description: "אינדיקציית mock בלבד. אין ניתוח שמע, אין האזנה ואין מסקנה אוטומטית.",
        zone_type: input.zone?.zone_type,
        metadata: { mock: true, scenario, safety_framework: true, audio_analysis: false }
      },
      child_left_alone_indicator: {
        rule_key: "child_left_alone_indicator",
        event_type: "child_left_alone_indicator",
        confidence: 0.76,
        title: "אינדיקציה לילד ללא השגחה",
        description: "אינדיקציית mock רגישה. אין קביעה אוטומטית.",
        zone_type: input.zone?.zone_type,
        metadata: { mock: true, scenario, safety_framework: true }
      },
      staff_absence_indicator: {
        rule_key: "staff_absence_indicator",
        event_type: "staff_absence_indicator",
        confidence: 0.71,
        title: "אינדיקציה לחוסר נוכחות צוות",
        description: "אינדיקציית mock לאזור ללא צוות ביחס לשגרה. נדרש אימות.",
        zone_type: input.zone?.zone_type,
        metadata: { mock: true, scenario, safety_framework: true }
      },
      unusual_crowding: {
        rule_key: "unusual_crowding",
        event_type: "unusual_crowding",
        confidence: 0.69,
        title: "צפיפות חריגה לבדיקה",
        description: "אינדיקציית mock לצפיפות ביחס לשגרה.",
        zone_type: input.zone?.zone_type,
        metadata: { mock: true, scenario, safety_framework: true }
      },
      emergency_behavior_indicator: {
        rule_key: "emergency_behavior_indicator",
        event_type: "emergency_behavior_indicator",
        confidence: 0.78,
        title: "אינדיקציה להתנהגות חירום",
        description: "אינדיקציית mock דחופה. אין הסלמה אוטומטית.",
        zone_type: input.zone?.zone_type,
        metadata: { mock: true, scenario, safety_framework: true }
      },
    };
    return [labels[scenario] ?? labels.fall_suspected];
  }
}

export function createDetectionEngine(provider: DetectionProvider = "mock"): DetectionEngine {
  if (provider !== "mock") {
    return new MockDetectionEngine();
  }
  return new MockDetectionEngine();
}
