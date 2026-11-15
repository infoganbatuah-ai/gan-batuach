import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { filterAdminInspections, normalizeAdminInspectionFilters } from "@/lib/admin-inspection-filters";
import { createClient } from "@/lib/supabase/server";

type InspectionRow = { id: string; garden_id: string; status: string; weighted_score: number | null; violation_count: number | null; gps_verified: boolean | null; gardens: { name: string | null; city: string | null } | null; inspectors: { full_name: string | null } | null };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[]; status?: string | string[] }> }) {
  await requireRole(["admin"]);
  const filters = normalizeAdminInspectionFilters(await searchParams);
  const result = await safeAdminData("admin inspections overview", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("inspections" as never)
      .select("id, garden_id, inspector_id, status, completed_at, weighted_score, violation_count, critical_failures, gps_verified, gardens(name, city), inspectors:inspector_id(full_name)")
      .order("created_at", { ascending: false }).limit(120);
    logSupabaseError("admin inspections overview", error);
    return { rows: (data ?? []) as InspectionRow[], queryError: error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { rows: [] as InspectionRow[], queryError: null as string | null });
  const rows = filterAdminInspections(result.data.rows, filters);
  const filtered = Boolean(filters.q || filters.status !== "all");

  return <DashboardShell role="admin" title="ביקורות">
    <div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Inspection Control</p><h1>כל ביקורות הפיקוח במערכת.</h1><p>סקירת סטטוס, ציון, פקח, GPS, ליקויים ודוחות להדפסה.</p></div><div className="actions"><Link className="button secondary" href="/dashboard/admin/inspections/due">בקרוב</Link><Link className="button secondary" href="/dashboard/admin/inspections/late">באיחור</Link><Link className="button primary" href="/dashboard/admin/inspection-forms">בונה טפסים</Link></div></div>
    <AdminDataError message={result.error ?? result.data.queryError} />
    <form className="filter-bar" method="get" action="/dashboard/admin/inspections" role="search">
      <label htmlFor="admin-inspection-search">חיפוש ב־120 הביקורות האחרונות</label>
      <input id="admin-inspection-search" name="q" type="search" maxLength={80} placeholder="גן, עיר או מפקח" defaultValue={filters.q} />
      <label htmlFor="admin-inspection-status">מצב ביקורת</label>
      <select id="admin-inspection-status" name="status" defaultValue={filters.status}>
        <option value="all">כל הסטטוסים</option><option value="open">פתוחה</option><option value="in_progress">בתהליך</option><option value="waiting_approval">ממתינה לאישור</option><option value="done">הושלמה</option><option value="overdue">באיחור</option><option value="rejected">נדחתה</option><option value="blocked">חסומה</option><option value="cancelled">בוטלה</option>
      </select>
      <button className="button primary" type="submit">סינון</button>
      {filtered && <Link className="button secondary" href="/dashboard/admin/inspections">ניקוי סינון</Link>}
    </form>
    <section className="dashboard-section" aria-live="polite">
      <p>מוצגות {rows.length} מתוך {result.data.rows.length} הביקורות האחרונות שנטענו.</p>
      {rows.length === 0 ? <div className="empty-state"><strong>{filtered ? "אין ביקורות שמתאימות לסינון" : "אין ביקורות במערכת"}</strong><span>{filtered ? "אפשר לשנות את החיפוש או לנקות את הסינון." : "ביקורות חודשיות או ביקורת ראשונה יופיעו כאן לאחר יצירת משימות פיקוח."}</span></div> : <div className="procedure-list">{rows.map((row) => <article className="card procedure-card" key={row.id}><div><span className={row.status === "done" ? "pill good" : "pill warn"}>{row.status}</span><h3>{row.gardens?.name ?? row.garden_id}</h3><p>{row.gardens?.city ?? ""} · פקח: {row.inspectors?.full_name ?? "-"}</p><small>ציון {row.weighted_score ?? "-"} · ליקויים {row.violation_count ?? 0} · GPS {row.gps_verified ? "אומת" : "לא אומת"}</small></div><div className="procedure-meta"><Link className="button secondary" href={`/dashboard/admin/inspections/${row.id}/report`}>דוח</Link><Link className="button" href={`/dashboard/admin/gardens/${row.garden_id}`}>פרופיל גן</Link></div></article>)}</div>}
    </section>
  </DashboardShell>;
}
