import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const { data } = await supabase.from("required_inspections" as any).select("id, garden_id, due_at, status, countdown_day, gardens(name, city, address, last_inspection_score)").eq("inspector_id", profile.id).neq("status", "done").gte("due_at", new Date().toISOString()).order("due_at").limit(80);
  const rows = (data ?? []) as any[];
  return <DashboardShell role="inspector" title="פיקוחים קרובים"><div className="dashboard-hero-card"><div><p className="eyebrow">Due Inspections</p><h1>גנים המשויכים אליך שצריכים פיקוח בקרוב.</h1><p>כל שורה כוללת תאריך יעד, ציון אחרון ופעולה לפתיחת טופס פיקוח מודרך.</p></div><Link className="button primary" href="/dashboard/inspector/inspections">מילוי טופס פיקוח</Link></div><section className="filter-bar"><input placeholder="חיפוש גן / עיר" /><select><option>כל התאריכים</option><option>5 ימים</option><option>3 ימים</option><option>24 שעות</option></select></section><section className="dashboard-section">{rows.length === 0 ? <div className="empty-state"><strong>אין פיקוחים קרובים</strong><span>משימות פיקוח חודשיות בגנים שהוקצו לך יופיעו כאן לפי תאריך יעד.</span></div> : <div className="procedure-list">{rows.map((row) => { const days = Math.ceil((new Date(row.due_at).getTime() - Date.now()) / 86400000); return <article className="card procedure-card" key={row.id}><div><span className="pill warn">{days} ימים נותרו</span><h3>{row.gardens?.name ?? row.garden_id}</h3><p>{row.gardens?.city ?? ""} · {row.gardens?.address ?? ""}</p><small>ציון אחרון: {row.gardens?.last_inspection_score ?? "-"} · יעד: {new Date(row.due_at).toLocaleDateString("he-IL")}</small></div><Link className="button secondary" href="/dashboard/inspector/inspections">מילוי טופס</Link></article>; })}</div>}</section></DashboardShell>;
}
