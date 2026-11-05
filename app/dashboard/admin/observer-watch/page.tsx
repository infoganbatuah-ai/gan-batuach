import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ObserverWatchRequestsPanel } from "@/components/observer-watch-requests-panel";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminObserverWatchPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("observer watch requests", async () => {
    const supabase = await createClient();
    const [requests, cameras, zones, gardens, observerSites, events] = await Promise.all([
      async () => supabase.from("observer_watch_requests" as any).select("*, gardens(name), observer_sites(name, site_type), camera_streams(name), camera_zones(name, zone_type)").order("created_at", { ascending: false }).limit(300),
      async () => supabase.from("camera_streams" as any).select("id, name, garden_id, observer_site_id").order("name").limit(500),
      async () => supabase.from("camera_zones" as any).select("id, name, zone_type, kindergarten_id, observer_site_id").order("name").limit(500),
      async () => supabase.from("gardens" as any).select("id, name").order("name").limit(300),
      async () => supabase.from("observer_sites" as any).select("id, name, site_type").neq("site_type", "kindergarten").order("name").limit(300),
      async () => supabase.from("ai_camera_events" as any).select("id, watch_request_id").not("watch_request_id", "is", null).limit(500)
    ].map(async (query, index) => {
      try {
        const result = await query();
        logSupabaseError("observer watch admin query " + index, result.error);
        return { data: result.error ? [] : result.data ?? [], available: !result.error };
      } catch {
        logSupabaseError("observer watch admin query " + index, true);
        return { data: [], available: false };
      }
    }));
    return {
      requests: requests.data ?? [],
      cameras: cameras.data ?? [],
      zones: zones.data ?? [],
      gardens: gardens.data ?? [],
      observerSites: observerSites.data ?? [],
      triggeredCount: events.data.length,
      availability: { requests: requests.available, cameras: cameras.available, zones: zones.available, gardens: gardens.available, observerSites: observerSites.available, events: events.available },
      queryError: [requests, cameras, zones, gardens, observerSites, events].some((query) => !query.available) ? "חלק מנתוני בקשות המעקב לא נטענו" : null
    };
  }, { requests: [] as any[], cameras: [] as any[], zones: [] as any[], gardens: [] as any[], observerSites: [] as any[], triggeredCount: 0, availability: { requests: false, cameras: false, zones: false, gardens: false, observerSites: false, events: false }, queryError: null as string | null });

  return (
    <DashboardShell role="admin" title="Observer Watch">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Custom watch requests</p>
          <h1>בקשות מעקב מותאמות לתצפיתן.</h1>
          <p>Mock/rule-based בלבד. אין AI אמיתי, אין האשמות אוטומטיות, ואין הודעות להורים מאירועים גולמיים.</p>
        </div>
        <span className="pill warn">{result.data.availability.events ? result.data.triggeredCount : "לא זמין"} triggered mock events</span>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />
      <ObserverWatchRequestsPanel
        role="admin"
        requests={result.data.requests}
        cameras={result.data.cameras}
        zones={result.data.zones}
        gardens={result.data.gardens}
        observerSites={result.data.observerSites}
        availability={result.data.availability}
      />
    </DashboardShell>
  );
}
