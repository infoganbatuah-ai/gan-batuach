export type LocalVisionProvider = "local_mock" | "local_opencv" | "local_yolo" | "local_http";
export type LocalVisionMode = "local_shadow";

export type FrameAnalyzerInput = {
  camera_id?: string | null;
  kindergarten_id: string;
  frame_url?: string | null;
  frame_buffer?: Uint8Array | Buffer | null;
  zone_id?: string | null;
  timestamp: string;
  routine_context?: Record<string, unknown> | null;
  previous_frame_hash?: string | null;
  motion_metadata?: {
    motion_score?: number | null;
    frame_hash?: string | null;
    mock_scenario?: string | null;
  };
  frame_metadata?: Record<string, unknown>;
};

export type FrameBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  confidence?: number;
};

export type SkeletonKeypoint = {
  index: number;
  x: number;
  y: number;
  confidence: number;
};

export type LocalVisionDetection = {
  event_type:
    | "camera_offline"
    | "camera_frozen_suspected"
    | "motion_detected"
    | "no_motion_too_long"
    | "person_detected"
    | "multiple_persons_detected"
    | "restricted_area_occupancy"
    | "camera_obstruction_suspected";
  confidence: number;
  severity: "info" | "low" | "medium" | "high" | "urgent" | "critical";
  bounding_boxes?: FrameBoundingBox[];
  skeleton_keypoints?: SkeletonKeypoint[];
  object_labels?: string[];
  description_hint?: string;
  recommended_action?: string;
  metadata?: Record<string, unknown>;
};

export type FrameAnalyzerResult = {
  provider: LocalVisionProvider;
  mode: LocalVisionMode;
  provider_version: string;
  provider_latency_ms: number;
  detections: LocalVisionDetection[];
  motion_score?: number | null;
  object_labels: string[];
  bounding_boxes: FrameBoundingBox[];
  skeleton_keypoints: SkeletonKeypoint[];
  setup_required?: boolean;
  gateway_snapshot_status: "available" | "mock" | "not_configured";
  metadata: Record<string, unknown>;
};

export type VisionContext = {
  camera?: Record<string, any> | null;
  zone?: Record<string, any> | null;
  routine?: Record<string, any> | null;
  learningProfile?: Record<string, any> | null;
};

export interface LocalVisionAdapter {
  provider: LocalVisionProvider;
  mode: LocalVisionMode;
  version: string;
  analyzeFrame(input: FrameAnalyzerInput, context?: VisionContext): Promise<FrameAnalyzerResult>;
}

const detectorVersions: Record<LocalVisionProvider, string> = {
  local_mock: "local-mock-shadow-1.0.0",
  local_opencv: "opencv-placeholder-shadow-1.0.0",
  local_yolo: "yolo-placeholder-shadow-1.0.0",
  local_http: "local-http-placeholder-shadow-1.0.0"
};

export function createLocalVisionAdapter(provider?: string | null): LocalVisionAdapter {
  const normalized = normalizeProvider(provider ?? process.env.LOCAL_VISION_PROVIDER);
  return new PlaceholderLocalVisionAdapter(normalized);
}

export function buildGatewayFrameInput(input: {
  camera?: Record<string, any> | null;
  kindergarten_id: string;
  zone_id?: string | null;
  timestamp?: string;
  previous_frame_hash?: string | null;
  motion_score?: number | null;
  mock_scenario?: string | null;
}): FrameAnalyzerInput {
  const snapshotSupported = Boolean(input.camera?.gateway_snapshot_url || input.camera?.snapshot_url);
  return {
    camera_id: input.camera?.id ?? null,
    kindergarten_id: input.kindergarten_id,
    frame_url: snapshotSupported ? String(input.camera?.gateway_snapshot_url ?? input.camera?.snapshot_url) : null,
    frame_buffer: null,
    zone_id: input.zone_id ?? null,
    timestamp: input.timestamp ?? new Date().toISOString(),
    previous_frame_hash: input.previous_frame_hash ?? null,
    motion_metadata: {
      motion_score: input.motion_score ?? null,
      frame_hash: typeof input.camera?.frame_hash === "string" ? input.camera.frame_hash : null,
      mock_scenario: input.mock_scenario ?? null
    },
    frame_metadata: {
      gateway_snapshot_supported: snapshotSupported,
      mock_snapshot: !snapshotSupported,
      raw_stream_exposed: false,
      frame_storage_enabled: false
    }
  };
}

