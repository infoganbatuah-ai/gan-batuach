import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { ReportsCenter } from "@/components/reports-center";

export default async function AdminListPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("דוחות", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("report_exports" as any).select("id, report_type, format, status, created_at").limit(50);
    logSupabaseError("דוחות", error);
    return { rows: (data ?? []) as any[], queryError: error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { rows: [] as any[], queryError: null as string | null });
  const rows = result.data.rows;
  return <DashboardShell role="admin" title="דוחות"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Reports Center</p><h1>מרכז דוחות וייצוא מתקדם.</h1><p>נוכחות ילדים, שעות צוות, ביקורות, אירועים, תלונות, מצלמות, משימות וסיכום חודשי.</p></div><span className="pill good">Export ready</span></div><AdminDataError message={result.error ?? result.data.queryError} />{rows.length === 0 ? null : null}<ReportsCenter exports={rows} /></DashboardShell>;
}
