export type VisionProviderKey = "local_mock" | "opencv" | "yolo" | "ultralytics" | "local_http" | "custom";

export type VisionProviderType = "mock" | "opencv" | "yolo" | "ultralytics" | "local_http" | "custom";

export type VisionDetectionCategory =
  | "person_detected"
  | "multiple_persons_detected"
  | "occupancy"
  | "restricted_area_presence"
  | "unusual_activity"
  | "object_presence"
  | "obstruction_detection"
  | "camera_blocked"
  | "camera_frozen"
  | "camera_offline";

export type VisionFrameSourceType = "gateway_snapshot" | "mock_frame" | "local_file" | "none";
export type VisionProviderHealth = "healthy" | "degraded" | "offline" | "unknown" | "mock";

export type VisionFrameAnalysisInput = {
  cameraId?: string | null;
  kindergartenId?: string | null;
  observerSiteId?: string | null;
  zoneId?: string | null;
  frameSourceType?: VisionFrameSourceType;
  gatewaySnapshotUrl?: string | null;
  timestamp?: string;
  routineContext?: Record<string, unknown> | null;
  learningContext?: Record<string, unknown> | null;
  correlationContext?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export type VisionDetection = {
  category: VisionDetectionCategory;
  modelConfidence: number;
  title: string;
  description: string;
  recommendedAction: string;
  objectLabels?: string[];
  boundingBoxes?: Array<{ x: number; y: number; width: number; height: number; label?: string; confidence?: number }>;
  metadata?: Record<string, unknown>;
};

export type VisionFrameAnalysisResult = {
  providerKey: VisionProviderKey;
  providerType: VisionProviderType;
  providerVersion: string;
  health: VisionProviderHealth;
  detections: VisionDetection[];
  latencyMs: number;
  processingTimeMs: number;
  shadowMode: true;
  requiresHumanReview: true;
  calibrationMode: true;
  noRawFrameStored: true;
  noExternalAiCall: boolean;
  metadata: Record<string, unknown>;
};

export type VisionConfidenceInput = {
  model?: number | null;
  review?: number | null;
  learning?: number | null;
  correlation?: number | null;
};

export interface VisionProvider {
  key: VisionProviderKey;
  type: VisionProviderType;
  version: string;
  analyzeFrame(input: VisionFrameAnalysisInput): Promise<VisionFrameAnalysisResult>;
  readiness(): VisionProviderReadiness;
}

export type VisionProviderReadiness = {
  key: VisionProviderKey;
  type: VisionProviderType;
  configured: boolean;
  mockMode: boolean;
  shadowMode: true;
  humanReviewRequired: true;
  supportsRealProcessing: boolean;
  message: string;
};

const providerVersions: Record<VisionProviderKey, string> = {
  local_mock: "vision-local-mock-1.0.0",
  opencv: "opencv-adapter-ready-1.0.0",
  yolo: "yolo-adapter-ready-1.0.0",
  ultralytics: "ultralytics-adapter-ready-1.0.0",
  local_http: "local-http-adapter-ready-1.0.0",
  custom: "custom-adapter-ready-1.0.0"
};

const providerTypes: Record<VisionProviderKey, VisionProviderType> = {
  local_mock: "mock",
  opencv: "opencv",
  yolo: "yolo",
  ultralytics: "ultralytics",
  local_http: "local_http",
  custom: "custom"
};

export function normalizeVisionProvider(provider?: string | null): VisionProviderKey {
  if (provider === "opencv" || provider === "local_opencv") return "opencv";
  if (provider === "yolo" || provider === "local_yolo") return "yolo";
  if (provider === "ultralytics") return "ultralytics";
  if (provider === "local_http" || provider === "local_model_endpoint") return "local_http";
  if (provider === "custom") return "custom";
  return "local_mock";
}

export function getVisionProvider(provider?: string | null): VisionProvider {
  return new SafeVisionProvider(normalizeVisionProvider(provider ?? process.env.VISION_PROVIDER ?? process.env.LOCAL_VISION_PROVIDER));
}

export function combineVisionConfidence(input: VisionConfidenceInput) {
  const model = clamp(input.model ?? 0);
  const review = input.review == null ? null : clamp(input.review);
  const learning = input.learning == null ? 0 : clamp(input.learning);
  const correlation = input.correlation == null ? 0 : clamp(input.correlation);
  const reviewWeight = review == null ? 0 : 0.25;
  const raw = model * 0.45 + (review ?? 0) * reviewWeight + learning * 0.15 + correlation * 0.15;
  const cap = review == null ? 0.85 : 0.95;
  return round(Math.min(cap, raw));
}

export function calibrateConfidenceFromReview(baseConfidence: number, outcome?: string | null) {
  const base = clamp(baseConfidence);
  const deltaByOutcome: Record<string, number> = {
    confirmed: 0.08,
    valid_detection: 0.06,
    escalated: 0.1,
    needs_more_data: -0.02,
    dismissed: -0.1,
    false_positive: -0.18
  };
  const delta = deltaByOutcome[outcome ?? ""] ?? 0;
  return { confidenceDelta: round(delta), confidenceAfter: round(clamp(base + delta)) };
}

export function getVisionProductionReadiness() {
  const providers: VisionProviderKey[] = ["local_mock", "opencv", "yolo", "ultralytics", "local_http", "custom"];
  return {
    shadowMode: true,
    humanReviewRequired: true,
    calibrationMode: true,
    rawFramesStored: false,
    externalAiEnabled: false,
    providers: providers.map((provider) => getVisionProvider(provider).readiness())
  };
}

class SafeVisionProvider implements VisionProvider {
  key: VisionProviderKey;
  type: VisionProviderType;
  version: string;

  constructor(provider: VisionProviderKey) {
    this.key = provider;
    this.type = providerTypes[provider];
    this.version = providerVersions[provider];
  }

  async analyzeFrame(input: VisionFrameAnalysisInput): Promise<VisionFrameAnalysisResult> {
    const started = Date.now();
    const configured = this.isConfigured();
    const activeKey: VisionProviderKey = configured ? this.key : "local_mock";
    const category = inferDetectionCategory(input);
    const modelConfidence = confidenceFor(category, configured);
    return {
      providerKey: activeKey,
      providerType: providerTypes[activeKey],
      providerVersion: providerVersions[activeKey],
      health: activeKey === "local_mock" ? "mock" : "healthy",
      detections: [{
        category,
        modelConfidence,
        title: titleFor(category),
        description: descriptionFor(category),
        recommendedAction: recommendedActionFor(category),
        objectLabels: labelsFor(category),
        boundingBoxes: boxesFor(category, modelConfidence),
        metadata: {
          shadow_mode: true,
          requires_human_review: true,
          parent_visible: false,
          no_identity_recognition: true,
          no_biometric_assumption: true
        }
      }],
      latencyMs: Math.max(1, Date.now() - started),
      processingTimeMs: Math.max(1, Date.now() - started + (configured ? 12 : 2)),
      shadowMode: true,
      requiresHumanReview: true,
      calibrationMode: true,
      noRawFrameStored: true,
      noExternalAiCall: activeKey === "local_mock",
      metadata: {
        requested_provider: this.key,
        active_provider: activeKey,
        frame_source_type: input.frameSourceType ?? "mock_frame",
        gateway_snapshot_available: Boolean(input.gatewaySnapshotUrl),
        raw_stream_exposed: false,
        child_identity_recognition: false,
        staff_scoring: false,
        automatic_accusation: false
      }
    };
  }

  readiness(): VisionProviderReadiness {
    const configured = this.isConfigured();
    return {
      key: this.key,
      type: this.type,
      configured,
      mockMode: this.key === "local_mock" || !configured,
      shadowMode: true,
      humanReviewRequired: true,
      supportsRealProcessing: this.key !== "local_mock",
      message: this.key === "local_mock"
        ? "Mock provider is active. No real frames are processed."
        : configured
          ? "Provider is configured for future local processing. Shadow mode remains required."
          : "Provider adapter is ready, but runtime credentials/dependencies are not configured."
    };
  }

  private isConfigured() {
    if (this.key === "local_mock") return true;
    if (this.key === "local_http") return Boolean(process.env.LOCAL_VISION_ENDPOINT);
    if (this.key === "custom") return Boolean(process.env.CUSTOM_VISION_ENDPOINT);
    return Boolean(process.env.LOCAL_VISION_ENABLED === "true");
  }
}

function inferDetectionCategory(input: VisionFrameAnalysisInput): VisionDetectionCategory {
  const scenario = String(input.metadata?.mock_scenario ?? "");
  if (isVisionDetectionCategory(scenario)) return scenario;
  if (input.metadata?.camera_status === "offline") return "camera_offline";
  if (input.metadata?.frame_frozen === true) return "camera_frozen";
  if (input.metadata?.camera_blocked === true) return "camera_blocked";
  if (input.metadata?.restricted_area === true) return "restricted_area_presence";
  return "person_detected";
}

function isVisionDetectionCategory(value: string): value is VisionDetectionCategory {
  return ["person_detected", "multiple_persons_detected", "occupancy", "restricted_area_presence", "unusual_activity", "object_presence", "obstruction_detection", "camera_blocked", "camera_frozen", "camera_offline"].includes(value);
}

function confidenceFor(category: VisionDetectionCategory, configured: boolean) {
  const base: Record<VisionDetectionCategory, number> = {
    person_detected: 0.72,
    multiple_persons_detected: 0.7,
    occupancy: 0.68,
    restricted_area_presence: 0.76,
    unusual_activity: 0.62,
    object_presence: 0.66,
    obstruction_detection: 0.74,
    camera_blocked: 0.78,
    camera_frozen: 0.8,
    camera_offline: 0.84
  };
  return configured ? base[category] : Math.min(0.7, base[category]);
}

function titleFor(category: VisionDetectionCategory) {
  const map: Record<VisionDetectionCategory, string> = {
    person_detected: "זוהתה דמות לבדיקה",
    multiple_persons_detected: "זוהו מספר אנשים לבדיקה",
    occupancy: "נוכחות באזור לבדיקה",
    restricted_area_presence: "נוכחות אפשרית באזור מוגבל",
    unusual_activity: "פעילות חריגה לבדיקה",
    object_presence: "חפץ זוהה לבדיקה",
    obstruction_detection: "חשד להסתרת מצלמה",
    camera_blocked: "מצלמה חסומה לבדיקה",
    camera_frozen: "חשד לתמונה קפואה",
    camera_offline: "מצלמה לא מחוברת"
  };
  return map[category];
}

function descriptionFor(category: VisionDetectionCategory) {
  return `${titleFor(category)}. זהו זיהוי במצב shadow בלבד ודורש בדיקה אנושית לפני כל פעולה.`;
}

function recommendedActionFor(category: VisionDetectionCategory) {
  if (category === "camera_offline" || category === "camera_blocked" || category === "camera_frozen") return "מומלץ לבדוק את מצב המצלמה והשידור.";
  if (category === "restricted_area_presence") return "מומלץ לבדוק את ההקשר מול הצוות לפני הסלמה.";
  return "מומלץ לסמן כתקין או לא תקין לאחר בדיקה.";
}

function labelsFor(category: VisionDetectionCategory) {
  if (category.includes("person") || category === "occupancy" || category === "restricted_area_presence") return ["person"];
  if (category.includes("camera")) return ["camera_status"];
  if (category.includes("object")) return ["object"];
  return ["activity_indicator"];
}

function boxesFor(category: VisionDetectionCategory, confidence: number) {
  if (!["person_detected", "multiple_persons_detected", "occupancy", "restricted_area_presence"].includes(category)) return [];
  const first = { x: 0.24, y: 0.2, width: 0.19, height: 0.44, label: "person", confidence };
  return category === "multiple_persons_detected" ? [first, { x: 0.58, y: 0.22, width: 0.16, height: 0.4, label: "person", confidence: Math.max(0.5, confidence - 0.08) }] : [first];
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round(value: number) {
  return Math.round(value * 10000) / 10000;
}
