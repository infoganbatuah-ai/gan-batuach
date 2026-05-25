import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function hours(start?: string | null, end?: string | null) {
  if (!start || !end) return 0;
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 36e5);
}

export default async function Page() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const staffRes = await supabase.from("staff" as any).select("id, full_name").eq("profile_id", profile.id).maybeSingle();
  const staff = staffRes.data as any;
  const shiftsRes = staff?.id ? await supabase.from("staff_shifts" as any).select("id, shift_date, planned_start, planned_end, actual_start, actual_end, status").eq("staff_id", staff.id).order("shift_date", { ascending: false }).limit(60) : { data: [] };
  const rows = (shiftsRes.data ?? []) as any[];
  const monthHours = rows.reduce((sum, row) => sum + hours(row.actual_start, row.actual_end), 0);
  const lateCount = rows.filter((row) => row.status === "late").length;
  return <DashboardShell role="staff" title="שעות חודשיות"><div className="dashboard-hero-card staff-hero-card"><div><p className="eyebrow">דוחות שעות</p><h1>שעות עבודה, איחורים וחוסרים.</h1><p>הדוח מציג משמרות בפועל מול תכנון, ומאפשר למנהלת לראות חוסרים או חריגות.</p></div><span className="pill good">{monthHours.toFixed(1)} שעות</span></div><section className="grid cols-3 dashboard-kpis"><div className="card stat-card">שעות מחושבות <b>{monthHours.toFixed(1)}</b></div><div className="card stat-card">משמרות <b>{rows.length}</b></div><div className="card stat-card">איחורים <b>{lateCount}</b></div></section><section className="dashboard-section">{rows.length === 0 ? <div className="empty-state"><strong>אין משמרות להצגה</strong><span>לאחר שהמנהלת תגדיר משמרות או שתבוצע החתמה, שעות העבודה יופיעו כאן.</span></div> : <div className="procedure-list">{rows.map((row) => <article className="card procedure-card" key={row.id}><div><span className="pill">{row.status}</span><h3>{new Date(row.shift_date).toLocaleDateString("he-IL")}</h3><p>מתוכנן {row.planned_start ?? "-"}-{row.planned_end ?? "-"} · בפועל {row.actual_start ? new Date(row.actual_start).toLocaleTimeString("he-IL") : "-"}-{row.actual_end ? new Date(row.actual_end).toLocaleTimeString("he-IL") : "-"}</p></div><span className="pill">{hours(row.actual_start, row.actual_end).toFixed(1)} שעות</span></article>)}</div>}</section></DashboardShell>;
}
