import { observerEventType, type ObserverEventLike } from "@/lib/domain/digital-observer/event-narrative";

export type ObserverDashboardSummaryKey = "parking" | "entry_exit" | "anomalies" | "insights" | "warehouse" | "pool";

export type ObserverDashboardSummary = {
  key: ObserverDashboardSummaryKey;
  label: string;
  count: number;
  cameraCount: number;
};

type CameraLike = Record<string, any>;
type SignalLike = ObserverEventLike & Record<string, any>;

const contextTerms: Record<Exclude<ObserverDashboardSummaryKey, "anomalies" | "insights">, string[]> = {
  parking: ["parking", "garage", "driveway", "vehicle", "car", "motorcycle", "חניה", "חנייה", "רכב", "אופנוע"],
  entry_exit: ["entry", "exit", "entrance", "door", "gate", "lobby", "כניסה", "יציאה", "דלת", "שער", "לובי"],
  warehouse: ["warehouse", "storage", "stock", "מחסן", "אחסון", "מלאי"],
  pool: ["pool", "swimming", "בריכה"]
};

const eventTerms: Record<Exclude<ObserverDashboardSummaryKey, "anomalies" | "insights">, string[]> = {
  parking: ["vehicle", "parking", "car", "motorcycle", "tampering", "theft"],
  entry_exit: ["entered", "exited", "entry", "exit", "person"],
  warehouse: ["warehouse", "storage", "stock"],
  pool: ["pool", "swimming"]
};

const labels: Record<ObserverDashboardSummaryKey, string> = {
  parking: "אירועי חנייה",
  entry_exit: "כניסה ויציאה",
  anomalies: "אירועים חריגים",
  insights: "תובנות",
  warehouse: "מחסן",
  pool: "בריכה"
};

function searchableCameraText(camera: CameraLike) {
  const metadata = camera.metadata && typeof camera.metadata === "object" ? camera.metadata : {};
  const values = [
    camera.display_name,
    camera.location_label,
    camera.preview_scene,
    metadata.scene_type,
    metadata.area_type,
    metadata.location_type,
    ...(Array.isArray(camera.monitoring_targets) ? camera.monitoring_targets : []),
    ...(Array.isArray(metadata.monitoring_targets) ? metadata.monitoring_targets : [])
  ];
  return values.filter((value) => typeof value === "string").join(" ").toLocaleLowerCase("he-IL");
}

function cameraIdsForContext(cameras: CameraLike[], key: Exclude<ObserverDashboardSummaryKey, "anomalies" | "insights">) {
  const terms = contextTerms[key];
  return new Set(cameras
    .filter((camera) => terms.some((term) => searchableCameraText(camera).includes(term)))
    .flatMap((camera) => [camera.id, camera.camera_stream_id].filter(Boolean)));
}

function signalCameraId(signal: SignalLike) {
  const metadata = signal.metadata && typeof signal.metadata === "object" && !Array.isArray(signal.metadata)
    ? signal.metadata as Record<string, any>
    : {};
  return signal.camera_id ?? metadata.camera_source_id ?? null;
}

function isRecent(signal: SignalLike, now: number) {
  const timestamp = new Date(signal.created_at).getTime();
  return Number.isFinite(timestamp) && timestamp >= now - 24 * 60 * 60 * 1000;
}

function isAnomaly(signal: SignalLike) {
  if (["high", "urgent", "critical"].includes(String(signal.severity))) return true;
  return [
    "distress", "fire", "smoke", "unauthorized", "unknown", "tampering", "theft",
    "violence", "robbery", "offline", "obstruction", "restricted", "pattern"
  ].some((term) => observerEventType(signal).includes(term));
}

export function observerDashboardSignalMatchesCategory(signal: SignalLike, category: string, cameras: CameraLike[]) {
  if (category === "insights") return true;
  if (category === "anomalies") return isAnomaly(signal);
  if (!["parking", "entry_exit", "warehouse", "pool"].includes(category)) return true;
  const key = category as Exclude<ObserverDashboardSummaryKey, "anomalies" | "insights">;
  const cameraId = signalCameraId(signal);
  return Boolean(cameraId && cameraIdsForContext(cameras, key).has(cameraId) && eventTerms[key].some((term) => observerEventType(signal).includes(term)));
}

export function buildObserverDashboardSummaries(cameras: CameraLike[], signals: SignalLike[], now = Date.now()): ObserverDashboardSummary[] {
  if (!cameras.length) return [];
  const recentSignals = signals.filter((signal) => isRecent(signal, now));
  const results: ObserverDashboardSummary[] = [];

  for (const key of ["parking", "entry_exit", "warehouse", "pool"] as const) {
    const cameraIds = cameraIdsForContext(cameras, key);
    if (!cameraIds.size) continue;
    const count = recentSignals.filter((signal) => {
      const cameraId = signalCameraId(signal);
      return cameraId && cameraIds.has(cameraId) && eventTerms[key].some((term) => observerEventType(signal).includes(term));
    }).length;
    results.push({ key, label: labels[key], count, cameraCount: cameraIds.size });
  }

  results.push({ key: "anomalies", label: labels.anomalies, count: recentSignals.filter(isAnomaly).length, cameraCount: cameras.length });
  results.push({ key: "insights", label: labels.insights, count: recentSignals.length, cameraCount: cameras.length });
  return results;
}

export function buildObserverDailySummary(signals: SignalLike[], now = Date.now()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const today = signals.filter((signal) => {
    const timestamp = new Date(signal.created_at).getTime();
    return Number.isFinite(timestamp) && timestamp >= start.getTime() && timestamp <= now;
  });
  const anomalies = today.filter(isAnomaly).length;
  const entries = today.filter((signal) => ["entered", "exited", "entry", "exit"].some((term) => observerEventType(signal).includes(term))).length;
  return {
    total: today.length,
    anomalies,
    entries,
    text: today.length
      ? `היום נקלטו ${today.length} אירועים מאומתים, מהם ${entries} אירועי כניסה או יציאה ו-${anomalies} אירועים חריגים.`
      : "עדיין לא נקלטו היום אירועים מאומתים."
  };
}
