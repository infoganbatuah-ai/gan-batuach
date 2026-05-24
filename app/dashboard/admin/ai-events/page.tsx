import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError, AdminEmptyState } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function AdminListPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("אירועי AI", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("ai_events" as any).select("id, event_type, severity, status, confidence, detected_at").limit(50);
    logSupabaseError("אירועי AI", error);
    return { rows: (data ?? []) as any[], queryError: error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { rows: [] as any[], queryError: null as string | null });
  const rows = result.data.rows;
  return <DashboardShell role="admin" title="אירועי AI"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Admin</p><h1>אירועי תצפיתן AI</h1><p>אירועים, חומרה, confidence וסטטוס טיפול.</p></div><span className="pill good">UI route</span></div><AdminDataError message={result.error ?? result.data.queryError} /><section className="dashboard-section">{rows.length === 0 ? <AdminEmptyState /> : <div className="procedure-list">{rows.map((row) => <article className="card procedure-card" key={row.id ?? JSON.stringify(row)}><div><h3>{row.event_type ?? "אירוע AI"}</h3><p>"confidence " + (row.confidence ?? "-")</p></div><div className="procedure-meta"><span className="pill">{row.status ?? row.safe_status ?? row.role ?? row.severity ?? "פעיל"}</span></div></article>)}</div>}</section></DashboardShell>;
}
