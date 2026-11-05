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
    const { data, error } = await supabase.from("report_exports" as never).select("id, report_type, format, status, created_at" as never).limit(50);
    logSupabaseError("דוחות", error);
    return { rows: (error ? [] : data ?? []) as unknown as Array<Record<string, unknown>>, available: !error, queryError: error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { rows: [] as Array<Record<string, unknown>>, available: false, queryError: null as string | null });
  const rows = result.data.rows;
  const available = result.data.available;
  const ready = rows.filter((row) => ["ready", "done", "completed", "success"].includes(String(row.status))).length;
  const pending = rows.filter((row) => ["queued", "pending", "running", "processing"].includes(String(row.status))).length;
  return <AdminAppFrame profile={profile} activeHref="/dashboard/admin/reports" title="דוחות וניתוח נתונים" subtitle="דוחות, ייצוא, אנליטיקה, ערים ומגמות תפעוליות." badge="דוחות">
    <PremiumCard size="lg" className="admin-section-card">
      <SectionHeader eyebrow="Reports Center" title="מרכז דוחות וייצוא מתקדם" subtitle="נוכחות ילדים, שעות צוות, ביקורות, אירועים, תלונות, מצלמות, משימות וסיכום חודשי." icon={FileText} />
      <StatusChip tone="muted">מצב רשומות הייצוא</StatusChip>
    </PremiumCard>
    <DashboardGrid columns={3}>
      <MetricCard label="ייצואים" value={available ? rows.length : "לא זמין"} hint="בטווח האחרון" icon={FileText} tone={available ? "primary" : "muted"} />
      <MetricCard label="מוכנים" value={available ? ready : "לא זמין"} hint="לפי סטטוס הייצוא" icon={BarChart3} tone={available ? "success" : "muted"} />
      <MetricCard label="בתהליך" value={available ? pending : "לא זמין"} hint="Queued / Running" icon={FileText} tone={available ? pending ? "warning" : "success" : "muted"} />
    </DashboardGrid>
    <AdminDataError message={result.error ?? result.data.queryError} />
    <ReportsCenter role="admin" />
  </AdminAppFrame>;
}
