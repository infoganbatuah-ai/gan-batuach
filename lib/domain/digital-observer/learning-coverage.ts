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
  for (const baseline of baselines) {
    if (baseline.baseline_type !== "normal_camera_activity") continue;
    const value = objectValue(baseline.baseline_value);
    const cameraBaselines = objectValue(value.camera_baselines);
    for (const id of Object.keys(cameraBaselines)) if (expectedIds.includes(id)) sampled.add(id);
  }
  return { expectedCameraCount: expectedIds.length, sampledCameraCount: sampled.size, sampledCameraIds: [...sampled], coverage: expectedIds.length ? sampled.size / expectedIds.length : null };
}

export function learningMetricMeaning(baseline: Row) {
  const value = objectValue(baseline.baseline_value);
  const sampleCount = Number(value.sample_count ?? 0);
  if (baseline.baseline_type === "normal_camera_activity") return { measurable: sampleCount > 0, label: "בשלות מדגם", explanation: "לכל מצלמה confidence הוא samples/288 (עד תקרה 98%); ערך האתר הוא המינימום בין קווי הבסיס של המצלמות שנדגמו. זה אינו דיוק AI. sample_count באתר מונה מחזורי איסוף, לא מצלמות." };
  const realContext = objectValue(value.real_event_context);
  if (realContext.source === "canonical_real_camera_ai_events") return { measurable: Number(realContext.real_event_count ?? 0) > 0, label: "בשלות הקשר", explanation: "נגזרת מכמות אירועים, כיסוי ימים וחלון זמן; אינה דיוק AI." };
  return { measurable: false, label: "עדיין לא ניתן למדידה", explanation: "קטגוריית יסוד שטרם מחוברת למדד Product מאומת; 0% אינו מוצג כאיכות." };
}
