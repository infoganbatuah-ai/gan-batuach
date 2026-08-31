import { createClient } from "@/lib/supabase/server";
import { observerEventNarrative } from "@/lib/domain/digital-observer/event-narrative";
import { observerEventMediaState } from "@/lib/domain/digital-observer/event-evidence";

export type ObserverRow = Record<string, any>;
export type ObserverMode = "home" | "business";

export type ObserverEntitlement = {
  status: "setup" | "trial" | "active" | "suspended";
  trialEndsAt: string | null;
  canConfigure: boolean;
  canTestConnection: boolean;
  canUseLiveMonitoring: boolean;
};

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

export async function loadObserverEventReviews(signal: ObserverRow | null | undefined): Promise<SafeResult<ObserverRow>> {
  if (!signal?.id || !signal.observer_site_id) return { data: [], available: false };
  const supabase = await createClient();
  return safeList<ObserverRow>("event review history", () => supabase.from("observer_signal_reviews" as any)
    .select("id,signal_id,review_status,review_note,created_at,observer_intelligence_signals!inner(observer_site_id)")
    .eq("signal_id", signal.id)
    .eq("observer_intelligence_signals.observer_site_id", signal.observer_site_id)
    .order("created_at", { ascending: false }).limit(20));
}

export function observerModeForSite(site?: ObserverRow | null): ObserverMode {
  return site?.site_type === "home" ? "home" : "business";
}

/**
 * Never infer ownership across sites. This only chooses a default from sites
 * already returned through the current user's owner/membership RLS scope.
 */
export function selectObserverSite(
  sites: ObserverRow[],
  cameras: ObserverRow[],
  requestedSiteId?: string | null
) {
  const requested = requestedSiteId ? sites.find((site) => site.id === requestedSiteId) : null;
  if (requested) return requested;

  const cameraCountBySite = new Map<string, number>();
  for (const camera of cameras) {
    if (!camera?.observer_site_id) continue;
    cameraCountBySite.set(camera.observer_site_id, (cameraCountBySite.get(camera.observer_site_id) ?? 0) + 1);
  }

  return [...sites].sort((left, right) => {
    const countDifference = (cameraCountBySite.get(right.id) ?? 0) - (cameraCountBySite.get(left.id) ?? 0);
    if (countDifference) return countDifference;
    return String(right.created_at ?? "").localeCompare(String(left.created_at ?? ""));
  })[0] ?? null;
}

export function observerCameraForSignal(signal: ObserverRow | null | undefined, cameras: ObserverRow[]) {
  const explicitSource = signal?.metadata?.camera_source_id;
  const cameraReference = explicitSource ?? signal?.camera_id;
  if (!cameraReference) return null;
  return cameras.find((camera) => camera.observer_site_id === signal?.observer_site_id
    && (camera.id === cameraReference || (explicitSource == null && camera.camera_stream_id === cameraReference))) ?? null;
}

export function observerSignalMatchesCamera(signal: ObserverRow, cameraReference: string) {
  return (signal.metadata?.camera_source_id ?? signal.camera_id) === cameraReference;
}

export function observerClipForSignal(signal: ObserverRow | null | undefined, clips: ObserverRow[]) {
  if (!signal?.id) return null;
  return clips.find((clip) => clip.signal_id === signal.id && clip.observer_site_id === signal.observer_site_id) ?? null;
}

export function observerClipHasRequiredMedia(clip: ObserverRow | null | undefined) {
  return observerEventMediaState(clip) === "available";
}

export function observerSignalHasRequiredEvidence(signal: ObserverRow, cameras: ObserverRow[], clips: ObserverRow[]) {
  const camera = observerCameraForSignal(signal, cameras);
  const clip = observerClipForSignal(signal, clips);
  return Boolean(camera && clip?.camera_source_id === camera.id && observerClipHasRequiredMedia(clip));
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
    "24_7": "24/7",
    collecting_baseline: "אוסף שגרה",
    baseline_ready: "קו בסיס מוכן",
    not_started: "טרם התחיל",
    paused: "מושהה",
    new: "חדש",
    learning: "בתהליך למידה",
    calibrated: "מכויל",
    mature: "בשל",
    observing: "אוסף תצפיות",
    ready_for_review: "מוכן לזיהוי",
    known: "אדם מוכר",
    unknown_person: "אדם לא מוכר"
  };
  return labels[String(value ?? "")] ?? String(value ?? "לא הוגדר");
}

