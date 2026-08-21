import { createDigitalObserverAdminDataClient } from "@/lib/domain/digital-observer/admin-access";

type ObserverAdminRow = Record<string, any>;

async function safeRows(label: string, run: () => PromiseLike<{ data: any[] | null; error: { code?: string } | null }>) {
  try {
    const result = await run();
    if (result.error) {
      console.warn(`[digital-observer-admin] ${label} unavailable`, { code: result.error.code ?? "unknown" });
      return { data: [] as ObserverAdminRow[], available: false };
    }
    return { data: (result.data ?? []) as ObserverAdminRow[], available: true };
  } catch {
    console.warn(`[digital-observer-admin] ${label} unavailable`);
    return { data: [] as ObserverAdminRow[], available: false };
  }
}

export async function loadDigitalObserverAdminRuntime() {
  const supabase = createDigitalObserverAdminDataClient();
  const [sites, memberships, cameras, signals, subscriptions, packages, providers, deliveries, learning, watchRequests] = await Promise.all([
    safeRows("sites", () => supabase.from("observer_sites").select("id,name,site_type,city,formatted_address,latitude,longitude,active,monitoring_enabled,observer_runtime_status,observer_subscription_status,created_at").is("garden_id", null).neq("site_type", "kindergarten").order("created_at", { ascending: false }).limit(500)),
    safeRows("memberships", () => supabase.from("observer_site_memberships").select("id,observer_site_id,member_role,active,created_at").order("created_at", { ascending: false }).limit(1000)),
    safeRows("camera sources", () => supabase.from("digital_observer_camera_sources").select("id,observer_site_id,display_name,location_label,connector_type,source_mode,status,health_status,last_health_check_at,last_seen_at,last_error_code,created_at").order("created_at", { ascending: false }).limit(1000)),
    safeRows("signals", () => supabase.from("observer_intelligence_signals").select("id,observer_site_id,signal_type,source_type,severity,confidence,review_status,risk_score,human_review_required,created_at,reviewed_at,resolved_at").order("created_at", { ascending: false }).limit(800)),
    safeRows("subscriptions", () => supabase.from("observer_site_subscriptions").select("id,observer_site_id,package_id,status,subscription_status,entitlement_status,trial_end,renewal_date,payment_provider,purchase_channel,created_at").order("created_at", { ascending: false }).limit(500)),
    safeRows("packages", () => supabase.from("observer_monitoring_packages").select("id,name,package_key,package_type,monthly_price,camera_limit,site_limit,user_limit,recording_retention_hours,support_tier,active,sort_order").order("sort_order", { ascending: true }).limit(100)),
    safeRows("payment providers", () => supabase.from("observer_payment_provider_readiness").select("id,provider_key,provider_name,status,mode,missing_configuration").limit(50)),
    safeRows("deliveries", () => supabase.from("digital_observer_notification_deliveries").select("id,observer_site_id,channel,severity,provider_mode,delivery_status,attempt_count,created_at,sent_at,acknowledged_at").order("created_at", { ascending: false }).limit(500)),
    safeRows("learning profiles", () => supabase.from("observer_site_learning_profiles").select("observer_site_id,learning_status,learning_maturity,confidence_level,anomaly_readiness_score,routine_confidence,updated_at").order("updated_at", { ascending: false }).limit(500)),
    safeRows("watch requests", () => supabase.from("observer_watch_requests").select("id,observer_site_id,watch_type,priority,active,requires_human_review,created_at").order("created_at", { ascending: false }).limit(500))
  ]);

  const observerSiteIds = new Set(sites.data.map((site) => site.id));
  const scoped = (rows: ObserverAdminRow[]) => rows.filter((row) => !row.observer_site_id || observerSiteIds.has(row.observer_site_id));

  return {
    sites: sites.data,
    memberships: scoped(memberships.data),
    cameras: scoped(cameras.data),
    signals: scoped(signals.data),
    subscriptions: scoped(subscriptions.data),
    packages: packages.data,
    providers: providers.data,
    deliveries: scoped(deliveries.data),
    learning: scoped(learning.data),
    watchRequests: scoped(watchRequests.data),
    dataAvailable: [sites, memberships, cameras, signals, subscriptions, packages, providers, deliveries, learning, watchRequests].every((result) => result.available)
  };
}
