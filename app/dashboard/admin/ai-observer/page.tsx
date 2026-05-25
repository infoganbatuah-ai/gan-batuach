import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { AiObserverConfig } from "@/components/camera-ai-admin-modules";
import { DigitalObserverArchitecture } from "@/components/digital-observer-architecture";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function AdminAiObserverPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("ai observer rules", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("ai_observer_rules" as any).select("*").limit(100);
    logSupabaseError("ai observer rules", error);
    return { rules: data ?? [], queryError: error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { rules: [] as any[], queryError: null as string | null });
  return <DashboardShell role="admin" title="תצפיתן AI"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">AI Observer Configuration</p><h1>הגדרת תצפיתן AI לפי גן, מצלמה וסוג אירוע.</h1><p>הגדרות נשמרות גם לפני חיבור backend. אין הצהרה על Live AI לפני חיבור אמיתי.</p></div><span className={process.env.AI_GATEWAY_URL ? "pill good" : "pill warn"}>{process.env.AI_GATEWAY_URL ? "AI backend connected" : "AI backend pending connection"}</span></div><AdminDataError message={result.error ?? result.data.queryError} /><DigitalObserverArchitecture aiConnected={Boolean(process.env.AI_GATEWAY_URL)} videoConnected={Boolean(process.env.VIDEO_GATEWAY_URL)} /><AiObserverConfig rules={result.data.rules as any[]} backendConnected={Boolean(process.env.AI_GATEWAY_URL)} /></DashboardShell>;
}
