import { DashboardShell } from "@/components/dashboard-shell";
import { NotificationCenter } from "@/components/notification-center";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function AdminNotificationsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("התראות", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("notifications" as any).select("*").order("created_at", { ascending: false }).limit(150);
    logSupabaseError("התראות", error);
    return { rows: (data ?? []) as any[] };
  }, { rows: [] as any[] });
  return (
    <DashboardShell role="admin" title="מרכז התראות">
      <div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Notification Center</p><h1>כל התראות המערכת במקום אחד.</h1><p>פיקוח, מסמכים, מצלמות, AI, הודעות, משימות ואישורי רישום.</p></div><span className="pill warn">Control Center</span></div>
      <NotificationCenter notifications={result.data.rows} />
    </DashboardShell>
  );
}
