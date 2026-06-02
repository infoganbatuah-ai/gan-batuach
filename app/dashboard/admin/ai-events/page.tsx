import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { AiCameraEventsReview } from "@/components/ai-camera-events-review";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function AdminAiEventsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin ai events", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("ai_camera_events" as any).select("*, gardens(name), camera_streams(name, area)").order("created_at", { ascending: false }).limit(100);
    const gardensRes = await supabase.from("gardens" as any).select("id, name").order("name");
    const camerasRes = await supabase.from("camera_streams" as any).select("id, name, garden_id").order("name");
    logSupabaseError("admin ai events", error);
    logSupabaseError("admin ai event gardens", gardensRes.error);
    logSupabaseError("admin ai event cameras", camerasRes.error);
    return {
      events: data ?? [],
      gardens: gardensRes.data ?? [],
      cameras: camerasRes.data ?? [],
      queryError: error ? "לא ניתן לטעון את נתוני אירועי התצפיתן כרגע" : null
    };
  }, { events: [] as any[], gardens: [] as any[], cameras: [] as any[], queryError: null as string | null });
  return <DashboardShell role="admin" title="אירועי תצפיתן"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">AI Digital Observer</p><h1>אירועי תצפיתן לבדיקה אנושית.</h1><p>זהו בסיס architecture בלבד: אירועים מדומים, taxonomy, הרשאות ו-review. אין עיבוד וידאו אמיתי ואין חיבור ספק AI.</p></div><span className={process.env.AI_GATEWAY_URL ? "pill good" : "pill warn"}>{process.env.AI_GATEWAY_URL ? "Gateway configured" : "Gateway pending"}</span></div><AdminDataError message={result.error ?? result.data.queryError} /><AiCameraEventsReview events={result.data.events as any[]} gardens={result.data.gardens as any[]} cameras={result.data.cameras as any[]} role="admin" adminMode /></DashboardShell>;
}
