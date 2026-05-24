import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { AiEventsManager } from "@/components/camera-ai-admin-modules";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function AdminAiEventsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin ai events", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("ai_events" as any).select("id, garden_id, camera_stream_id, event_type, severity, status, confidence, detected_at, handled_by, gardens(name), camera_streams(name)").limit(100);
    logSupabaseError("admin ai events", error);
    return { events: data ?? [], queryError: error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { events: [] as any[], queryError: null as string | null });
  return <DashboardShell role="admin" title="אירועי AI"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">AI Events</p><h1>אירועי תצפיתן AI ופעולות טיפול.</h1><p>אירועים, סינון, חומרה, confidence, snapshot ופעולות המשך.</p></div><span className={process.env.AI_GATEWAY_URL ? "pill good" : "pill warn"}>{process.env.AI_GATEWAY_URL ? "AI backend connected" : "AI backend pending"}</span></div><AdminDataError message={result.error ?? result.data.queryError} /><AiEventsManager events={result.data.events as any[]} /></DashboardShell>;
}
