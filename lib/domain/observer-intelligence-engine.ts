import type { SupabaseClient } from "@supabase/supabase-js";

export type ObserverSummarySeverity = "info" | "low" | "medium" | "high" | "urgent" | "critical";

export type ObserverSituationSummary = {
  observer_site_id?: string | null;
  kindergarten_id?: string | null;
  summary_type:
    | "needs_review_now"
    | "camera_health_warning"
    | "unresolved_safety_indicators"
    | "correlated_event_attention"
    | "audio_indicator_attention"
    | "watch_request_attention"
    | "pickup_verification_attention"
    | "learning_readiness"
    | "site_health"
    | "mock_summary";
  severity: ObserverSummarySeverity;
  confidence: number;
  title: string;
  summary: string;
  recommended_actions: string[];
  related_event_ids: Array<{ source_type: string; id: string }>;
  status?: "open" | "reviewing" | "handled" | "dismissed" | "escalated" | "snoozed";
  dedupe_key: string;
  context_snapshot: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

const actions = {
  checkCamera: "בדיקת מצלמה מומלצת",
  reviewEvent: "מומלץ לבדוק את האירוע",
  verifyWithTeam: "מומלץ לוודא מול הצוות",
  markAfterReview: "מומלץ לסמן כתקין / לא תקין לאחר בדיקה",
  checkLearning: "מומלץ לבדוק מוכנות למידה ואזורים"
};

function severityRank(severity: string | null | undefined) {
  return ({ info: 1, low: 2, medium: 3, high: 4, urgent: 5, critical: 6 } as Record<string, number>)[severity ?? "info"] ?? 1;
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function maxSeverity(rows: any[], fallback: ObserverSummarySeverity = "medium"): ObserverSummarySeverity {
  const sorted = rows.map((row) => String(row.severity ?? "medium")).sort((a, b) => severityRank(b) - severityRank(a));
  return (sorted[0] as ObserverSummarySeverity) ?? fallback;
}

async function safeQuery<T>(label: string, query: PromiseLike<{ data: T | null; error?: any }>) {
  try {
    const result = await query;
    if (result.error) {
      console.error(`[observer-intelligence:${label}]`, result.error);
      return null;
    }
    return result.data;
  } catch (error) {
    console.error(`[observer-intelligence:${label}]`, error);
    return null;
  }
}

function sourceIds(sourceType: string, rows: any[]) {
  return rows.map((row) => ({ source_type: sourceType, id: row.id })).filter((row) => row.id);
}

function summary(input: ObserverSituationSummary): ObserverSituationSummary {
  return {
    ...input,
    status: input.status ?? "open",
    metadata: {
      ...(input.metadata ?? {}),
      observer_intelligence: true,
      human_review_required: true,
      no_automatic_accusation: true,
      no_parent_auto_notify: true,
      no_child_profiling: true,
      no_staff_scoring: true,
      no_biometric_assumptions: true
    }
  };
}

export async function generateObserverSituationSummaries(
  supabase: SupabaseClient<any, any, any>,
  input: { kindergartenId?: string | null; observerSiteId?: string | null; limit?: number } = {}
): Promise<ObserverSituationSummary[]> {
  const kindergartenId = input.kindergartenId ?? null;
  const observerSiteId = input.observerSiteId ?? null;
  const limit = input.limit ?? 50;
  const scopeFilter = kindergartenId ? { column: "kindergarten_id", value: kindergartenId } : observerSiteId ? { column: "observer_site_id", value: observerSiteId } : null;
  if (!scopeFilter) return [];

  const [
    aiEvents,
    audioEvents,
    correlatedEvents,
    watchRequests,
    pickupEvents,
    learningProfile,
    cameras,
    zones,
    routine
  ] = await Promise.all([
    safeQuery("ai", supabase.from("ai_camera_events" as any).select("id,event_type,severity,status,confidence_score,camera_id,zone_id,created_at,metadata").eq(scopeFilter.column, scopeFilter.value).in("status", ["open", "reviewing", "escalated"]).order("created_at", { ascending: false }).limit(limit)),
    safeQuery("audio", supabase.from("audio_observer_events" as any).select("id,event_type,severity,review_status,confidence,camera_id,created_at,metadata").eq(scopeFilter.column === "observer_site_id" ? "site_id" : scopeFilter.column, scopeFilter.value).in("review_status", ["pending_review", "reviewing", "escalated", "needs_more_data"]).order("created_at", { ascending: false }).limit(limit)),
    safeQuery("correlated", supabase.from("observer_correlated_events" as any).select("id,correlation_type,severity,status,confidence,involved_camera_ids,involved_zone_ids,created_at,confidence_factors").eq(scopeFilter.column, scopeFilter.value).in("status", ["open", "reviewing", "escalated", "needs_more_data"]).order("created_at", { ascending: false }).limit(limit)),
    safeQuery("watch", supabase.from("observer_watch_requests" as any).select("id,watch_type,priority,active,camera_id,zone_id,created_at").eq(scopeFilter.column, scopeFilter.value).eq("active", true).order("priority", { ascending: false }).limit(limit)),
    safeQuery("pickup", supabase.from("child_pickup_events" as any).select("id,status,authorization_type,pickup_time,camera_event_id,created_at").eq(scopeFilter.column === "observer_site_id" ? "kindergarten_id" : scopeFilter.column, scopeFilter.value).in("status", ["unusual", "parent_confirmation_requested"]).order("created_at", { ascending: false }).limit(limit)),
    kindergartenId ? safeQuery("learning", supabase.from("kindergarten_learning_profiles" as any).select("*").eq("kindergarten_id", kindergartenId).maybeSingle()) : Promise.resolve(null),
    safeQuery("cameras", supabase.from("camera_streams" as any).select("id,name,status,stream_status,health_status,gateway_registration_status,active").eq(scopeFilter.column === "observer_site_id" ? "observer_site_id" : "garden_id", scopeFilter.value).limit(250)),
    safeQuery("zones", supabase.from("camera_zones" as any).select("id,name,zone_type,is_restricted").eq(scopeFilter.column, scopeFilter.value).limit(250)),
    kindergartenId ? safeQuery("routine", supabase.from("kindergarten_routine_configs" as any).select("*").eq("kindergarten_id", kindergartenId).maybeSingle()) : Promise.resolve(null)
  ]);

  const ai = (aiEvents ?? []) as any[];
  const audio = (audioEvents ?? []) as any[];
  const correlated = (correlatedEvents ?? []) as any[];
  const watch = (watchRequests ?? []) as any[];
  const pickup = (pickupEvents ?? []) as any[];
  const cameraRows = (cameras ?? []) as any[];
  const offlineCameras = cameraRows.filter((camera) => camera.active === false || ["offline", "failed", "error", "disabled", "pending_gateway"].includes(String(camera.status ?? camera.stream_status ?? camera.health_status ?? camera.gateway_registration_status ?? "")));
  const context = {
    learning_maturity: (learningProfile as any)?.learning_maturity ?? (learningProfile as any)?.learning_status ?? "new",
    learning_confidence: (learningProfile as any)?.confidence_level ?? 0,
    anomaly_readiness: (learningProfile as any)?.anomaly_readiness_score ?? 0,
    routine_configured: Boolean(routine),
    zone_count: ((zones ?? []) as any[]).length,
    restricted_zone_count: ((zones ?? []) as any[]).filter((zone) => zone.is_restricted).length,
    camera_count: cameraRows.length,
    offline_camera_count: offlineCameras.length
  };
  const summaries: ObserverSituationSummary[] = [];

  const unresolved = [...ai, ...audio, ...correlated];
  if (unresolved.length > 0) {
    const high = unresolved.filter((event) => severityRank(event.severity) >= severityRank("high"));
    summaries.push(summary({
      observer_site_id: observerSiteId,
      kindergarten_id: kindergartenId,
      summary_type: "needs_review_now",
      severity: high.length ? maxSeverity(high, "high") : "medium",
      confidence: clamp(0.42 + unresolved.length * 0.04 + high.length * 0.08),
      title: `${unresolved.length} אירועי תצפיתן דורשים review`,
      summary: "יש אינדיקציות פתוחות ממקורות שונים. הן אינן מסקנה, ודורשות בדיקת אדם לפני כל פעולה.",
      recommended_actions: [actions.reviewEvent, actions.verifyWithTeam, actions.markAfterReview],
      related_event_ids: [...sourceIds("ai_camera_event", ai), ...sourceIds("audio_observer_event", audio), ...sourceIds("observer_correlated_event", correlated)].slice(0, 20),
      dedupe_key: `observer:${observerSiteId ?? kindergartenId}:needs-review:${new Date().toISOString().slice(0, 10)}`,
      context_snapshot: context
    }));
  }

  if (offlineCameras.length > 0) {
    summaries.push(summary({
      observer_site_id: observerSiteId,
      kindergarten_id: kindergartenId,
      summary_type: "camera_health_warning",
      severity: offlineCameras.length > 2 ? "high" : "medium",
      confidence: clamp(0.5 + offlineCameras.length * 0.08),
      title: `${offlineCameras.length} מצלמות דורשות בדיקה`,
      summary: "מצלמות לא מחוברות או ממתינות Gateway עלולות להקטין את איכות התצפיתן.",
      recommended_actions: [actions.checkCamera, "מומלץ לבדוק Gateway וחיבור רשת"],
      related_event_ids: offlineCameras.map((camera) => ({ source_type: "camera_streams", id: camera.id })).slice(0, 20),
      dedupe_key: `observer:${observerSiteId ?? kindergartenId}:camera-health:${new Date().toISOString().slice(0, 10)}`,
      context_snapshot: context
    }));
  }

  if (correlated.length > 0) {
    summaries.push(summary({
      observer_site_id: observerSiteId,
      kindergarten_id: kindergartenId,
      summary_type: "correlated_event_attention",
      severity: maxSeverity(correlated, "medium"),
      confidence: clamp(0.46 + correlated.length * 0.06),
      title: "יש צירי זמן מקושרים לבדיקה",
      summary: "אירועים ממספר מצלמות או חיישנים חוברו לציר זמן אחד. מדובר בקישור אירועים בלבד, ללא זיהוי זהות.",
      recommended_actions: [actions.reviewEvent, actions.markAfterReview],
      related_event_ids: sourceIds("observer_correlated_event", correlated).slice(0, 20),
      dedupe_key: `observer:${observerSiteId ?? kindergartenId}:correlated:${new Date().toISOString().slice(0, 10)}`,
      context_snapshot: context
    }));
  }

  if (audio.length > 0) {
    summaries.push(summary({
      observer_site_id: observerSiteId,
      kindergarten_id: kindergartenId,
      summary_type: "audio_indicator_attention",
      severity: maxSeverity(audio, "medium"),
      confidence: clamp(0.38 + audio.length * 0.05),
      title: "יש אינדיקציות שמע לבדיקה",
      summary: "אינדיקציות שמע הן סימן לבדיקה בלבד. אין תמלול, אין זיהוי קולי ואין מסקנה אוטומטית.",
      recommended_actions: [actions.reviewEvent, actions.verifyWithTeam],
      related_event_ids: sourceIds("audio_observer_event", audio).slice(0, 20),
      dedupe_key: `observer:${observerSiteId ?? kindergartenId}:audio:${new Date().toISOString().slice(0, 10)}`,
      context_snapshot: context
    }));
  }

  if (watch.length > 0) {
    summaries.push(summary({
      observer_site_id: observerSiteId,
      kindergarten_id: kindergartenId,
      summary_type: "watch_request_attention",
      severity: watch.some((request) => Number(request.priority ?? 0) >= 8) ? "medium" : "info",
      confidence: clamp(0.3 + watch.length * 0.04),
      title: `${watch.length} בקשות מעקב פעילות`,
      summary: "בקשות מעקב פעילות משפיעות על פירוש האינדיקציות, אך אינן מפעילות AI חופשי או אכיפה.",
      recommended_actions: ["מומלץ לוודא שבקשות המעקב עדיין רלוונטיות", actions.markAfterReview],
      related_event_ids: sourceIds("observer_watch_request", watch).slice(0, 20),
      dedupe_key: `observer:${observerSiteId ?? kindergartenId}:watch:${new Date().toISOString().slice(0, 10)}`,
      context_snapshot: context
    }));
  }

  if (pickup.length > 0) {
    summaries.push(summary({
      observer_site_id: observerSiteId,
      kindergarten_id: kindergartenId,
      summary_type: "pickup_verification_attention",
      severity: "high",
      confidence: clamp(0.5 + pickup.length * 0.08),
      title: "אירועי איסוף דורשים בדיקה",
      summary: "אירועי איסוף חריגים דורשים בדיקת מנהלת. אין שחרור ילד אוטומטי ואין אישור פנים אוטומטי.",
      recommended_actions: [actions.verifyWithTeam, actions.markAfterReview],
      related_event_ids: sourceIds("pickup_event", pickup).slice(0, 20),
      dedupe_key: `observer:${observerSiteId ?? kindergartenId}:pickup:${new Date().toISOString().slice(0, 10)}`,
      context_snapshot: context
    }));
  }

  if (context.learning_maturity === "new" || Number(context.anomaly_readiness) < 0.25) {
    summaries.push(summary({
      observer_site_id: observerSiteId,
      kindergarten_id: kindergartenId,
      summary_type: "learning_readiness",
      severity: "info",
      confidence: clamp(Number(context.learning_confidence) || 0.12),
      title: "למידת התצפיתן עדיין בתחילת הדרך",
      summary: "המערכת אוספת baseline של שגרה, אזורים ומצלמות. בינתיים כל תובנה היא זהירה ודורשת review.",
      recommended_actions: [actions.checkLearning, "מומלץ להשלים אזורי מצלמות ושגרת יום"],
      related_event_ids: [],
      dedupe_key: `observer:${observerSiteId ?? kindergartenId}:learning:${new Date().toISOString().slice(0, 10)}`,
      context_snapshot: context
    }));
  }

  return summaries;
}

export async function persistObserverSituationSummaries(
  supabase: SupabaseClient<any, any, any>,
  summaries: ObserverSituationSummary[]
) {
  const saved: any[] = [];
  for (const item of summaries) {
    const existing = await supabase
      .from("observer_situation_summaries" as any)
      .select("id,status")
      .eq("dedupe_key", item.dedupe_key)
      .in("status", ["open", "reviewing", "snoozed"])
      .maybeSingle();
    if (existing.data?.id) {
      const update = await supabase.from("observer_situation_summaries" as any).update({
        severity: item.severity,
        confidence: item.confidence,
        title: item.title,
        summary: item.summary,
        recommended_actions: item.recommended_actions,
        related_event_ids: item.related_event_ids,
        context_snapshot: item.context_snapshot,
        metadata: item.metadata,
        updated_at: new Date().toISOString()
      }).eq("id", existing.data.id).select("*").single();
      if (update.data) saved.push(update.data);
      continue;
    }
    const insert = await supabase.from("observer_situation_summaries" as any).insert(item).select("*").single();
    if (insert.data) saved.push(insert.data);
  }
  return saved;
}

export async function notifyObserverSummaryReviewers(
  supabase: SupabaseClient<any, any, any>,
  summaries: any[]
) {
  const important = summaries.filter((item) => ["high", "urgent", "critical"].includes(item.severity));
  for (const item of important) {
    const dedupeKey = `observer-summary:${item.id}:${new Date().toISOString().slice(0, 10)}`;
    const existing = await supabase.from("notifications" as any).select("id").contains("metadata", { dedupe_key: dedupeKey }).maybeSingle();
    if (existing.data?.id) continue;
    const recipients = await supabase
      .from("profiles" as any)
      .select("id, role")
      .in("role", ["admin", "manager", "owner"])
      .or(item.kindergarten_id ? `garden_id.eq.${item.kindergarten_id},role.eq.admin` : "role.eq.admin")
      .limit(50);
    const rows = ((recipients.data ?? []) as any[]).map((profile) => ({
      recipient_id: profile.id,
      recipient_profile_id: profile.id,
      recipient_role: profile.role,
      kindergarten_id: item.kindergarten_id,
      garden_id: item.kindergarten_id,
      title: item.title,
      body: "תצפיתן דיגיטלי מציע review אנושי. אין מסקנה אוטומטית.",
      message: item.summary,
      severity: item.severity,
      entity_type: "observer_situation_summaries",
      entity_id: item.id,
      action_url: profile.role === "admin" ? "/dashboard/admin/observer-intelligence" : "/dashboard/garden/observer-intelligence",
      metadata: { dedupe_key: dedupeKey, human_review_required: true, no_parent_auto_notify: true }
    }));
    if (rows.length) await supabase.from("notifications" as any).insert(rows);
  }
}
