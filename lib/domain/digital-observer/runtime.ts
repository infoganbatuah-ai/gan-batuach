import { createClient } from "@/lib/supabase/server";

export type ObserverRow = Record<string, any>;
export type ObserverMode = "home" | "business";

type SafeResult<T> = {
  data: T[];
  available: boolean;
};

async function safeList<T>(label: string, run: () => any): Promise<SafeResult<T>> {
  try {
    const result = (await run()) as { data: T[] | null; error?: { code?: string } | null };
    if (result.error) {
      console.warn(`[digital-observer] ${label} unavailable`);
      return { data: [], available: false };
    }
    return { data: result.data ?? [], available: true };
  } catch {
    console.warn(`[digital-observer] ${label} unavailable`);
    return { data: [], available: false };
  }
}

export function observerModeForSite(site?: ObserverRow | null): ObserverMode {
  return site?.site_type === "home" ? "home" : "business";
}

export function observerStatusLabel(value?: unknown) {
  const labels: Record<string, string> = {
    active: "פעיל",
    connected: "מחוברת",
    healthy: "תקין",
    online: "פעיל",
    trial: "תקופת ניסיון",
    draft: "טיוטה",
    ready_to_test: "מוכנה לבדיקה",
    testing: "בבדיקה",
    degraded: "דורש בדיקה",
    offline: "מנותקת",
    failed: "נכשל",
    blocked: "חסום",
    disabled: "כבוי",
    readiness: "מוכן להגדרה",
    readiness_only: "מוכן להגדרה",
    needs_review: "ממתין לבדיקה",
    reviewing: "בבדיקה",
    confirmed: "אושר",
    dismissed: "נדחה",
    escalated: "הוסלם",
    resolved: "טופל",
    mock: "הדמיה בטוחה",
    sandbox: "סביבת בדיקה",
    pending_payment: "ממתין לתשלום",
    overdue: "חיוב דורש טיפול",
    expired: "פג תוקף",
    suspended: "מושהה",
    cancelled: "בוטל",
    info: "מידע",
    low: "נמוך",
    medium: "אזהרה",
    high: "דחוף",
    urgent: "דחוף",
    critical: "קריטי",
    home: "בית",
    business: "עסק",
    ip_camera: "מצלמת IP",
    nvr: "NVR",
    dvr: "DVR",
    rtsp: "RTSP",
    onvif: "ONVIF",
    cloud_provider: "ספק ענן",
    edge_gateway: "Edge Gateway",
    demo: "הדמיה",
    unknown: "טרם נבדק",
    event_only: "סביב אירועים",
    night_only: "לילה",
    business_hours: "שעות פעילות",
    custom_schedule: "לוח מותאם",
    "24_7": "24/7"
  };
  return labels[String(value ?? "")] ?? String(value ?? "לא הוגדר");
}

export function observerEventLabel(value?: unknown) {
  const labels: Record<string, string> = {
    ai_camera: "אירוע מצלמה",
    camera_health: "בריאות מצלמה",
    person_detected: "זוהה אדם",
    animal_detected: "זוהה בעל חיים",
    motion_after_hours: "תנועה מחוץ לשעות",
    restricted_area: "תנועה באזור מוגבל",
    camera_offline: "מצלמה נותקה",
    camera_obstruction: "ייתכן שהמצלמה מכוסה",
    pattern: "דפוס חריג",
    system: "אירוע מערכת"
  };
  return labels[String(value ?? "")] ?? "אירוע לבדיקה";
}

export function formatObserverDate(value?: string | null, options: Intl.DateTimeFormatOptions = {}) {
  if (!value) return "טרם עודכן";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "טרם עודכן";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options
  }).format(date);
}

