import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { Avatar } from "@/components/avatar";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function InspectorDashboard() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const { data: inspections } = await supabase
    .from("inspections")
    .select("id, status, weighted_score, completed_at, violation_count, gardens(id, name, city, logo_url, safe_status)")
    .eq("inspector_id", profile.id)
    .limit(20);
  const { data: required } = await supabase
    .from("required_inspections" as any)
    .select("id, due_at, status, gardens(id, name, city, logo_url, safe_status)")
    .eq("inspector_id", profile.id)
    .neq("status", "done")
    .order("due_at", { ascending: true })
    .limit(12);
  const now = Date.now();

  return (
    <DashboardShell role="inspector" title="דשבורד פקח">
      <p className="eyebrow">פיקוח חודשי</p>
      <h1>ביקורות ומשימות פקח</h1>
      <div className="grid cols-3">
        <StatCard label="ביקורות פתוחות" value={(inspections ?? []).filter((item) => item.status !== "done").length} />
        <StatCard label="ביקורות שבוצעו" value={(inspections ?? []).filter((item) => item.status === "done").length} tone="good" />
        <StatCard label="ממוצע אחרון" value={String((inspections ?? [])[0]?.weighted_score ?? "-")} />
      </div>
      <section className="dashboard-section people-directory">
        <div className="section-heading"><h2>גנים שממתינים לפיקוח</h2><p>כל כרטיס מציג גן משויך בלבד, תאריך יעד, סטטוס סיכון ופעולת מילוי טופס.</p></div>
        {(required ?? []).length === 0 ? <div className="empty-state"><strong>אין ביקורות ממתינות</strong><span>כאשר תיפתח משימת פיקוח חודשית היא תופיע כאן עם תאריך יעד ברור.</span></div> : <div className="people-card-grid inspector-garden-grid">{(required ?? []).map((item: any) => {
          const dueAt = item.due_at ? new Date(item.due_at) : null;
          const days = dueAt ? Math.ceil((dueAt.getTime() - now) / 86400000) : null;
          return <article className="person-card inspector-garden-card" key={item.id}>
            <div className="person-card-top"><Avatar name={item.gardens?.name} src={item.gardens?.logo_url} size="lg" /><div><span className={days !== null && days < 0 ? "pill bad" : "pill warn"}>{days !== null && days < 0 ? `${Math.abs(days)} ימים באיחור` : `${days ?? "-"} ימים נותרו`}</span><h3>{item.gardens?.name ?? "גן משויך"}</h3><p>{item.gardens?.city ?? "עיר לא צוינה"} · {item.gardens?.safe_status ?? "סטטוס בבדיקה"}</p></div></div>
            <div className="mini-kpi-row"><span>יעד <b>{dueAt ? dueAt.toLocaleDateString("he-IL") : "-"}</b></span><span>סטטוס <b>{item.status}</b></span><span>GPS <b>נדרש</b></span></div>
            <div className="profile-actions"><a className="button primary tiny" href={`/dashboard/inspector/inspections?required=${item.id}`}>מילוי טופס פיקוח</a><a className="button secondary tiny" href="/dashboard/inspector/inspections/due">כל הביקורות</a></div>
          </article>;
        })}</div>}
      </section>
      <section className="dashboard-section people-directory">
        <div className="section-heading"><h2>היסטוריית ביקורות אחרונות</h2><p>ציון, ליקויים וסטטוס לכל גן שבוצע בו פיקוח על ידך.</p></div>
        {(inspections ?? []).length === 0 ? <div className="empty-state"><strong>אין היסטוריית ביקורות</strong><span>לאחר הגשת ביקורת חתומה, הדוח יופיע כאן.</span></div> : <div className="people-card-grid inspector-garden-grid">{(inspections ?? []).map((inspection: any) => <article className="person-card inspector-garden-card" key={inspection.id}>
          <div className="person-card-top"><Avatar name={inspection.gardens?.name} src={inspection.gardens?.logo_url} size="lg" /><div><span className={inspection.weighted_score >= 8 ? "pill good" : "pill bad"}>ציון {inspection.weighted_score ?? "-"}</span><h3>{inspection.gardens?.name ?? "גן"}</h3><p>{inspection.gardens?.city ?? "-"} · {inspection.completed_at ? new Date(inspection.completed_at).toLocaleDateString("he-IL") : "טיוטה"}</p></div></div>
          <div className="mini-kpi-row"><span>סטטוס <b>{inspection.status}</b></span><span>ליקויים <b>{inspection.violation_count ?? 0}</b></span><span>תקן <b>{inspection.weighted_score >= 8 ? "עומד" : "דורש תיקון"}</b></span></div>
          <div className="profile-actions"><a className="button secondary tiny" href={`/dashboard/inspector/inspections/history?inspection=${inspection.id}`}>צפייה בדוח</a><a className="button tiny" href="/dashboard/inspector/violations">ליקויים</a></div>
        </article>)}</div>}
      </section>
    </DashboardShell>
  );
}
