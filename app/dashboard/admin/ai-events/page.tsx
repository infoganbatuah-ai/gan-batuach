import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { AiCameraEventsReview } from "@/components/ai-camera-events-review";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

async function readSource(label: string, load: () => PromiseLike<{ data: unknown[] | null; error: unknown }>) {
  try {
    const response = await load();
    logSupabaseError(label, response.error);
    return { data: response.error ? [] : response.data ?? [], available: !response.error };
  } catch (error) {
    logSupabaseError(label, error);
    return { data: [], available: false };
  }
}

export default async function AdminAiEventsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin ai events", async () => {
    const supabase = await createClient();
    const eventsRes = await readSource("admin ai events", () => supabase.from("ai_camera_events" as any).select("*, gardens(name), camera_streams(name, area)").order("created_at", { ascending: false }).limit(100));
    const gardensRes = await readSource("admin ai event gardens", () => supabase.from("gardens" as any).select("id, name").order("name"));
    const camerasRes = await readSource("admin ai event cameras", () => supabase.from("camera_streams" as any).select("id, name, garden_id").order("name"));
    const failedSources = [!eventsRes.available && "אירועים", !gardensRes.available && "גנים", !camerasRes.available && "מצלמות"].filter(Boolean);
    return {
      events: eventsRes.data,
      gardens: gardensRes.data,
      cameras: camerasRes.data,
      availability: { events: eventsRes.available, gardens: gardensRes.available, cameras: camerasRes.available },
      queryError: failedSources.length ? `לא ניתן לטעון כרגע: ${failedSources.join(", ")}` : null
    };
  }, { events: [] as unknown[], gardens: [] as unknown[], cameras: [] as unknown[], availability: { events: false, gardens: false, cameras: false }, queryError: "לא ניתן לטעון כרגע: אירועים, גנים, מצלמות" as string | null });
  return <DashboardShell role="admin" title="אירועי תצפיתן"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">AI Digital Observer</p><h1>אירועי תצפיתן לבדיקה אנושית.</h1><p>זהו בסיס architecture בלבד: אירועים מדומים, taxonomy, הרשאות ו-review. אין עיבוד וידאו אמיתי ואין חיבור ספק AI.</p></div><span className={process.env.AI_GATEWAY_URL ? "pill good" : "pill warn"}>{process.env.AI_GATEWAY_URL ? "Gateway configured" : "Gateway pending"}</span></div><AdminDataError message={result.data.queryError ?? result.error} /><AiCameraEventsReview events={result.data.events as any[]} gardens={result.data.gardens as any[]} cameras={result.data.cameras as any[]} availability={result.data.availability} role="admin" adminMode /></DashboardShell>;
}
