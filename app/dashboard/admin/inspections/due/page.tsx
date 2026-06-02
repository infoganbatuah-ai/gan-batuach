import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin inspections due", async () => {
    const supabase = await createClient();
    const now = new Date();
    const soon = new Date(Date.now() + 5 * 86400000);
    const { data, error } = await supabase.from("required_inspections" as any).select("id, garden_id, inspector_id, due_at, status, countdown_day, gardens(name, city, last_inspection_score), inspectors:inspector_id(full_name)").gte("due_at", now.toISOString()).lte("due_at", soon.toISOString()).order("due_at");
    logSupabaseError("admin inspections due", error);
    return { rows: data ?? [], queryError: error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { rows: [] as any[], queryError: null as string | null });
  const rows = result.data.rows as any[];
  return <DashboardShell role="admin" title="פיקוח בקרוב"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Due Soon</p><h1>גנים שצריכים לבצע פיקוח בקרוב.</h1><p>טבלת ספירה לאחור לחמשת הימים לפני מועד הפיקוח החודשי.</p></div><Link className="button secondary" href="/dashboard/admin/inspections">כל הביקורות</Link></div><AdminDataError message={result.error ?? result.data.queryError} /><section className="filter-bar"><input placeholder="חיפוש גן / עיר / פקח" /><select><option>כל הפקחים</option></select></section><section className="dashboard-section">{rows.length === 0 ? <div className="empty-state"><strong>אין פיקוחים קרובים</strong><span>כאשר גן ייכנס לחלון חמשת הימים לפני פיקוח, הוא יוצג כאן עם פעולות תזכורת.</span></div> : <div className="procedure-list">{rows.map((row) => { const days = Math.ceil((new Date(row.due_at).getTime() - Date.now()) / 86400000); return <article className="card procedure-card" key={row.id}><div><span className="pill warn">{days} ימים נותרו</span><h3>{row.gardens?.name ?? row.garden_id}</h3><p>{row.gardens?.city ?? ""} · פקח: {row.inspectors?.full_name ?? "-"}</p><small>תאריך יעד: {new Date(row.due_at).toLocaleDateString("he-IL")} · ציון אחרון: {row.gardens?.last_inspection_score ?? "-"}</small></div><div className="procedure-meta"><Link className="button secondary" href="/dashboard/admin/inspection-forms">דרישת פיקוח</Link><Link className="button" href={`/dashboard/admin/gardens/${row.garden_id}`}>פרופיל גן</Link></div></article>; })}</div>}</section></DashboardShell>;
}
