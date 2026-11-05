import { createHash } from "node:crypto";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { DigitalObserverArchitecture } from "@/components/digital-observer-architecture";
import { AiObserverWorkerDashboard } from "@/components/ai-observer-worker-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

async function safeRows<T>(query: PromiseLike<{ data: T[] | null; error: unknown }>, index: number) {
  try {
    const result = await query;
    logSupabaseError(`ai observer worker query ${index}`, result.error);
    return { data: result.error ? [] : (result.data ?? []), failed: Boolean(result.error) };
  } catch {
    logSupabaseError(`ai observer worker query ${index}`, true);
    return { data: [] as T[], failed: true };
  }
}

export default async function AdminAiObserverPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("ai observer worker foundation", async () => {
    const supabase = await createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [workers, jobs, logs, rules, zones, gardens, cameras, shadowEvents] = await Promise.all([
      safeRows(supabase.from("observer_workers" as any).select("*").order("created_at", { ascending: false }).limit(20), 0),
      safeRows(supabase.from("observer_jobs" as any).select("*, gardens(name), camera_streams(name)").order("created_at", { ascending: false }).limit(50), 1),
      safeRows(supabase.from("observer_job_logs" as any).select("*").order("created_at", { ascending: false }).limit(50), 2),
      safeRows(supabase.from("observer_rules" as any).select("*").order("priority", { ascending: false }).limit(100), 3),
      safeRows(supabase.from("camera_zones" as any).select("*, camera_streams(name)").order("created_at", { ascending: false }).limit(100), 4),
      safeRows(supabase.from("gardens" as any).select("id, name").order("name").limit(200), 5),
      safeRows(supabase.from("camera_streams" as any).select("id, name, garden_id").order("name").limit(300), 6),
      safeRows(supabase.from("ai_camera_events" as any).select("id, event_type, severity, confidence_score, review_outcome, detector_provider, detector_mode, camera_id, kindergarten_id, metadata, created_at").eq("shadow_mode", true).gte("created_at", today.toISOString()).order("created_at", { ascending: false }).limit(200), 7)
    ]);
    const failures = [workers, jobs, logs, rules, zones, gardens, cameras, shadowEvents].map(res => res.failed);
    const queryError = failures.some(Boolean) ? "חלק מנתוני ה-worker לא נטענו כרגע" : null;
    return {
      workers: workers.data ?? [],
      jobs: jobs.data ?? [],
      logs: logs.data ?? [],
      rules: rules.data ?? [],
      zones: zones.data ?? [],
      gardens: gardens.data ?? [],
      cameras: cameras.data ?? [],
      shadowEvents: shadowEvents.data ?? [],
      failures,
      queryError
    };
  }, { workers: [] as any[], jobs: [] as any[], logs: [] as any[], rules: [] as any[], zones: [] as any[], gardens: [] as any[], cameras: [] as any[], shadowEvents: [] as any[], failures: Array(8).fill(true) as boolean[], queryError: null as string | null });
  // Only state-bearing sources reset optimistic rows and destination selection.
  const panelKey = createHash("sha256").update(JSON.stringify({
    jobs: result.data.jobs, rules: result.data.rules,
    gardens: result.data.gardens, cameras: result.data.cameras,
    failures: [1, 3, 5, 6].map(index => result.data.failures[index])
  })).digest("hex");
  return <DashboardShell role="admin" title="תצפיתן AI"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">AI Observer Worker Foundation</p><h1>תשתית Worker לתצפיתן הדיגיטלי.</h1><p>Queue, logs, rules, zones והרצת local shadow בלבד. אין עיבוד וידאו אמיתי, אין ספק AI ואין האשמות אוטומטיות.</p></div><span className="pill warn">local_mock shadow</span></div><AdminDataError message={result.error ?? result.data.queryError} /><DigitalObserverArchitecture aiConnected={Boolean(process.env.AI_GATEWAY_URL)} videoConnected={Boolean(process.env.VIDEO_GATEWAY_URL)} /><AiObserverWorkerDashboard key={panelKey} failures={result.data.failures} workers={result.data.workers as any[]} jobs={result.data.jobs as any[]} logs={result.data.logs as any[]} rules={result.data.rules as any[]} zones={result.data.zones as any[]} gardens={result.data.gardens as any[]} cameras={result.data.cameras as any[]} shadowEvents={result.data.shadowEvents as any[]} /></DashboardShell>;
}
