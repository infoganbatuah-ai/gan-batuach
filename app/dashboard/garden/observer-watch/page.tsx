import { DashboardShell } from "@/components/dashboard-shell";
import { ObserverWatchRequestsPanel } from "@/components/observer-watch-requests-panel";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenObserverWatchPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id;
  const [requests, cameras, zones] = gardenId ? await Promise.all([
    supabase.from("observer_watch_requests" as any).select("*, gardens(name), camera_streams(name), camera_zones(name, zone_type)").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(200),
    supabase.from("camera_streams" as any).select("id, name, garden_id, observer_site_id").eq("garden_id", gardenId).order("name").limit(200),
    supabase.from("camera_zones" as any).select("id, name, zone_type, kindergarten_id, observer_site_id").eq("kindergarten_id", gardenId).order("name").limit(200)
  ]) : [{ data: [] }, { data: [] }, { data: [] }];

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="בקשות מעקב">
      <div className="dashboard-hero-card garden-hero-card">
        <div>
          <p className="eyebrow">Observer Watch Requests</p>
          <h1>מה תרצי שהתצפיתן ישים לב אליו?</h1>
          <p>בקשות מעקב מותאמות לגנים ולמצלמות. בשלב הזה הכל mock/rule-based, דורש review אנושי, ולא מוצג להורים.</p>
        </div>
        <span className="pill warn">Human review required</span>
      </div>
      <ObserverWatchRequestsPanel
        role="garden"
        fixedKindergartenId={gardenId}
        requests={(requests.data ?? []) as any[]}
        cameras={(cameras.data ?? []) as any[]}
        zones={(zones.data ?? []) as any[]}
      />
    </DashboardShell>
  );
}
