export type SafetyRole = "owner" | "manager" | "parent" | "staff" | "inspector" | "admin";

export type CameraTruthState = "online" | "degraded" | "offline" | "setup_required" | "unavailable";

export type SafetyCamera = {
  id: string;
  name: string;
  area: string;
  gardenName?: string | null;
  truthState: CameraTruthState;
  statusLabel: string;
  lastCheck: string | null;
  monitoring: boolean;
  recordingEnabled: boolean;
  permission: "permitted_context" | "evidence_only" | "denied";
  permissionLabel: string;
  liveState: "production_verification_required" | "permission_denied";
  liveLabel: string;
  actionRequired: boolean;
};

export type SafetyIncident = {
  id: string;
  title: string;
  status: string;
  severity: string;
  createdAt: string | null;
  description?: string | null;
  gardenName?: string | null;
};

const ONLINE = new Set(["online", "connected", "healthy", "active"]);
const DEGRADED = new Set(["degraded", "warning", "unstable", "partial", "testing"]);
const OFFLINE = new Set(["offline", "failed", "error", "no_signal", "unreachable", "unauthorized"]);
const SETUP = new Set(["pending", "pending_gateway", "not_configured", "setup_required", "draft"]);

function normalizedValues(camera: Record<string, unknown>) {
  return [camera.status, camera.stream_status, camera.health_status, camera.gateway_registration_status, camera.last_test_status]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase());
}

export function cameraTruthState(camera: Record<string, unknown>): CameraTruthState {
  const values = normalizedValues(camera);
  if (camera.active === false || values.includes("disabled")) return "unavailable";
  if (values.some((value) => OFFLINE.has(value))) return "offline";
  if (values.some((value) => DEGRADED.has(value))) return "degraded";
  if (values.some((value) => SETUP.has(value))) return "setup_required";
  if (camera.active === true && values.some((value) => ONLINE.has(value))) return "online";
  return "setup_required";
}

const stateLabel: Record<CameraTruthState, string> = {
  online: "מחוברת",
  degraded: "חיבור מוגבל",
  offline: "לא מחוברת",
  setup_required: "נדרשת הגדרה",
  unavailable: "לא זמינה"
};

function permissionFor(role: SafetyRole, camera: Record<string, unknown>) {
  if (role === "parent") return camera.parent_view_allowed === true || camera.parent_viewing_allowed === true
    ? { permission: "permitted_context" as const, label: "הגן אישר הקשר צפייה" }
    : { permission: "denied" as const, label: "הגן לא אישר צפייה" };
  if (role === "staff") return camera.staff_view_allowed === true
    ? { permission: "permitted_context" as const, label: "מאושרת לצוות המשויך" }
    : { permission: "denied" as const, label: "לא מאושרת לצוות" };
  if (role === "inspector") return camera.inspector_view_allowed === false
    ? { permission: "denied" as const, label: "אין הרשאת פיקוח" }
    : { permission: "evidence_only" as const, label: "הקשר ראיות בלבד" };
  return { permission: "permitted_context" as const, label: role === "admin" ? "פיקוח תפעולי לפי הרשאה" : "ניהול הגן הפעיל" };
}

/**
 * The canonical Management camera contract has connectivity/readiness fields,
 * but no explicit Production-verification attestation for Live. HLS/WebRTC
 * readiness, a gateway id, local_mock, shadow or sandbox are never promoted to
 * Production truth here.
 */
export const MANAGEMENT_LIVE_PRODUCTION_VERIFIED = false;

export function toSafetyCamera(camera: Record<string, unknown>, role: SafetyRole): SafetyCamera {
  const truthState = cameraTruthState(camera);
  const permission = permissionFor(role, camera);
  const liveState = permission.permission === "denied" ? "permission_denied" : "production_verification_required";
  const lastCheck = [camera.last_health_check_at, camera.last_test_at, camera.last_seen]
    .find((value): value is string => typeof value === "string" && Boolean(value)) ?? null;
  const name = typeof camera.name === "string" && camera.name.trim() ? camera.name.trim() : "מצלמת גן";
  const areaValue = camera.area ?? camera.camera_zone_label;
  return {
    id: String(camera.id),
    name,
    area: typeof areaValue === "string" && areaValue.trim() ? areaValue.trim() : "אזור לא הוגדר",
    gardenName: typeof camera.garden_name === "string" ? camera.garden_name : null,
    truthState,
    statusLabel: stateLabel[truthState],
    lastCheck,
    monitoring: camera.observer_enabled === true && truthState === "online",
    recordingEnabled: camera.recording_enabled === true,
    permission: permission.permission,
    permissionLabel: permission.label,
    liveState,
    liveLabel: liveState === "permission_denied" ? "אין הרשאת Live" : "Live דורש אימות Production",
    actionRequired: truthState !== "online"
  };
}

export function safetySummary(cameras: SafetyCamera[]) {
  const count = (state: CameraTruthState) => cameras.filter((camera) => camera.truthState === state).length;
  return {
    total: cameras.length,
    online: count("online"),
    degraded: count("degraded"),
    offline: count("offline"),
    setupRequired: count("setup_required"),
    unavailable: count("unavailable"),
    actionRequired: cameras.filter((camera) => camera.actionRequired).length,
    recordingDisabled: cameras.filter((camera) => !camera.recordingEnabled).length
  };
}

export function safeIncident(row: Record<string, unknown>): SafetyIncident {
  return {
    id: String(row.id),
    title: typeof row.title === "string" && row.title.trim() ? row.title.trim() : "דיווח בטיחות",
    status: typeof row.status === "string" ? row.status : "open",
    severity: typeof row.severity === "string" ? row.severity : "unknown",
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    description: typeof row.description === "string" ? row.description : null,
    gardenName: typeof row.garden_name === "string" ? row.garden_name : null
  };
}
