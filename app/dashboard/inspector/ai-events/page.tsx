import { DashboardShell } from "@/components/dashboard-shell";
import { AiCameraEventsReview } from "@/components/ai-camera-events-review";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function InspectorAiEventsPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const gardensRes = await supabase.from("gardens" as any).select("id").eq("inspector_id", profile.id);
  const gardenIds = (gardensRes.data ?? []).map((garden: any) => garden.id);
  const eventsRes = gardenIds.length ? await supabase.from("ai_camera_events" as any).select("*, gardens(name), camera_streams(name, area)").in("kindergarten_id", gardenIds).order("created_at", { ascending: false }).limit(100) : { data: [] };
  return <DashboardShell role="inspector" title="התראות תצפיתן"><div className="parent-page-head inspector-page-head"><div><p className="eyebrow">התראות בטיחות</p><h1>אירועים שדורשים בדיקה אנושית.</h1><p>מוצגות רק התראות מגנים שבאחריותך. אין פעולה אוטומטית בלי בדיקה והחלטה של אדם.</p></div><span className="pill good">לפי שיוך גנים</span></div><AiCameraEventsReview events={(eventsRes.data ?? []) as any[]} role="inspector" /></DashboardShell>;
}
