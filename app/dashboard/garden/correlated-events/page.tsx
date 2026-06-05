import { GitBranch } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { CorrelatedEventsPanel } from "@/components/correlated-events-panel";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenCorrelatedEventsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [events, links, cameras, zones] = gardenId ? await Promise.all([
    supabase.from("observer_correlated_events" as any).select("*").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(150),
    supabase.from("observer_correlated_event_links" as any).select("*, camera_streams(name), camera_zones(name, zone_type)").eq("kindergarten_id", gardenId).order("sequence_order", { ascending: true }).limit(500),
    supabase.from("camera_streams" as any).select("id, name, garden_id, kindergarten_id").or(`garden_id.eq.${gardenId},kindergarten_id.eq.${gardenId}`).order("name").limit(200),
    supabase.from("camera_zones" as any).select("id, name, kindergarten_id, camera_id").eq("kindergarten_id", gardenId).order("name").limit(200)
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="Correlated Events">
      <div className="dashboard-hero-card garden-hero-card">
        <div>
          <p className="eyebrow">Multi camera correlation</p>
          <h1>צירי זמן בין מצלמות וחיישנים.</h1>
          <p>קישור אירועים בלבד. אין זיהוי זהות, אין מעקב ביומטרי ואין התראות הורים אוטומטיות.</p>
        </div>
        <span className="pill warn"><GitBranch size={15} /> Human review</span>
      </div>
      <CorrelatedEventsPanel
        role="garden"
        fixedKindergartenId={gardenId}
        events={(events.data ?? []) as any[]}
        links={(links.data ?? []) as any[]}
        cameras={(cameras.data ?? []) as any[]}
        zones={(zones.data ?? []) as any[]}
      />
    </DashboardShell>
  );
}
