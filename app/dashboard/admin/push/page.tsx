import { DashboardShell } from "@/components/dashboard-shell";
import { PushDiagnostics } from "@/components/push-diagnostics";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPushPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const [devicesResult, logsResult] = await Promise.all([
    supabase.from("push_device_tokens" as any).select("*").order("last_seen_at", { ascending: false }).limit(200),
    supabase.from("push_notification_logs" as any).select("*").order("created_at", { ascending: false }).limit(250)
  ]);

  if (devicesResult.error) console.error("[admin-push-page] devices failed", { error: devicesResult.error.message });
  if (logsResult.error) console.error("[admin-push-page] logs failed", { error: logsResult.error.message });

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
      <PushDiagnostics devices={(devicesResult.data ?? []) as any[]} logs={(logsResult.data ?? []) as any[]} />
    </DashboardShell>
  );
}
