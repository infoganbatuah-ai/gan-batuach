type SupabaseLike = any;

export type ObserverWatchRequest = {
  id: string;
  observer_site_id?: string | null;
  kindergarten_id?: string | null;
  camera_id?: string | null;
  zone_id?: string | null;
  title: string;
  description?: string | null;
  watch_type: string;
  active: boolean;
  priority: number;
  schedule?: Record<string, unknown> | null;
  notification_channels?: unknown;
  requires_human_review?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

export type WatchRuleInput = {
  watchRequestId: string;
  ruleKey: string;
  eventType: string;
  severity: "info" | "low" | "medium" | "high" | "urgent" | "critical";
  title: string;
  description: string;
  schedule: Record<string, unknown>;
  requiresHumanReview: true;
  parentVisible: false;
  metadata: Record<string, unknown>;
};

const watchTypeMap: Record<string, { ruleKey: string; eventType: string; severity: WatchRuleInput["severity"]; action: string }> = {
  movement_in_area: { ruleKey: "crowding_suspected", eventType: "motion_detected", severity: "medium", action: "בדיקה אם התנועה באזור תואמת לשגרה." },
  no_movement: { ruleKey: "child_missing_from_area", eventType: "no_motion_too_long", severity: "medium", action: "בדיקה אם חוסר התנועה חריג ביחס ללוח הזמנים." },
  door_left_open: { ruleKey: "door_open", eventType: "gate_or_door_open", severity: "high", action: "בדיקה של דלת או שער שנשארו פתוחים." },
  person_near_object: { ruleKey: "person_in_restricted_area", eventType: "person_detected", severity: "medium", action: "בדיקה של אדם ליד אזור או חפץ שהוגדרו למעקב." },
  restricted_area_entry: { ruleKey: "person_in_restricted_area", eventType: "restricted_area_entry", severity: "high", action: "בדיקה של כניסה לאזור מוגבל." },
  after_hours_activity: { ruleKey: "crowding_suspected", eventType: "motion_detected", severity: "high", action: "בדיקה של פעילות מחוץ לשעות שהוגדרו." },
  camera_obstruction: { ruleKey: "camera_offline", eventType: "camera_obstruction_suspected", severity: "urgent", action: "בדיקה אם המצלמה חסומה או לא מציגה תמונה תקינה." },
  custom_text_instruction: { ruleKey: "custom_watch_request", eventType: "person_detected", severity: "medium", action: "בדיקה אנושית של בקשת מעקב מותאמת." }
};

export function translateWatchRequestToRuleInput(request: ObserverWatchRequest): WatchRuleInput {
  const mapped = watchTypeMap[request.watch_type] ?? watchTypeMap.custom_text_instruction;
  return {
    watchRequestId: request.id,
    ruleKey: mapped.ruleKey,
    eventType: mapped.eventType,
    severity: mapped.severity,
    title: request.title,
    description: request.description || mapped.action,
    schedule: request.schedule ?? { mode: "always_active" },
    requiresHumanReview: true,
    parentVisible: false,
    metadata: {
      watch_type: request.watch_type,
      watch_request_id: request.id,
      recommended_action: mapped.action,
      custom_text_instruction: request.watch_type === "custom_text_instruction" ? request.description ?? request.title : null,
      no_natural_language_ai_parsing: true
    }
  };
}

export function schedulePreset(mode: string, timezone = "Asia/Jerusalem") {
  if (mode === "business_hours") return { mode, timezone, days: ["sun", "mon", "tue", "wed", "thu"], hours: { start: "08:00", end: "18:00" } };
  if (mode === "night_only") return { mode, timezone, days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], hours: { start: "22:00", end: "06:00" } };
  if (mode === "custom_days_hours") return { mode, timezone, days: [], hours: { start: "", end: "" } };
  return { mode: "always_active", timezone };
}

export async function loadActiveWatchRequests(
  supabase: SupabaseLike,
  scope: { observerSiteId?: string | null; kindergartenId?: string | null; cameraId?: string | null; zoneId?: string | null }
) {
  let query = supabase.from("observer_watch_requests" as any).select("*").eq("active", true).order("priority", { ascending: false }).limit(100);
  const filters: string[] = [];
  if (scope.observerSiteId) filters.push(`observer_site_id.eq.${scope.observerSiteId}`);
  if (scope.kindergartenId) filters.push(`kindergarten_id.eq.${scope.kindergartenId}`);
  if (scope.cameraId) filters.push(`camera_id.eq.${scope.cameraId}`);
  if (scope.zoneId) filters.push(`zone_id.eq.${scope.zoneId}`);
  if (filters.length) query = query.or(filters.join(",") as any);
  const { data, error } = await query;
  if (error) return { requests: [] as ObserverWatchRequest[], error: error.message };
  return { requests: (data ?? []) as ObserverWatchRequest[], error: null };
}

export function buildMockWatchEventPayload(request: ObserverWatchRequest, scope: { kindergartenId?: string | null; observerSiteId?: string | null; cameraId?: string | null; zoneId?: string | null }) {
  const rule = translateWatchRequestToRuleInput(request);
  return {
    kindergarten_id: request.kindergarten_id ?? scope.kindergartenId ?? null,
    observer_site_id: request.observer_site_id ?? scope.observerSiteId ?? null,
    camera_id: request.camera_id ?? scope.cameraId ?? null,
    zone_id: request.zone_id ?? scope.zoneId ?? null,
    watch_request_id: request.id,
    event_type: rule.eventType,
    severity: rule.severity,
    title: `בקשת מעקב דורשת review: ${request.title}`,
    description: rule.description,
    confidence_score: 0.51,
    recommended_action: String(rule.metadata.recommended_action),
    detected_entities: [],
    shadow_mode: true,
    requires_human_review: true,
    parent_visible: false,
    detector_provider: "watch_request_mock",
    detector_mode: "local_shadow",
    metadata: { ...rule.metadata, mock_watch_request: true, parent_visible: false, requires_human_review: true },
    is_demo: true
  };
}
