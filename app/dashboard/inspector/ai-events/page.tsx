import { DashboardShell } from "@/components/dashboard-shell";
import { AiEventsManager } from "@/components/camera-ai-admin-modules";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function InspectorAiEventsPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const gardensRes = await supabase.from("gardens" as any).select("id").eq("inspector_id", profile.id);
  const gardenIds = (gardensRes.data ?? []).map((garden: any) => garden.id);
  const eventsRes = gardenIds.length ? await supabase.from("ai_events" as any).select("id, garden_id, camera_stream_id, event_type, severity, status, confidence, detected_at, handled_by, gardens(name), camera_streams(name)").in("garden_id", gardenIds).order("detected_at", { ascending: false }).limit(100) : { data: [] };
  return <DashboardShell role="inspector" title="אירועי AI"><div className="dashboard-hero-card"><div><p className="eyebrow">Inspector scoped AI</p><h1>אירועי AI בגנים שבאחריותך.</h1><p>אירועים, חומרה, סטטוס ומשימות תיקון רק בגנים שהוקצו לפקח.</p></div><span className="pill good">Scoped</span></div><AiEventsManager events={(eventsRes.data ?? []) as any[]} /></DashboardShell>;
}
