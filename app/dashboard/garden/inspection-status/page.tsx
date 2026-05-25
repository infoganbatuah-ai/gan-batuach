import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const [gardenRes, requiredRes, latestRes, violationsRes] = await Promise.all([
    supabase.from("gardens" as any).select("id, name, safe_status, last_inspection_score, next_inspection_at, inspection_required_status").eq("id", profile.garden_id ?? "").maybeSingle(),
    supabase.from("required_inspections" as any).select("id, due_at, status, countdown_day").eq("garden_id", profile.garden_id ?? "").neq("status", "done").order("due_at").limit(1).maybeSingle(),
    supabase.from("inspections" as any).select("id, completed_at, weighted_score, violation_count, status").eq("garden_id", profile.garden_id ?? "").eq("status", "done").order("completed_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("violations" as any).select("id, title, severity, status, correction_due_at").eq("garden_id", profile.garden_id ?? "").neq("status", "done").limit(20)
  ]);
  const garden = gardenRes.data as any;
  const required = requiredRes.data as any;
  const latest = latestRes.data as any;
  const violations = (violationsRes.data ?? []) as any[];
  const late = required?.due_at ? new Date(required.due_at).getTime() < Date.now() : false;
  return <DashboardShell role="manager" title="סטטוס פיקוח"><div className="dashboard-hero-card garden-hero-card"><div><p className="eyebrow">Inspection Status</p><h1>מצב הפיקוח של {garden?.name ?? "הגן"}.</h1><p>תאריך הפיקוח הבא, איחורים, ציון אחרון, דוח אחרון וליקויים פתוחים לתיקון.</p></div><span className={late ? "pill bad" : garden?.safe_status === "safe" ? "pill good" : "pill warn"}>{late ? "פיקוח באיחור" : garden?.safe_status ?? "pending"}</span></div><section className="grid cols-4 dashboard-kpis"><div className="card stat-card">פיקוח הבא <b>{required?.due_at ? new Date(required.due_at).toLocaleDateString("he-IL") : garden?.next_inspection_at ? new Date(garden.next_inspection_at).toLocaleDateString("he-IL") : "טרם"}</b></div><div className="card stat-card">ציון אחרון <b>{latest?.weighted_score ?? garden?.last_inspection_score ?? "-"}</b></div><div className="card stat-card">ליקויים פתוחים <b>{violations.length}</b></div><div className="card stat-card">סטטוס דרישה <b>{required?.status ?? garden?.inspection_required_status ?? "-"}</b></div></section><section className="grid cols-2 dashboard-panels"><article className="card action-panel"><h2>דוח אחרון</h2>{latest ? <div className="list-item"><div><strong>ציון {latest.weighted_score ?? "-"}</strong><span>{latest.completed_at ? new Date(latest.completed_at).toLocaleString("he-IL") : ""} · ליקויים {latest.violation_count ?? 0}</span></div><Link className="button secondary" href={`/dashboard/garden/inspections/${latest.id}/report`}>פתיחת דוח</Link></div> : <div className="empty-state"><strong>עדיין אין ביקורת מאושרת</strong><span>לאחר ביקורת ראשונה של פקח יופיע כאן דוח מלא.</span></div>}</article><article className="card action-panel"><h2>פעולות נדרשות</h2>{violations.length === 0 ? <div className="empty-mini">אין ליקויים פתוחים.</div> : violations.map((row) => <div className="list-item" key={row.id}><div><strong>{row.title}</strong><span>{row.severity} · יעד {row.correction_due_at ? new Date(row.correction_due_at).toLocaleDateString("he-IL") : "לא הוגדר"}</span></div><span className="pill warn">{row.status}</span></div>)}</article></section></DashboardShell>;
}
