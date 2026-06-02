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
  audioSegment?: {
    storagePath?: string;
    signedUrl?: string;
    durationSeconds?: number;
    language?: string;
  };
  camera?: Record<string, any> | null;
  zone?: Record<string, any> | null;
  rule?: Record<string, any> | null;
  childContext?: Record<string, any> | null;
  staffContext?: Record<string, any> | null;
  consentContext?: {
    aiEnabled: boolean;
    audioAllowed: boolean;
    faceRecognitionAllowed: boolean;
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
      audio_anomaly: {
        rule_key: "audio_anomaly",
        event_type: "audio_anomaly",
        confidence: 0.77,
        title: "חריגת שמע לבדיקה",
        description: "אינדיקציית mock לחריגת שמע. אין ניתוח שמע אמיתי בשלב זה.",
        zone_type: input.zone?.zone_type,
        metadata: { mock: true, scenario }
      },
      keyword_detected: {
        rule_key: "keyword_detected",
        event_type: "keyword_detected",
        confidence: 0.81,
        title: "מילת מפתח זוהתה לבדיקה",
        description: "אינדיקציית mock למילת מפתח. אין האזנה או ניתוח שמע אמיתי בשלב זה.",
        zone_type: input.zone?.zone_type,
        metadata: { mock: true, scenario }
      }
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
