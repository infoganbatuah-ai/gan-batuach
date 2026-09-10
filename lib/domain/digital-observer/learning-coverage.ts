import { isExpectedCamera } from "./camera-health-model";

type Row = Record<string, unknown>;
const objectValue = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};

export function expectedPhysicalCameraIds(cameras: Row[]) {
  return cameras.filter(camera => {
    const metadata = objectValue(camera.metadata);
    return isExpectedCamera({ channelAssignment: typeof metadata.channel_assignment === "string" ? metadata.channel_assignment : typeof metadata.channel_state === "string" ? metadata.channel_state : null, physicalCameraAttached: typeof metadata.physical_camera_attached === "boolean" ? metadata.physical_camera_attached : null });
  }).map(camera => String(camera.id)).filter(Boolean);
}

export function learningCameraCoverage(cameras: Row[], baselines: Row[]) {
  const expectedIds = expectedPhysicalCameraIds(cameras);
  const sampled = new Set<string>();
  const details = new Map<string, { samples: number; lastSampledAt: string | null; timeBucketCount: number }>();
  for (const baseline of baselines) {
    if (baseline.baseline_type !== "normal_camera_activity") continue;
    const value = objectValue(baseline.baseline_value);
    const cameraBaselines = objectValue(value.camera_baselines);
    for (const [id, entry] of Object.entries(cameraBaselines)) if (expectedIds.includes(id)) {
      sampled.add(id);
      const value = objectValue(entry);
      details.set(id, { samples: Math.max(0, Number(value.samples ?? 0)),
        lastSampledAt: typeof value.lastObservedAt === "string" ? value.lastObservedAt : null,
        timeBucketCount: Array.isArray(value.activeHours) ? value.activeHours.filter(hour => Number.isInteger(hour)).length : 0 });
    }
  }
  const cameraById = new Map(cameras.map(camera => [String(camera.id), camera]));
  const perCamera = expectedIds.map(id => { const detail = details.get(id); const camera = cameraById.get(id) ?? {};
    return { cameraId: id, name: typeof camera.display_name === "string" ? camera.display_name : "מצלמה",
      samples: detail?.samples ?? 0, lastSampledAt: detail?.lastSampledAt ?? null, timeBucketCount: detail?.timeBucketCount ?? 0,
      sampled: sampled.has(id), reason: sampled.has(id) ? "SCHEDULED_SITE_LEARNING" : "UNDER_COVERED" }; });
  return { expectedCameraCount: expectedIds.length, sampledCameraCount: sampled.size, sampledCameraIds: [...sampled],
    coverage: expectedIds.length ? sampled.size / expectedIds.length : null, perCamera };
}

export function learningMetricMeaning(baseline: Row) {
  const value = objectValue(baseline.baseline_value);
  const sampleCount = Number(value.sample_count ?? 0);
  if (baseline.baseline_type === "normal_camera_activity") return { measurable: sampleCount > 0, label: "בשלות מדגם", explanation: "לכל מצלמה confidence הוא samples/288 (עד תקרה 98%); ערך האתר הוא המינימום בין קווי הבסיס של המצלמות שנדגמו. זה אינו דיוק AI. sample_count באתר מונה מחזורי איסוף, לא מצלמות." };
  const realContext = objectValue(value.real_event_context);
  if (realContext.source === "canonical_real_camera_ai_events") return { measurable: Number(realContext.real_event_count ?? 0) > 0, label: "בשלות הקשר", explanation: "נגזרת מכמות אירועים, כיסוי ימים וחלון זמן; אינה דיוק AI." };
  return { measurable: false, label: "עדיין לא ניתן למדידה", explanation: "קטגוריית יסוד שטרם מחוברת למדד Product מאומת; 0% אינו מוצג כאיכות." };
}
