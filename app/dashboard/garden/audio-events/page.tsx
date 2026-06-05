import { Ear } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AudioObserverEventsPanel } from "@/components/audio-observer-events-panel";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenAudioEventsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id ?? "";
  const [events, cameras] = await Promise.all([
    supabase.from("audio_observer_events" as any).select("*, camera_streams(name)").eq("kindergarten_id", gardenId).order("created_at", { ascending: false }).limit(150),
    supabase.from("camera_streams" as any).select("id, name, garden_id").eq("garden_id", gardenId).order("name").limit(200)
  ]);

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="אינדיקציות שמע">
      <div className="dashboard-hero-card garden-hero-card">
        <div>
          <p className="eyebrow">תצפיתן דיגיטלי</p>
          <h1>אינדיקציות שמע לבדיקה אנושית.</h1>
          <p>אין תמלול שיחות, אין זיהוי קולי ואין מסקנות משמעתיות. כל סימן דורש בדיקת אדם.</p>
        </div>
        <span className="pill warn"><Ear size={15} /> בלי תמלול</span>
      </div>
      <AudioObserverEventsPanel role="garden" fixedKindergartenId={gardenId} events={(events.data ?? []) as any[]} cameras={(cameras.data ?? []) as any[]} />
    </DashboardShell>
  );
}