export async function loadObserverRuntime(profileId: string) {
  const supabase = await createClient();
  const [owned, memberships, packages] = await Promise.all([
    safeList<ObserverRow>("owned sites", () => supabase.from("observer_sites" as any).select("id,name,site_type,address,timezone,active,monitoring_enabled,camera_limit,monitoring_hours,event_retention_days,observer_subscription_status,owner_profile_id,metadata,created_at").eq("owner_profile_id", profileId).neq("site_type", "kindergarten").order("created_at", { ascending: false })),
    safeList<ObserverRow>("site memberships", () => supabase.from("observer_site_memberships" as any).select("observer_site_id,member_role,observer_sites(id,name,site_type,address,timezone,active,monitoring_enabled,camera_limit,monitoring_hours,event_retention_days,observer_subscription_status,owner_profile_id,metadata,created_at)").eq("profile_id", profileId).eq("active", true)),
    safeList<ObserverRow>("packages", () => supabase.from("observer_monitoring_packages" as any).select("id,name,package_key,package_type,camera_limit,site_limit,user_limit,monitoring_mode,event_retention_days,recording_retention_hours,live_view_enabled,alert_channels,multi_user_access,advanced_analytics,human_review_required,sms_quota,voice_call_quota,support_tier,add_ons,trial_days,monthly_price,annual_price,annual_discount_percent,currency,active,sort_order").eq("active", true).order("sort_order"))
  ]);

  const siteMap = new Map<string, ObserverRow>();
  [...owned.data, ...memberships.data.map((row) => row.observer_sites).filter(Boolean)].forEach((site) => {
    if (site?.id && site.site_type !== "kindergarten") siteMap.set(site.id, site);
  });
  const sites = Array.from(siteMap.values());
  const siteIds = sites.map((site) => site.id);
  const empty = { data: [], available: true } as SafeResult<ObserverRow>;

  const [cameraSources, legacyCameras, signals, subscriptions, schedules, watchRequests, knownPeople, clips, deliveries, alertSettings, invoices] = siteIds.length
    ? await Promise.all([
        safeList<ObserverRow>("camera sources", () => supabase.from("digital_observer_camera_sources" as any).select("id,observer_site_id,camera_stream_id,display_name,location_label,connector_type,connector_provider,source_mode,status,health_status,stream_protocol,gateway_provider,preview_scene,capabilities,monitoring_targets,last_health_check_at,last_seen_at,last_error_code,last_error_message,metadata,created_at").in("observer_site_id", siteIds).order("created_at")),
        safeList<ObserverRow>("legacy camera readiness", () => supabase.from("camera_streams" as any).select("id,observer_site_id,name,area,status,health_status,stream_status,gateway_registration_status,digital_observer_pilot_mode,ai_enabled,last_health_check_at,last_seen").in("observer_site_id", siteIds).order("created_at")),
        safeList<ObserverRow>("signals", () => supabase.from("observer_intelligence_signals" as any).select("id,observer_site_id,camera_id,signal_type,source_type,severity,confidence,review_status,recommended_action,risk_score,human_review_required,parent_visible,metadata,created_at,reviewed_at,resolved_at").in("observer_site_id", siteIds).order("created_at", { ascending: false }).limit(200)),
        safeList<ObserverRow>("subscriptions", () => supabase.from("observer_site_subscriptions" as any).select("id,observer_site_id,package_id,status,subscription_status,trial_start,trial_end,renewal_date,billing_cycle,monthly_price,annual_price,payment_provider,billing_separation_key,grace_period_ends_at,pending_package_id,pending_change_effective_at").in("observer_site_id", siteIds)),
        safeList<ObserverRow>("monitoring schedules", () => supabase.from("observer_monitoring_schedules" as any).select("id,observer_site_id,schedule_mode,timezone,active_days,active_hours,status").in("observer_site_id", siteIds)),
        safeList<ObserverRow>("watch requests", () => supabase.from("observer_watch_requests" as any).select("id,observer_site_id,camera_id,title,description,watch_type,priority,schedule,notification_channels,active,requires_human_review,created_at").in("observer_site_id", siteIds).order("created_at", { ascending: false })),
        safeList<ObserverRow>("known people", () => supabase.from("digital_observer_known_people" as any).select("id,observer_site_id,display_name,relationship_label,consent_status,recognition_status,camera_scope,notify_on_detection,confidence_threshold,last_confirmed_at,metadata,created_at").in("observer_site_id", siteIds).order("created_at")),
        safeList<ObserverRow>("event clips", () => supabase.from("digital_observer_event_clips" as any).select("id,observer_site_id,camera_source_id,signal_id,title,clip_status,captured_at,duration_seconds,retention_hours,delete_after,downloadable,metadata,created_at").in("observer_site_id", siteIds).order("created_at", { ascending: false })),
        safeList<ObserverRow>("notification deliveries", () => supabase.from("digital_observer_notification_deliveries" as any).select("id,observer_site_id,signal_id,channel,severity,provider_mode,delivery_status,attempt_count,sent_at,acknowledged_at,failure_reason,created_at").in("observer_site_id", siteIds).order("created_at", { ascending: false }).limit(100)),
        safeList<ObserverRow>("alert settings", () => supabase.from("observer_alert_channel_settings" as any).select("id,observer_site_id,member_profile_id,recipient_name,channel,severity_levels,enabled,package_allowed,provider_mode").in("observer_site_id", siteIds)),
        safeList<ObserverRow>("invoices", () => supabase.from("observer_invoices" as any).select("id,observer_site_id,invoice_number,amount,currency,billing_cycle,status,pdf_ready,invoice_provider,issued_at,due_at,paid_at").in("observer_site_id", siteIds).order("created_at", { ascending: false }))
      ])
    : [empty, empty, empty, empty, empty, empty, empty, empty, empty, empty, empty];

  const normalizedCameras: ObserverRow[] = cameraSources.data.length
    ? cameraSources.data
    : legacyCameras.data.map((camera) => ({
        ...camera,
        display_name: camera.name,
        location_label: camera.area,
        source_mode: camera.digital_observer_pilot_mode ? "demo" : "readiness",
        connector_type: "gateway",
        last_seen_at: camera.last_seen
      }));

  return {
    sites,
    packages: packages.data,
    cameras: normalizedCameras,
    signals: signals.data,
    subscriptions: subscriptions.data,
    schedules: schedules.data,
    watchRequests: watchRequests.data,
    knownPeople: knownPeople.data,
    clips: clips.data,
    deliveries: deliveries.data,
    alertSettings: alertSettings.data,
    invoices: invoices.data,
    dataAvailable: owned.available && memberships.available,
    runtimeMigrationApplied: cameraSources.available && knownPeople.available && clips.available
  };
}
