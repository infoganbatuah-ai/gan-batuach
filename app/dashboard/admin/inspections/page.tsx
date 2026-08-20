import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin inspections overview", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("inspections" as any).select("id, garden_id, inspector_id, status, completed_at, weighted_score, violation_count, critical_failures, gps_verified, gardens(name, city), inspectors:inspector_id(full_name)").order("created_at", { ascending: false }).limit(120);
    logSupabaseError("admin inspections overview", error);
    return { rows: data ?? [], queryError: error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { rows: [] as any[], queryError: null as string | null });
  const rows = result.data.rows as any[];
  return <DashboardShell role="admin" title="ביקורות"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Inspection Control</p><h1>כל ביקורות הפיקוח במערכת.</h1><p>סקירת סטטוס, ציון, פקח, GPS, ליקויים ודוחות להדפסה.</p></div><div className="actions"><Link className="button secondary" href="/dashboard/admin/inspections/due">בקרוב</Link><Link className="button secondary" href="/dashboard/admin/inspections/late">באיחור</Link><Link className="button primary" href="/dashboard/admin/inspection-forms">בונה טפסים</Link></div></div><AdminDataError message={result.error ?? result.data.queryError} /><section className="filter-bar"><input placeholder="חיפוש גן / פקח" /><select><option>כל הסטטוסים</option><option>open</option><option>done</option><option>late</option></select></section><section className="dashboard-section">{rows.length === 0 ? <div className="empty-state"><strong>אין ביקורות במערכת</strong><span>ביקורות חודשיות או ביקורת ראשונה יופיעו כאן לאחר יצירת משימות פיקוח.</span></div> : <div className="procedure-list">{rows.map((row) => <article className="card procedure-card" key={row.id}><div><span className={row.status === "done" ? "pill good" : "pill warn"}>{row.status}</span><h3>{row.gardens?.name ?? row.garden_id}</h3><p>{row.gardens?.city ?? ""} · פקח: {row.inspectors?.full_name ?? "-"}</p><small>ציון {row.weighted_score ?? "-"} · ליקויים {row.violation_count ?? 0} · GPS {row.gps_verified ? "אומת" : "לא אומת"}</small></div><div className="procedure-meta"><Link className="button secondary" href={`/dashboard/admin/inspections/${row.id}/report`}>דוח</Link><Link className="button" href={`/dashboard/admin/gardens/${row.garden_id}`}>פרופיל גן</Link></div></article>)}</div>}</section></DashboardShell>;
}
