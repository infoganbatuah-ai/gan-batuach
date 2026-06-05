import { Ear } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { AudioObserverEventsPanel } from "@/components/audio-observer-events-panel";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminAudioEventsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("audio observer events", async () => {
    const supabase = await createClient();
    const [events, cameras, gardens] = await Promise.all([
      supabase.from("audio_observer_events" as any).select("*, gardens(name), camera_streams(name)").order("created_at", { ascending: false }).limit(300),
      supabase.from("camera_streams" as any).select("id, name, garden_id").order("name").limit(500),
      supabase.from("gardens" as any).select("id, name").order("name").limit(300)
    ]);
    [events, cameras, gardens].forEach((query, index) => logSupabaseError("audio observer query " + index, query.error));
    return {
      events: events.data ?? [],
      cameras: cameras.data ?? [],
      gardens: gardens.data ?? [],
      queryError: events.error ? "לא ניתן לטעון אירועי שמע כרגע" : null
    };
  }, { events: [] as any[], cameras: [] as any[], gardens: [] as any[], queryError: null as string | null });

  return (
    <DashboardShell role="admin" title="Audio Observer">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Audio intelligence readiness</p>
          <h1>Audio trends and distress indicators.</h1>
          <p>Mock-only architecture for future audio safety indicators. No speech-to-text surveillance, no parent audio review, no automatic accusations.</p>
        </div>
        <span className="pill warn"><Ear size={15} /> Human review required</span>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />
      <AudioObserverEventsPanel role="admin" events={result.data.events} cameras={result.data.cameras} gardens={result.data.gardens} />
    </DashboardShell>
  );
}
