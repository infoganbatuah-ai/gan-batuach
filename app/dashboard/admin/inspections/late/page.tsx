import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin inspections late", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("required_inspections" as any).select("id, garden_id, inspector_id, due_at, status, gardens(name, city, last_inspection_score), inspectors:inspector_id(full_name)").lt("due_at", new Date().toISOString()).neq("status", "done").order("due_at");
    logSupabaseError("admin inspections late", error);
    return { rows: data ?? [], queryError: error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { rows: [] as any[], queryError: null as string | null });
  const rows = result.data.rows as any[];
  return <DashboardShell role="admin" title="פיקוח באיחור"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Late Inspections</p><h1>גנים שמאחרים בביצוע פיקוח.</h1><p>חריגים אדומים לפיקוח חודשי שלא בוצע בזמן, כולל נתיב לפרופיל גן ופעולת override בעמוד הטפסים.</p></div><Link className="button secondary" href="/dashboard/admin/inspection-forms">פעולות אדמין</Link></div><AdminDataError message={result.error ?? result.data.queryError} /><section className="filter-bar"><input placeholder="חיפוש גן / פקח" /><select><option>כל חומרות האיחור</option><option>1-3 ימים</option><option>4-7 ימים</option><option>מעל שבוע</option></select></section><section className="dashboard-section">{rows.length === 0 ? <div className="empty-state"><strong>אין פיקוחים באיחור</strong><span>גנים שמועד הפיקוח שלהם חלף יופיעו כאן באדום עם פעולות דרישה, ביטול או override מנומק.</span></div> : <div className="procedure-list">{rows.map((row) => { const days = Math.ceil((Date.now() - new Date(row.due_at).getTime()) / 86400000); return <article className="card procedure-card danger-card" key={row.id}><div><span className="pill bad">{days} ימים איחור</span><h3>{row.gardens?.name ?? row.garden_id}</h3><p>{row.gardens?.city ?? ""} · פקח: {row.inspectors?.full_name ?? "-"}</p><small>תאריך יעד: {new Date(row.due_at).toLocaleDateString("he-IL")} · ציון אחרון: {row.gardens?.last_inspection_score ?? "-"}</small></div><div className="procedure-meta"><Link className="button secondary" href="/dashboard/admin/inspection-forms">Override / ביטול</Link><Link className="button" href={`/dashboard/admin/gardens/${row.garden_id}`}>פרופיל גן</Link></div></article>; })}</div>}</section></DashboardShell>;
}
