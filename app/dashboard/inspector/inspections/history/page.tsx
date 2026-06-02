import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const { data } = await supabase.from("inspections" as any).select("id, garden_id, completed_at, status, weighted_score, violation_count, critical_failures, gps_verified, gardens(name, city)").eq("inspector_id", profile.id).order("completed_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as any[];
  return <DashboardShell role="inspector" title="היסטוריית פיקוח"><div className="dashboard-hero-card"><div><p className="eyebrow">Inspection History</p><h1>כל הביקורות שביצעת.</h1><p>היסטוריית ביקורות לפי גן, ציון, ליקויים, חתימה ו-GPS.</p></div><span className="pill good">{rows.length} דוחות</span></div><section className="filter-bar"><input placeholder="חיפוש גן" /><select><option>כל הציונים</option><option>מתחת 8</option><option>8 ומעלה</option></select></section><section className="dashboard-section">{rows.length === 0 ? <div className="empty-state"><strong>אין היסטוריית ביקורות</strong><span>לאחר שליחת טופס פיקוח חתום, הדוח יופיע כאן.</span></div> : <div className="procedure-list">{rows.map((row) => <article className="card procedure-card" key={row.id}><div><span className={Number(row.weighted_score ?? 0) >= 8 ? "pill good" : "pill bad"}>ציון {row.weighted_score ?? "-"}</span><h3>{row.gardens?.name ?? row.garden_id}</h3><p>{row.gardens?.city ?? ""} · {row.completed_at ? new Date(row.completed_at).toLocaleString("he-IL") : row.status}</p><small>ליקויים: {row.violation_count ?? 0} · קריטיים: {row.critical_failures ?? 0} · GPS {row.gps_verified ? "אומת" : "לא אומת"}</small></div><div className="procedure-meta"><span className="pill">{row.status}</span><a className="button secondary" href={`/api/inspections/${row.id}/report`}>פתיחת דוח</a><a className="button tiny" href={`/api/inspections/${row.id}/report?download=1`}>הורדה</a></div></article>)}</div>}</section></DashboardShell>;
}
