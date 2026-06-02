import { DashboardShell } from "@/components/dashboard-shell";
import { AiCameraEventsReview } from "@/components/ai-camera-events-review";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenAiCameraEventsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const events = profile.garden_id
    ? await supabase.from("ai_camera_events" as any).select("*, gardens(name), camera_streams(name, area)").eq("kindergarten_id", profile.garden_id).order("created_at", { ascending: false }).limit(100)
    : { data: [] };
  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="אירועי תצפיתן">
      <div className="dashboard-hero-card garden-hero-card"><div><p className="eyebrow">Human Review Required</p><h1>אירועי תצפיתן לבדיקה אנושית.</h1><p>המערכת מציגה חשדות ואינדיקציות בלבד. אין האשמות אוטומטיות ואין הודעה להורים לפני review.</p></div><span className="pill warn">Review</span></div>
      <AiCameraEventsReview events={(events.data ?? []) as any[]} role="garden" />
    </DashboardShell>
  );
}