export function mapFrameAnalysisToShadowDetections(input: FrameAnalyzerInput, result: FrameAnalyzerResult, context: VisionContext = {}) {
  const zoneName = context.zone?.name ?? context.camera?.area ?? "אזור מצלמה";
  return result.detections.map((detection) => {
    const text = eventText(detection.event_type, zoneName);
    return {
      event_type: detection.event_type,
      severity: detection.severity,
      confidence_score: detection.confidence,
      title: text.title,
      description: detection.description_hint ?? text.description,
      recommended_action: detection.recommended_action ?? text.recommendedAction,
      dedupe_key: dedupe(input, detection.event_type, detection.event_type === "camera_offline" ? 30 : 10),
      metadata: {
        shadow_mode: true,
        requires_human_review: true,
        parent_visible: false,
        provider: result.provider,
        detector_provider: result.provider,
        detector_mode: result.mode,
        provider_version: result.provider_version,
        provider_latency_ms: result.provider_latency_ms,
        gateway_snapshot_status: result.gateway_snapshot_status,
        setup_required: result.setup_required ?? false,
        motion_score: result.motion_score ?? null,
        object_labels: detection.object_labels ?? result.object_labels,
        bounding_boxes: detection.bounding_boxes ?? result.bounding_boxes,
        skeleton_keypoints: detection.skeleton_keypoints ?? result.skeleton_keypoints,
        skeleton_keypoint_count: (detection.skeleton_keypoints ?? result.skeleton_keypoints).length,
        no_personal_identity: true,
        no_face_recognition: true,
        no_audio_analysis: true,
        skeleton_only: true,
        raw_pixels_wiped_from_memory: true,
        no_external_ai: true,
        raw_stream_exposed: false,
        frame_storage_enabled: false,
        ...(detection.metadata ?? {}),
        ...(result.metadata ?? {})
      }
    };
  });
}

class PlaceholderLocalVisionAdapter implements LocalVisionAdapter {
  provider: LocalVisionProvider;
  mode: LocalVisionMode = "local_shadow";
  version: string;

  constructor(provider: LocalVisionProvider) {
    this.provider = provider;
    this.version = detectorVersions[provider];
  }

  async analyzeFrame(input: FrameAnalyzerInput, context: VisionContext = {}): Promise<FrameAnalyzerResult> {
    const started = Date.now();
    const hadFrameInput = Boolean(input.frame_url || input.frame_buffer?.length);
    const scenario = normalizeScenario(input.motion_metadata?.mock_scenario) ?? inferScenario(input, context);
    const confidence = confidenceForScenario(scenario, input.motion_metadata?.motion_score);
    const objectLabels = labelsForScenario(scenario);
    const boundingBoxes = boxesForScenario(scenario, confidence);
    const skeletonKeypoints = buildAnonymousSkeletonKeypoints(scenario, confidence);
    input.frame_buffer = null;
    input.frame_url = null;
    const setupRequired = this.provider !== "local_mock";
    const detection: LocalVisionDetection = {
      event_type: scenario,
      confidence,
      severity: severityForScenario(scenario),
      object_labels: objectLabels,
      bounding_boxes: boundingBoxes,
      skeleton_keypoints: skeletonKeypoints,
      metadata: {
        analyzer_placeholder: setupRequired,
        adapter_ready_for: this.provider,
        external_ai_call: false,
        real_child_video_processed: false,
        raw_pixels_wiped_from_memory: true,
        skeleton_only: true
      }
    };

    return {
      provider: setupRequired ? "local_mock" : this.provider,
      mode: this.mode,
      provider_version: this.version,
      provider_latency_ms: Math.max(1, Date.now() - started),
      detections: [detection],
      motion_score: input.motion_metadata?.motion_score ?? null,
      object_labels: objectLabels,
      bounding_boxes: boundingBoxes,
      skeleton_keypoints: skeletonKeypoints,
      setup_required: setupRequired,
      gateway_snapshot_status: hadFrameInput ? "available" : "mock",
      metadata: {
        requested_provider: this.provider,
        active_provider: setupRequired ? "local_mock" : this.provider,
        opencv_available: false,
        yolo_available: false,
        local_http_enabled: false,
        setup_note: setupRequired ? "OpenCV/YOLO/local HTTP setup is documented but not installed in this build." : null,
        raw_pixels_wiped_from_memory: true,
        skeleton_keypoint_count: skeletonKeypoints.length
      }
    };
  }
}

