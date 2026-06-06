import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { PremiumDashboardHero } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin gardens alias", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("gardens" as any).select("id, name, city, address, safe_status, status, children_capacity, current_children_count, managers:manager_id(full_name), owners:owner_profile_id(full_name)").order("created_at", { ascending: false }).limit(120);
    logSupabaseError("admin gardens", error);
    return { rows: data ?? [], queryError: error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { rows: [] as any[], queryError: null as string | null });
  const rows = result.data.rows as any[];
  return <DashboardShell role="admin" title="גנים"><PremiumDashboardHero eyebrow="גנים" title="ספריית גנים נקייה." subtitle="סטטוס, מנהלת וכניסה לפרופיל מלא." actions={<div className="actions"><Link className="button primary" href="/dashboard/admin/leads">קליטת גן חדש</Link><Link className="button secondary" href="/dashboard/admin/kindergartens">ספרייה מורחבת</Link></div>} badge={`${rows.length} גנים`} badgeTone="good" /><AdminDataError message={result.error ?? result.data.queryError} /><section className="filter-bar"><input placeholder="חיפוש לפי שם גן / עיר" /><select><option>כל הסטטוסים</option><option>active</option><option>pending</option><option>blocked</option></select></section><section className="dashboard-section">{rows.length === 0 ? <div className="empty-state"><strong>אין גנים להצגה</strong><span>גן חדש יופיע כאן אחרי אישור וקליטה.</span></div> : <div className="procedure-list">{rows.map((garden) => <article className="card procedure-card" key={garden.id}><div><span className={garden.safe_status === "safe" ? "pill good" : "pill warn"}>{garden.safe_status ?? "pending"}</span><h3>{garden.name}</h3><p>{garden.city} · {garden.address ?? "ללא כתובת"}</p><small>מנהלת: {garden.managers?.full_name ?? "-"} · בעלים: {garden.owners?.full_name ?? "-"} · ילדים: {garden.current_children_count ?? 0}/{garden.children_capacity ?? 0}</small></div><div className="procedure-meta"><Link className="button secondary" href={`/dashboard/admin/gardens/${garden.id}`}>פרופיל גן</Link><Link className="button" href={`/dashboard/admin/users/new-kindergarten?gardenId=${garden.id}`}>עריכה</Link></div></article>)}</div>}</section></DashboardShell>;
}
