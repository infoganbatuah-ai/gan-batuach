import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenInspectionsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const supabase = await createClient();
  const [gardenRes, inspectionsRes, violationsRes] = await Promise.all([
    supabase.from("gardens" as any).select("id, next_inspection_at, last_inspection_score, inspection_required_status, safe_status").eq("id", profile.garden_id ?? "").maybeSingle(),
    supabase.from("inspections" as any).select("id, completed_at, status, weighted_score, violation_count, inspectors:inspector_id(full_name)").eq("garden_id", profile.garden_id ?? "").order("created_at", { ascending: false }).limit(50),
    supabase.from("violations" as any).select("id, title, status, severity, due_at").eq("garden_id", profile.garden_id ?? "").neq("status", "done").limit(50)
  ]);
  const garden = gardenRes.data as any;
  const dueSoon = Boolean(garden?.next_inspection_at && Math.ceil((new Date(garden.next_inspection_at).getTime() - Date.now()) / 86400000) <= 5);
  const showDueOnly = params.filter === "due-soon";
  return <DashboardShell role="manager" title="פיקוח"><div className="dashboard-hero-card garden-hero-card"><div><p className="eyebrow">Inspection Status</p><h1>סטטוס פיקוח ודוחות ביקורת.</h1><p>ביקורת חודשית, ציון אחרון, דוחות, ליקויים ומשימות תיקון.</p></div><span className={garden?.safe_status === "safe" ? "pill good" : "pill warn"}>{garden?.safe_status ?? "pending"}</span></div><DashboardFilterChip label={showDueOnly ? "פיקוח קרוב" : null} clearHref="/dashboard/garden/inspections" isEmpty={showDueOnly && !dueSoon} emptyTitle="אין כרגע פיקוח קרוב" emptyText="לא נמצא מועד פיקוח בטווח הקרוב לגן הזה." /><section className="grid cols-3 dashboard-kpis"><div className="card stat-card">ציון אחרון <b>{garden?.last_inspection_score ?? "-"}</b></div><div className="card stat-card">ביקורת הבאה <b>{garden?.next_inspection_at ? new Date(garden.next_inspection_at).toLocaleDateString("he-IL") : "טרם"}</b></div><div className="card stat-card">ליקויים פתוחים <b>{violationsRes.data?.length ?? 0}</b></div></section><section className="grid cols-2 dashboard-panels"><article className="card action-panel"><h2>{showDueOnly ? "פיקוח קרוב" : "היסטוריית ביקורות"}</h2>{showDueOnly && !dueSoon ? <div className="empty-state"><strong>אין כרגע פיקוח קרוב</strong><span>כאשר מועד הפיקוח יתקרב, הוא יופיע כאן.</span></div> : (inspectionsRes.data ?? []).length === 0 ? <div className="empty-state"><strong>אין ביקורות עדיין</strong><span>לאחר ביקורת פקח, הדוח והציון יופיעו כאן.</span></div> : <div className="procedure-list">{(inspectionsRes.data ?? []).map((inspection: any) => <div className="list-item" key={inspection.id}><div><strong>ציון {inspection.weighted_score ?? "-"}</strong><span>{inspection.inspectors?.full_name ?? "פקח"} · {inspection.completed_at ? new Date(inspection.completed_at).toLocaleString("he-IL") : inspection.status}</span></div><Link className="button secondary" href={`/dashboard/garden/inspections/${inspection.id}/report`}>דוח</Link></div>)}</div>}</article><article className="card action-panel"><h2>ליקויים ותיקונים</h2>{(violationsRes.data ?? []).length === 0 ? <div className="empty-state"><strong>אין ליקויים פתוחים</strong><span>שאלות בציון 1-4 או כשל קריטי יופיעו כאן עם משימת תיקון.</span></div> : (violationsRes.data ?? []).map((v: any) => <div className="list-item" key={v.id}><div><strong>{v.title}</strong><span>{v.severity} · {v.due_at ? new Date(v.due_at).toLocaleDateString("he-IL") : ""}</span></div><span className="pill warn">{v.status}</span></div>)}</article></section></DashboardShell>;
}
