import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { DigitalObserverArchitecture } from "@/components/digital-observer-architecture";
import { AiObserverWorkerDashboard } from "@/components/ai-observer-worker-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function AdminAiObserverPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("ai observer worker foundation", async () => {
    const supabase = await createClient();
    const [workers, jobs, logs, rules, zones, gardens, cameras] = await Promise.all([
      supabase.from("observer_workers" as any).select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("observer_jobs" as any).select("*, gardens(name), camera_streams(name)").order("created_at", { ascending: false }).limit(50),
      supabase.from("observer_job_logs" as any).select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("observer_rules" as any).select("*").order("priority", { ascending: false }).limit(100),
      supabase.from("camera_zones" as any).select("*, camera_streams(name)").order("created_at", { ascending: false }).limit(100),
      supabase.from("gardens" as any).select("id, name").order("name").limit(200),
      supabase.from("camera_streams" as any).select("id, name, garden_id").order("name").limit(300)
    ]);
    [workers, jobs, logs, rules, zones, gardens, cameras].forEach((res, index) => logSupabaseError(`ai observer worker query ${index}`, res.error));
    const queryError = [workers, jobs, logs, rules, zones].some((res) => res.error) ? "חלק מנתוני ה-worker לא נטענו כרגע" : null;
    return {
      workers: workers.data ?? [],
      jobs: jobs.data ?? [],
      logs: logs.data ?? [],
      rules: rules.data ?? [],
      zones: zones.data ?? [],
      gardens: gardens.data ?? [],
      cameras: cameras.data ?? [],
      queryError
    };
  }, { workers: [] as any[], jobs: [] as any[], logs: [] as any[], rules: [] as any[], zones: [] as any[], gardens: [] as any[], cameras: [] as any[], queryError: null as string | null });
  return <DashboardShell role="admin" title="תצפיתן AI"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">AI Observer Worker Foundation</p><h1>תשתית Worker לתצפיתן הדיגיטלי.</h1><p>Queue, logs, rules, zones והרצת mock בלבד. אין עיבוד וידאו אמיתי, אין ספק AI ואין האשמות אוטומטיות.</p></div><span className={process.env.AI_GATEWAY_URL ? "pill good" : "pill warn"}>{process.env.AI_GATEWAY_URL ? "AI backend configured" : "Mock mode only"}</span></div><AdminDataError message={result.error ?? result.data.queryError} /><DigitalObserverArchitecture aiConnected={Boolean(process.env.AI_GATEWAY_URL)} videoConnected={Boolean(process.env.VIDEO_GATEWAY_URL)} /><AiObserverWorkerDashboard workers={result.data.workers as any[]} jobs={result.data.jobs as any[]} logs={result.data.logs as any[]} rules={result.data.rules as any[]} zones={result.data.zones as any[]} gardens={result.data.gardens as any[]} cameras={result.data.cameras as any[]} /></DashboardShell>;
}