function normalizeProvider(provider?: string | null): LocalVisionProvider {
  if (provider === "local_opencv" || provider === "opencv") return "local_opencv";
  if (provider === "local_yolo" || provider === "yolo" || provider === "ultralytics") return "local_yolo";
  if (provider === "local_http" || provider === "local_model_endpoint") return "local_http";
  return "local_mock";
}

function inferScenario(input: FrameAnalyzerInput, context: VisionContext) {
  const cameraStatus = String(context.camera?.status ?? context.camera?.stream_status ?? "");
  if (context.camera?.active === false || ["offline", "error", "disabled"].includes(cameraStatus)) return "camera_offline" as const;
  if (context.zone?.is_restricted) return "restricted_area_occupancy" as const;
  if (input.previous_frame_hash && input.motion_metadata?.frame_hash === input.previous_frame_hash) return "camera_frozen_suspected" as const;
  const motion = input.motion_metadata?.motion_score;
  if (typeof motion === "number" && motion < 0.08) return "no_motion_too_long" as const;
  if (typeof motion === "number" && motion > 0.55) return "motion_detected" as const;
  return "person_detected" as const;
}

function normalizeScenario(scenario?: string | null) {
  const map: Record<string, LocalVisionDetection["event_type"]> = {
    camera_offline: "camera_offline",
    camera_frozen_suspected: "camera_frozen_suspected",
    motion_detected: "motion_detected",
    no_motion_too_long: "no_motion_too_long",
    person_detected: "person_detected",
    multiple_persons_detected: "multiple_persons_detected",
    restricted_area_occupancy: "restricted_area_occupancy",
    camera_obstruction_suspected: "camera_obstruction_suspected",
    person_in_restricted_area: "restricted_area_occupancy",
    restricted_area_entry: "restricted_area_occupancy"
  };
  return scenario ? map[scenario] : undefined;
}

function severityForScenario(eventType: LocalVisionDetection["event_type"]): LocalVisionDetection["severity"] {
  if (eventType === "camera_offline" || eventType === "restricted_area_occupancy") return "urgent";
  if (eventType === "camera_frozen_suspected" || eventType === "camera_obstruction_suspected") return "high";
  if (eventType === "no_motion_too_long" || eventType === "multiple_persons_detected") return "medium";
  if (eventType === "motion_detected") return "low";
  return "info";
}

function confidenceForScenario(eventType: LocalVisionDetection["event_type"], motionScore?: number | null) {
  if (eventType === "motion_detected" && typeof motionScore === "number") return Math.min(0.95, Math.max(0.55, motionScore));
  if (eventType === "camera_offline") return 0.91;
  if (eventType === "restricted_area_occupancy") return 0.84;
  if (eventType === "camera_frozen_suspected") return 0.82;
  if (eventType === "camera_obstruction_suspected") return 0.8;
  if (eventType === "multiple_persons_detected") return 0.76;
  if (eventType === "no_motion_too_long") return 0.74;
  return 0.78;
}

function labelsForScenario(eventType: LocalVisionDetection["event_type"]) {
  if (eventType === "person_detected") return ["person"];
  if (eventType === "multiple_persons_detected" || eventType === "restricted_area_occupancy") return ["person", "person"];
  if (eventType === "motion_detected") return ["motion"];
  if (eventType === "camera_obstruction_suspected") return ["obstruction_indicator"];
  if (eventType === "camera_frozen_suspected") return ["stable_frame_hash"];
  if (eventType === "no_motion_too_long") return ["low_motion"];
  return ["camera_status"];
}

function boxesForScenario(eventType: LocalVisionDetection["event_type"], confidence: number): FrameBoundingBox[] {
  if (!["person_detected", "multiple_persons_detected", "restricted_area_occupancy"].includes(eventType)) return [];
  const first = { x: 0.22, y: 0.18, width: 0.2, height: 0.46, label: "person", confidence };
  if (eventType === "person_detected") return [first];
  return [first, { x: 0.56, y: 0.22, width: 0.18, height: 0.42, label: "person", confidence: Math.max(0.5, confidence - 0.08) }];
}

