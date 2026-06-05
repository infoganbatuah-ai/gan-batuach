import { GitBranch } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { CorrelatedEventsPanel } from "@/components/correlated-events-panel";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminCorrelatedEventsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("correlated events", async () => {
    const supabase = await createClient();
    const [events, links, cameras, zones, gardens] = await Promise.all([
      supabase.from("observer_correlated_events" as any).select("*, gardens(name), observer_sites(name, site_type)").order("created_at", { ascending: false }).limit(300),
      supabase.from("observer_correlated_event_links" as any).select("*, camera_streams(name), camera_zones(name, zone_type)").order("sequence_order", { ascending: true }).limit(1000),
      supabase.from("camera_streams" as any).select("id, name, garden_id, kindergarten_id").order("name").limit(500),
      supabase.from("camera_zones" as any).select("id, name, kindergarten_id, camera_id").order("name").limit(500),
      supabase.from("gardens" as any).select("id, name").order("name").limit(300)
    ]);
    [events, links, cameras, zones, gardens].forEach((query, index) => logSupabaseError(`correlated events query ${index}`, query.error));
    return {
      events: events.data ?? [],
      links: links.data ?? [],
      cameras: cameras.data ?? [],
      zones: zones.data ?? [],
      gardens: gardens.data ?? [],
      queryError: [events, links, cameras, zones].some((query) => query.error) ? "חלק מנתוני correlation לא נטענו" : null
    };
  }, { events: [] as any[], links: [] as any[], cameras: [] as any[], zones: [] as any[], gardens: [] as any[], queryError: null as string | null });

  return (
    <DashboardShell role="admin" title="Correlated Events">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Multi camera correlation</p>
          <h1>Cross-camera timelines and sensor correlation.</h1>
          <p>Mock-only correlation readiness. No identity recognition, no biometric tracking, no child/staff profiling.</p>
        </div>
        <span className="pill warn"><GitBranch size={15} /> Review required</span>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />
      <CorrelatedEventsPanel
        role="admin"
        events={result.data.events}
        links={result.data.links}
        cameras={result.data.cameras}
        zones={result.data.zones}
        gardens={result.data.gardens}
      />
    </DashboardShell>
  );
}
