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
  return <DashboardShell role="inspector" title="אירועי תצפיתן"><div className="dashboard-hero-card"><div><p className="eyebrow">Inspector scoped observer</p><h1>אירועי תצפיתן בגנים שבאחריותך.</h1><p>מוצגים רק אירועים חשודים/אינדיקטיביים בגנים שהוקצו לך. כל אירוע דורש review אנושי לפני הסלמה.</p></div><span className="pill good">Scoped</span></div><AiCameraEventsReview events={(eventsRes.data ?? []) as any[]} role="inspector" /></DashboardShell>;
}