function buildAnonymousSkeletonKeypoints(eventType: LocalVisionDetection["event_type"], confidence: number): SkeletonKeypoint[] {
  if (!["person_detected", "multiple_persons_detected", "restricted_area_occupancy", "motion_detected", "no_motion_too_long"].includes(eventType)) return [];
  return Array.from({ length: 17 }, (_, index) => ({
    index,
    x: Number((0.2 + (index % 5) * 0.11).toFixed(3)),
    y: Number((0.18 + Math.floor(index / 5) * 0.16).toFixed(3)),
    confidence: Number(Math.max(0.1, confidence - index * 0.006).toFixed(3))
  }));
}

function eventText(eventType: LocalVisionDetection["event_type"], zoneName: string) {
  const map: Record<LocalVisionDetection["event_type"], { title: string; description: string; recommendedAction: string }> = {
    camera_offline: {
      title: "מצלמה לא מחוברת לבדיקה",
      description: "זיהוי ניסיוני במצב shadow: אינדיקציה שהמצלמה אינה מחוברת. נדרשת בדיקת אדם.",
      recommendedAction: "בדקי את חיבור המצלמה ואת סטטוס ה-Gateway."
    },
    camera_frozen_suspected: {
      title: "חשד לתמונה קפואה",
      description: "זיהוי ניסיוני במצב shadow: ייתכן שהפריים לא השתנה לאורך זמן. נדרשת בדיקת אדם.",
      recommendedAction: "פתחי בדיקת מצלמה ובדקי אם השידור חי."
    },
    motion_detected: {
      title: "תנועה זוהתה לבדיקה",
      description: `זיהוי ניסיוני במצב shadow: תנועה זוהתה באזור ${zoneName}. אין פעולה אוטומטית.`,
      recommendedAction: "אין צורך בפעולה אלא אם קיימת אינדיקציה נוספת."
    },
    no_motion_too_long: {
      title: "חשד לחוסר תנועה ממושך",
      description: `זיהוי ניסיוני במצב shadow: חוסר תנועה באזור ${zoneName} ביחס לשגרה המוגדרת. נדרשת בדיקת אדם.`,
      recommendedAction: "בדקי את המצלמה ואת ההקשר היומי לפני כל מסקנה."
    },
    person_detected: {
      title: "דמות זוהתה לבדיקה",
      description: `זיהוי ניסיוני במצב shadow: דמות זוהתה באזור ${zoneName}. אין זיהוי אישי.`,
      recommendedAction: "אין פעולה נדרשת. זהו signal ל-baseline בלבד."
    },
    multiple_persons_detected: {
      title: "מספר דמויות זוהו לבדיקה",
      description: `זיהוי ניסיוני במצב shadow: מספר דמויות באזור ${zoneName}. אין זיהוי אישי.`,
      recommendedAction: "בדקי רק אם האזור מוגבל או מחוץ לשגרת היום."
    },
    restricted_area_occupancy: {
      title: "נוכחות אפשרית באזור מוגבל",
      description: `זיהוי ניסיוני במצב shadow: אינדיקציה לנוכחות באזור מוגבל ${zoneName}. נדרשת בדיקת אדם.`,
      recommendedAction: "בדקי את האזור וסמני false positive אם אין בעיה."
    },
    camera_obstruction_suspected: {
      title: "חשד לחסימת מצלמה",
      description: "זיהוי ניסיוני במצב shadow: ייתכן שהמצלמה חסומה או מכוסה. נדרשת בדיקת אדם.",
      recommendedAction: "בדקי את המצלמה פיזית או דרך Preview מאובטח."
    }
  };
  return map[eventType];
}

function dedupe(input: FrameAnalyzerInput, eventType: string, windowMinutes = 10) {
  const bucket = Math.floor(new Date(input.timestamp).getTime() / (windowMinutes * 60 * 1000));
  return [input.kindergarten_id, input.camera_id ?? "camera", input.zone_id ?? "zone", eventType, bucket, "local_shadow"].join(":");
}
