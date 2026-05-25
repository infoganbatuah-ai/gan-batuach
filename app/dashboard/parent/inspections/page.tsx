import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ParentInspectionsPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const { data } = await supabase.from("inspections" as any).select("id, completed_at, weighted_score, violation_count, status").eq("garden_id", profile.garden_id ?? "").eq("status", "done").order("completed_at", { ascending: false }).limit(20);
  return <DashboardShell role="parent" title="סיכום פיקוח"><div className="dashboard-hero-card parent-hero-card"><div><p className="eyebrow">Inspection Summary</p><h1>סיכום ביקורות מאושר להורים.</h1><p>הורים רואים רק דוחות המאושרים לגן של ילדיהם, לפי הרשאה.</p></div><span className="pill good">שקיפות לפי הרשאה</span></div><section className="dashboard-section">{(data ?? []).length === 0 ? <div className="empty-state"><strong>אין דוחות ביקורת להצגה</strong><span>לאחר ביקורת מאושרת, הציון והסיכום יופיעו כאן.</span></div> : <div className="procedure-list">{(data ?? []).map((inspection: any) => <article className="card procedure-card" key={inspection.id}><div><h3>ציון {inspection.weighted_score ?? "-"}</h3><p>ליקויים: {inspection.violation_count ?? 0}</p><small>{inspection.completed_at ? new Date(inspection.completed_at).toLocaleString("he-IL") : ""}</small></div><div className="procedure-meta"><Link className="button secondary" href={`/dashboard/parent/inspections/${inspection.id}/report`}>צפייה בדוח</Link></div></article>)}</div>}</section></DashboardShell>;
}
