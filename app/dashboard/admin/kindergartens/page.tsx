import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError, AdminEmptyState } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function AdminListPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("גנים", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("gardens" as any).select("id, name, city, safe_status, status, last_inspection_score").limit(50);
    logSupabaseError("גנים", error);
    return { rows: (data ?? []) as any[], queryError: error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { rows: [] as any[], queryError: null as string | null });
  const rows = result.data.rows;
  return <DashboardShell role="admin" title="גנים"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Admin</p><h1>כל גני הילדים במערכת</h1><p>רשימת גנים, עיר, סטטוס בטיחות ונתוני ביקורת.</p></div><span className="pill good">UI route</span></div><AdminDataError message={result.error ?? result.data.queryError} /><section className="dashboard-section">{rows.length === 0 ? <AdminEmptyState /> : <div className="procedure-list">{rows.map((row) => <article className="card procedure-card" key={row.id ?? JSON.stringify(row)}><div><h3>{row.name ?? "גן"}</h3><p>{row.city ?? ""} + " · ציון " + (row.last_inspection_score ?? "-")</p></div><div className="procedure-meta"><span className="pill">{row.status ?? row.safe_status ?? row.role ?? row.severity ?? "פעיל"}</span></div></article>)}</div>}</section></DashboardShell>;
}
