import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { ViolationStatusActions } from "@/components/violation-status-actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const gardensRes = await supabase.from("gardens" as any).select("id, name, city").eq("inspector_id", profile.id);
  const gardenIds = (gardensRes.data ?? []).map((garden: any) => garden.id);
  const violationsRes = gardenIds.length ? await supabase.from("violations" as any).select("id, garden_id, title, description, category, severity, score, status, correction_due_at, gardens(name, city)").in("garden_id", gardenIds).order("created_at", { ascending: false }).limit(80) : { data: [] };
  const rows = (violationsRes.data ?? []) as any[];
  const urgent = rows.filter((row) => row.severity === "critical" || row.severity === "high").length;
  return <DashboardShell role="inspector" title="ליקויים"><div className="dashboard-hero-card"><div><p className="eyebrow">תיקונים</p><h1>אישור, דחייה ומעקב אחרי ליקויים בגנים המשויכים.</h1><p>פקח רואה רק ליקויים של גנים שהוקצו לו, כולל ציון, חומרה, תאריך יעד והוכחות תיקון.</p></div><span className={urgent ? "pill bad" : "pill good"}>{urgent} דחופים</span></div><section className="dashboard-section">{rows.length === 0 ? <div className="empty-state"><strong>אין ליקויים פתוחים בגנים שלך</strong><span>שאלות פיקוח בציון 1-4 או כשל קריטי ייצרו כאן ליקוי ומשימת תיקון לאישור הפקח.</span></div> : <div className="procedure-list">{rows.map((row) => <article className="card procedure-card" key={row.id}><div><span className={row.severity === "critical" || row.severity === "high" ? "pill bad" : "pill warn"}>{row.severity}</span><h3>{row.title}</h3><p>{row.gardens?.name ?? "גן"} · {row.category ?? "ליקוי"} · ציון {row.score ?? "-"}</p><small>{row.correction_due_at ? `יעד תיקון: ${new Date(row.correction_due_at).toLocaleDateString("he-IL")}` : "לא הוגדר יעד תיקון"}</small></div><div className="procedure-meta"><ViolationStatusActions id={row.id} initialStatus={row.status ?? "open"} /><Link className="button secondary" href="/dashboard/inspector/tasks">פתיחת משימות</Link></div></article>)}</div>}</section></DashboardShell>;
}
