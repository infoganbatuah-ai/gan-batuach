export type CorrelationSourceType = "ai_camera_event" | "audio_observer_event" | "safety_incident" | "pickup_event" | "watch_request_event" | "camera_health" | "mock";

export type CorrelationSource = {
  source_type: CorrelationSourceType;
  source_id: string;
  camera_id?: string | null;
  zone_id?: string | null;
  event_time?: string | null;
  confidence?: number | null;
  title?: string | null;
  severity?: string | null;
};

export type TimelineItem = {
  order: number;
  source_type: CorrelationSourceType;
  source_id: string;
  camera_id: string | null;
  zone_id: string | null;
  event_time: string | null;
  title: string;
};

function unique<T>(values: T[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function buildCorrelationTimeline(sources: CorrelationSource[]): TimelineItem[] {
  return sources
    .slice()
    .sort((a, b) => new Date(a.event_time ?? 0).getTime() - new Date(b.event_time ?? 0).getTime())
    .map((source, index) => ({
      order: index + 1,
      source_type: source.source_type,
      source_id: source.source_id,
      camera_id: source.camera_id ?? null,
      zone_id: source.zone_id ?? null,
      event_time: source.event_time ?? null,
      title: source.title ?? source.source_type
    }));
}

export function calculateCorrelationConfidence(sources: CorrelationSource[]) {
  const cameraIds = unique(sources.map((source) => source.camera_id));
  const zoneIds = unique(sources.map((source) => source.zone_id));
  const sourceTypes = unique(sources.map((source) => source.source_type));
  const averageSourceConfidence = sources.length
    ? sources.reduce((sum, source) => sum + Number(source.confidence ?? 0.45), 0) / sources.length
    : 0.35;
  const cameraBoost = Math.min(0.22, Math.max(0, cameraIds.length - 1) * 0.08);
  const sensorBoost = Math.min(0.18, Math.max(0, sourceTypes.length - 1) * 0.06);
  const singleCameraPenalty = cameraIds.length <= 1 ? -0.08 : 0;
  const confidence = Math.max(0, Math.min(1, averageSourceConfidence + cameraBoost + sensorBoost + singleCameraPenalty));
  return {
    confidence,
    factors: {
      source_count: sources.length,
      camera_count: cameraIds.length,
      zone_count: zoneIds.length,
      sensor_type_count: sourceTypes.length,
      average_source_confidence: Number(averageSourceConfidence.toFixed(4)),
      camera_boost: Number(cameraBoost.toFixed(4)),
      sensor_boost: Number(sensorBoost.toFixed(4)),
      single_camera_penalty: Number(singleCameraPenalty.toFixed(4)),
      no_identity_tracking: true,
      human_review_required: true
    },
    cameraIds,
    zoneIds,
    sourceTypes
  };
}

export function inferCorrelationSeverity(sources: CorrelationSource[]) {
  const rank: Record<string, number> = { info: 1, low: 2, medium: 3, high: 4, urgent: 5, critical: 6 };
  const label = Object.entries(rank).find(([, value]) => value === Math.max(...sources.map((source) => rank[source.severity ?? "medium"] ?? 3)));
  return label?.[0] ?? "medium";
}

export const correlationTypeLabels: Record<string, string> = {
  multi_camera_timeline: "ציר זמן בין מצלמות",
  cross_camera_confirmation: "אישור מכמה מצלמות",
  audio_video_correlation: "חיבור שמע ווידאו",
  pickup_path_correlation: "ציר איסוף",
  watch_request_correlation: "בקשת מעקב",
  safety_event_correlation: "אירוע בטיחות",
  camera_health_correlation: "בריאות מצלמות",
  mock_correlation: "Mock correlation"
};
