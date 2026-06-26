import { AdminDataError } from "@/components/admin-data-state";
import { AdminAppFrame } from "@/components/admin-app-ui";
import { BarChart3, FileText } from "lucide-react";
import { DashboardGrid, MetricCard, PremiumCard, SectionHeader, StatusChip } from "@/components/gan-batuach-design-system";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { ReportsCenter } from "@/components/reports-center";

export default async function AdminListPage() {
  const { profile } = await requireRole(["admin"]);
  const result = await safeAdminData("דוחות", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("report_exports" as any).select("id, report_type, format, status, created_at").limit(50);
    logSupabaseError("דוחות", error);
    return { rows: (data ?? []) as any[], queryError: error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { rows: [] as any[], queryError: null as string | null });
  const rows = result.data.rows;
  const ready = rows.filter((row) => ["ready", "done", "completed", "success"].includes(String(row.status))).length;
  const pending = rows.filter((row) => ["queued", "pending", "running", "processing"].includes(String(row.status))).length;
  return <AdminAppFrame profile={profile} activeHref="/dashboard/admin/reports" title="דוחות וניתוח נתונים" subtitle="דוחות, ייצוא, אנליטיקה, ערים ומגמות תפעוליות." badge="דוחות">
    <PremiumCard size="lg" className="admin-section-card">
      <SectionHeader eyebrow="Reports Center" title="מרכז דוחות וייצוא מתקדם" subtitle="נוכחות ילדים, שעות צוות, ביקורות, אירועים, תלונות, מצלמות, משימות וסיכום חודשי." icon={FileText} />
      <StatusChip tone="success">Export ready when backend exists</StatusChip>
    </PremiumCard>
    <DashboardGrid columns={3}>
      <MetricCard label="ייצואים" value={rows.length} hint="בטווח האחרון" icon={FileText} tone="primary" />
      <MetricCard label="מוכנים" value={ready} hint="קבצים זמינים" icon={BarChart3} tone="success" />
      <MetricCard label="בתהליך" value={pending} hint="Queued / Running" icon={FileText} tone={pending ? "warning" : "success"} />
    </DashboardGrid>
    <AdminDataError message={result.error ?? result.data.queryError} />
    <ReportsCenter exports={rows} />
  </AdminAppFrame>;
}
