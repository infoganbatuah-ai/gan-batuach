import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  await requireRole(["admin"]);
  const result = await safeAdminData("camera permissions", async () => {
    const supabase = await createClient();
    const { data, error } = await supabase.from("parent_camera_permissions" as any).select("id, garden_id, allowed, valid_from, valid_until, reason, parents(full_name, phone), camera_streams(name, area, status), gardens(name, city)").order("created_at", { ascending: false }).limit(80);
    logSupabaseError("camera permissions", error);
    return { rows: data ?? [], queryError: error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { rows: [] as any[], queryError: null as string | null });
  const rows = result.data.rows as any[];
  return <DashboardShell role="admin" title="הרשאות מצלמה"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Camera Permissions</p><h1>הרשאות צפיית הורים במצלמות.</h1><p>ניהול שקוף של מי מורשה לצפות באיזו מצלמה, לאיזה גן, באיזה תוקף ובאיזה סטטוס Gateway.</p></div><Link className="button primary" href="/dashboard/admin/cameras">ניהול מצלמות</Link></div><AdminDataError message={result.error ?? result.data.queryError} /><section className="filter-bar"><input placeholder="חיפוש הורה / גן / מצלמה" /><select><option>כל הסטטוסים</option><option>מורשה</option><option>חסום</option><option>פג תוקף</option></select></section><section className="dashboard-section">{rows.length === 0 ? <div className="empty-state"><strong>אין הרשאות מצלמה עדיין</strong><span>לאחר שמנהלת או אדמין יגדירו צפיית הורים במצלמה, הרשאות התוקף והסיבה יוצגו כאן.</span><Link className="button secondary" href="/dashboard/admin/cameras">הוספת מצלמה והרשאות</Link></div> : <div className="procedure-list">{rows.map((row) => <article className="card procedure-card" key={row.id}><div><span className={row.allowed ? "pill good" : "pill bad"}>{row.allowed ? "מורשה" : "חסום"}</span><h3>{row.parents?.full_name ?? "הורה"} · {row.camera_streams?.name ?? "מצלמה"}</h3><p>{row.gardens?.name ?? "גן"} · {row.camera_streams?.area ?? "אזור"} · {row.reason ?? "ללא הערה"}</p><small>תוקף: {row.valid_until ? new Date(row.valid_until).toLocaleDateString("he-IL") : "ללא תאריך סיום"}</small></div><div className="procedure-meta"><span className={row.camera_streams?.status === "connected" ? "pill good" : "pill warn"}>{row.camera_streams?.status ?? "pending_gateway"}</span><Link className="button secondary" href={`/dashboard/admin/gardens/${row.garden_id}`}>פרופיל גן</Link></div></article>)}</div>}</section></DashboardShell>;
}
