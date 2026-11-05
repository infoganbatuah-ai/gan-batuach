import { DashboardShell } from "@/components/dashboard-shell";
import { PushDiagnostics } from "@/components/push-diagnostics";
import { AdminDataError } from "@/components/admin-data-state";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPushPage() {
  await requireRole(["admin"]);
  const unavailable = { data: null, available: false };
  const result = await safeAdminData("admin-push", async () => {
    const supabase = await createClient();
    async function readSource<T extends { data: unknown; error: unknown }>(label: string, query: () => PromiseLike<T>) {
      const source = await safeAdminData(label, async () => {
        const response = await query();
        logSupabaseError(label, response.error);
        return { data: response.error ? null : response.data, available: !response.error };
      }, unavailable);
      return source.data;
    }
    const [devicesResult, logsResult] = await Promise.all([
      readSource("admin-push devices", () => supabase.from("push_device_tokens" as any).select("*").order("last_seen_at", { ascending: false }).limit(200)),
      readSource("admin-push logs", () => supabase.from("push_notification_logs" as any).select("*").order("created_at", { ascending: false }).limit(250))
    ]);
    return { devicesResult, logsResult };
  }, { devicesResult: unavailable, logsResult: unavailable });
  const { devicesResult, logsResult } = result.data;

  return (
    <DashboardShell role="admin" title="Push Notifications">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Push Foundation</p>
          <h1>אבחון Push ל-Web, Android ו-iOS.</h1>
          <p>רישום מכשירים, לוגים, כשלונות ומצב ספק. כברירת מחדל המערכת עובדת ב-mock ולא שולחת Push אמיתי.</p>
        </div>
        <span className="pill warn">{process.env.PUSH_PROVIDER === "real" ? "Provider configured" : "Mock mode"}</span>
      </div>
      <AdminDataError message={result.error ?? (!devicesResult.available || !logsResult.available ? "לא ניתן לטעון חלק מנתוני ה-Push כרגע" : null)} />
      <PushDiagnostics devices={(devicesResult.data ?? []) as any[]} logs={(logsResult.data ?? []) as any[]} devicesAvailable={devicesResult.available} logsAvailable={logsResult.available} />
    </DashboardShell>
  );
}