export function observerEventLabel(value?: unknown) {
  return observerEventNarrative({ signal_type: value }).label;
}

export function resolveObserverEntitlement(subscription?: ObserverRow | null, now = new Date()): ObserverEntitlement {
  if (!subscription) {
    return {
      status: "setup",
      trialEndsAt: null,
      canConfigure: true,
      canTestConnection: true,
      canUseLiveMonitoring: false
    };
  }

  const storedStatus = String(subscription.subscription_status ?? subscription.status ?? "");
  const trialEndsAt = typeof subscription.trial_end === "string" ? subscription.trial_end : null;
  const trialExpired = storedStatus === "trial" && trialEndsAt
    ? new Date(trialEndsAt).getTime() <= now.getTime()
    : false;
  const active = storedStatus === "active" && subscription.entitlement_status === "active";
  const suspended = trialExpired || ["expired", "suspended", "cancelled", "overdue"].includes(storedStatus);

  return {
    status: active ? "active" : suspended ? "suspended" : storedStatus === "trial" ? "trial" : "setup",
    trialEndsAt,
    canConfigure: true,
    canTestConnection: true,
    canUseLiveMonitoring: active && subscription.payment_provider !== "mock" && subscription.purchase_channel !== "mock"
  };
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
    safeList<ObserverRow>("owned sites", () => supabase.from("observer_sites" as any).select("id,name,site_type,address,city,street,building_number,apartment_number,floor_kind,floor_number,postal_code,country_code,formatted_address,address_provider,address_place_id,latitude,longitude,address_verification_status,address_verified_at,business_handles_children,vision_privacy_mode,observer_runtime_status,learning_started_at,learning_target_days,timezone,active,monitoring_enabled,camera_limit,monitoring_hours,event_retention_days,observer_subscription_status,owner_profile_id,metadata,created_at").eq("owner_profile_id", profileId).neq("site_type", "kindergarten").order("created_at", { ascending: false })),
    safeList<ObserverRow>("site memberships", () => supabase.from("observer_site_memberships" as any).select("observer_site_id,member_role,observer_sites(id,name,site_type,address,city,street,building_number,apartment_number,floor_kind,floor_number,postal_code,country_code,formatted_address,address_provider,address_place_id,latitude,longitude,address_verification_status,address_verified_at,business_handles_children,vision_privacy_mode,observer_runtime_status,learning_started_at,learning_target_days,timezone,active,monitoring_enabled,camera_limit,monitoring_hours,event_retention_days,observer_subscription_status,owner_profile_id,metadata,created_at)").eq("profile_id", profileId).eq("active", true)),
    safeList<ObserverRow>("packages", () => supabase.from("observer_monitoring_packages" as any).select("id,name,package_key,package_type,camera_limit,site_limit,user_limit,monitoring_mode,event_retention_days,recording_retention_hours,live_view_enabled,alert_channels,multi_user_access,advanced_analytics,human_review_required,sms_quota,voice_call_quota,support_tier,add_ons,trial_days,monthly_price,annual_price,annual_discount_percent,currency,active,sort_order").eq("active", true).order("sort_order"))
  ]);

  const siteMap = new Map<string, ObserverRow>();
  [...owned.data, ...memberships.data.map((row) => row.observer_sites).filter(Boolean)].forEach((site) => {
    if (site?.id && site.site_type !== "kindergarten") siteMap.set(site.id, site);
  });
  const sites = Array.from(siteMap.values());
  const siteIds = sites.map((site) => site.id);
  const empty = { data: [], available: true } as SafeResult<ObserverRow>;

  const [cameraSources, legacyCameras, signals, subscriptions, schedules, watchRequests, knownPeople, identityCandidates, clips, deliveries, alertSettings, invoices, learningProfiles, baselines, feedback, recipients, deviceSlots] = siteIds.length
    ? await Promise.all([
        safeList<ObserverRow>("camera sources", () => supabase.from("digital_observer_camera_sources" as any).select("id,observer_site_id,camera_stream_id,display_name,location_label,connector_type,connector_provider,source_mode,status,health_status,stream_protocol,gateway_provider,preview_scene,capabilities,monitoring_targets,last_health_check_at,last_seen_at,last_error_code,last_error_message,metadata,created_at").in("observer_site_id", siteIds).order("created_at")),
        safeList<ObserverRow>("legacy camera readiness", () => supabase.from("camera_streams" as any).select("id,observer_site_id,name,area,camera_type,source_type,status,health_status,stream_status,gateway_registration_status,digital_observer_pilot_mode,ai_enabled,live_preview_status,playback_hls_ready,playback_webrtc_ready,gateway_stream_id,video_gateway_stream_id,last_health_check_at,last_seen,metadata").in("observer_site_id", siteIds).order("created_at")),
        safeList<ObserverRow>("signals", () => supabase.from("observer_intelligence_signals" as any).select("id,observer_site_id,camera_id,signal_type,source_type,severity,confidence,review_status,recommended_action,risk_score,human_review_required,parent_visible,metadata,created_at,reviewed_at,resolved_at").in("observer_site_id", siteIds).order("created_at", { ascending: false }).limit(200)),
        safeList<ObserverRow>("subscriptions", () => supabase.from("observer_site_subscriptions" as any).select("id,observer_site_id,package_id,status,subscription_status,entitlement_status,trial_start,trial_end,renewal_date,billing_cycle,monthly_price,annual_price,payment_provider,purchase_channel,billing_separation_key,grace_period_ends_at,pending_package_id,pending_change_effective_at").in("observer_site_id", siteIds)),
        safeList<ObserverRow>("monitoring schedules", () => supabase.from("observer_monitoring_schedules" as any).select("id,observer_site_id,schedule_mode,timezone,active_days,active_hours,status").in("observer_site_id", siteIds)),
        safeList<ObserverRow>("watch requests", () => supabase.from("observer_watch_requests" as any).select("id,observer_site_id,camera_id,camera_source_id,title,description,watch_type,priority,schedule,notification_channels,active,requires_human_review,metadata,created_at").in("observer_site_id", siteIds).order("created_at", { ascending: false })),
        safeList<ObserverRow>("known people", () => supabase.from("digital_observer_known_people" as any).select("id,observer_site_id,display_name,relationship_label,consent_status,recognition_status,camera_scope,notify_on_detection,confidence_threshold,last_confirmed_at,metadata,created_at").in("observer_site_id", siteIds).order("created_at")),
        safeList<ObserverRow>("identity candidates", () => supabase.from("digital_observer_identity_candidates" as any).select("id,observer_site_id,camera_source_id,assigned_known_person_id,candidate_status,suggested_label,first_seen_at,last_seen_at,observation_count,average_confidence,preview_available,metadata,reviewed_at,created_at").in("observer_site_id", siteIds).order("last_seen_at", { ascending: false })),
        safeList<ObserverRow>("event clips", () => supabase.from("digital_observer_event_clips" as any).select("id,observer_site_id,camera_source_id,signal_id,title,clip_status,captured_at,duration_seconds,retention_hours,delete_after,downloadable,metadata,created_at").in("observer_site_id", siteIds).order("created_at", { ascending: false })),
        safeList<ObserverRow>("notification deliveries", () => supabase.from("digital_observer_notification_deliveries" as any).select("id,observer_site_id,signal_id,channel,severity,provider_mode,delivery_status,attempt_count,sent_at,acknowledged_at,failure_reason,created_at").in("observer_site_id", siteIds).order("created_at", { ascending: false }).limit(100)),
        safeList<ObserverRow>("alert settings", () => supabase.from("observer_alert_channel_settings" as any).select("id,observer_site_id,member_profile_id,recipient_name,channel,severity_levels,enabled,package_allowed,provider_mode").in("observer_site_id", siteIds)),
        safeList<ObserverRow>("invoices", () => supabase.from("observer_invoices" as any).select("id,observer_site_id,invoice_number,amount,currency,billing_cycle,status,pdf_ready,invoice_provider,issued_at,due_at,paid_at").in("observer_site_id", siteIds).order("created_at", { ascending: false })),
        safeList<ObserverRow>("learning profiles", () => supabase.from("observer_site_learning_profiles" as any).select("observer_site_id,learning_status,learning_maturity,baseline_version,confidence_level,anomaly_readiness_score,routine_confidence,confidence_trends,metadata,created_at,updated_at").in("observer_site_id", siteIds)),
        safeList<ObserverRow>("behavior baselines", () => supabase.from("site_behavior_baselines" as any).select("id,observer_site_id,baseline_type,baseline_value,confidence_level,learning_maturity,anomaly_readiness_score,source_summary,metadata,last_calibrated_at,updated_at").in("observer_site_id", siteIds)),
        safeList<ObserverRow>("learning feedback", () => supabase.from("learning_feedback_signals" as any).select("id,observer_site_id,camera_id,source_type,source_id,event_type,review_outcome,confidence_delta,confidence_after,maturity_after,anomaly_readiness_after,metadata,created_at").in("observer_site_id", siteIds).order("created_at", { ascending: false }).limit(100)),
        safeList<ObserverRow>("authorized recipients", () => supabase.from("digital_observer_authorized_recipients" as any).select("id,observer_site_id,recipient_profile_id,display_name,relationship_label,channels,destination_hint,receives_critical_alerts,active,metadata,created_at").in("observer_site_id", siteIds).order("created_at")),
        safeList<ObserverRow>("device slots", () => supabase.from("digital_observer_device_slots" as any).select("id,observer_site_id,profile_id,device_label,platform,active,last_seen_at,metadata,created_at").in("observer_site_id", siteIds).order("last_seen_at", { ascending: false }))
      ])
    : [empty, empty, empty, empty, empty, empty, empty, empty, empty, empty, empty, empty, empty, empty, empty, empty, empty];

  const cameraSourceStreamIds = new Set(cameraSources.data.map((camera) => camera.camera_stream_id).filter(Boolean));
  const legacyObserverCameras = legacyCameras.data
    .filter((camera) => !cameraSourceStreamIds.has(camera.id))
    .map((camera) => ({
      ...camera,
      camera_stream_id: camera.id,
      display_name: camera.name,
      location_label: camera.area,
      source_mode: camera.digital_observer_pilot_mode ? "demo" : ["connected", "healthy", "online", "registered"].includes(String(camera.status ?? camera.stream_status ?? camera.health_status ?? camera.gateway_registration_status)) ? "gateway_test" : "readiness",
      connector_type: String(camera.source_type ?? camera.camera_type ?? "gateway").toLowerCase().includes("dvr") ? "dvr" : String(camera.source_type ?? camera.camera_type ?? "gateway").toLowerCase().includes("nvr") ? "nvr" : "edge_gateway",
      last_seen_at: camera.last_seen,
      metadata: {
        ...(camera.metadata && typeof camera.metadata === "object" ? camera.metadata : {}),
        gateway_stream_id: camera.gateway_stream_id ?? camera.video_gateway_stream_id ?? camera.metadata?.gateway_stream_id ?? null,
        gateway_stream_id_present: Boolean(camera.gateway_stream_id ?? camera.video_gateway_stream_id ?? camera.metadata?.gateway_stream_id)
      }
    }));
  const normalizedCameras: ObserverRow[] = [...cameraSources.data, ...legacyObserverCameras];
  const analysisReports = siteIds.length ? await safeList<ObserverRow>("source analysis reports", () =>
    supabase.from("observer_source_analysis_status" as any)
      .select("camera_source_id,observer_site_id,gateway_id,state,last_attempt_at,last_analyzed_at,detection_count,reported_at")
      .in("observer_site_id", siteIds).order("reported_at", { ascending: false }).limit(1000)) : empty;

  return {
    sites,
    packages: packages.data,
    cameras: normalizedCameras,
    signals: signals.data,
    signalDataAvailable: signals.available,
    signalLimitReached: signals.data.length >= 200,
    analysisReports: analysisReports.data,
    analysisReportsAvailable: analysisReports.available,
    subscriptions: subscriptions.data,
    schedules: schedules.data,
    watchRequests: watchRequests.data,
    knownPeople: knownPeople.data,
    identityCandidates: identityCandidates.data,
    clips: clips.data,
    deliveries: deliveries.data,
    alertSettings: alertSettings.data,
    invoices: invoices.data,
    learningProfiles: learningProfiles.data,
    baselines: baselines.data,
    feedback: feedback.data,
    recipients: recipients.data,
    deviceSlots: deviceSlots.data,
    dataAvailable: owned.available && memberships.available,
    runtimeMigrationApplied: cameraSources.available && knownPeople.available && clips.available,
    identityCandidateMigrationApplied: identityCandidates.available,
    locationLearningMigrationApplied: learningProfiles.available && baselines.available && recipients.available && deviceSlots.available
  };
}
