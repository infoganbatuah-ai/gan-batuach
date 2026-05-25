import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const staffRes = await supabase.from("staff" as any).select("id, garden_id, full_name, gardens(name, address, gps_lat, gps_lng)").eq("profile_id", profile.id).maybeSingle();
  const staff = staffRes.data as any;
  const shiftsRes = staff?.id ? await supabase.from("staff_shifts" as any).select("id, shift_date, planned_start, planned_end, actual_start, actual_end, start_gps_verified, end_gps_verified, status").eq("staff_id", staff.id).order("shift_date", { ascending: false }).limit(30) : { data: [] };
  const rows = (shiftsRes.data ?? []) as any[];
  const openShift = rows.find((row) => row.actual_start && !row.actual_end);
  return (
    <DashboardShell role="staff" title="נוכחות צוות">
      <div className="dashboard-hero-card staff-hero-card"><div><p className="eyebrow">GPS Attendance</p><h1>כניסה ויציאה מהעבודה עם אימות מיקום.</h1><p>כל החתמה נשמרת עם שעה, מיקום, מרחק מהגן וסטטוס אימות כדי לשמור על תיעוד עבודה תקין.</p></div><span className={openShift ? "pill good" : "pill warn"}>{openShift ? "משמרת פתוחה" : "אין משמרת פתוחה"}</span></div>
      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel"><h2>כניסה לעבודה</h2><p>בעת החיבור ל-GPS המערכת תבדוק את המרחק מכתובת הגן.</p><span className="pill good">מוכן לחיבור רכיב החתמה</span></article>
        <article className="card action-panel"><h2>יציאה מהעבודה</h2><p>סגירת משמרת מתבצעת עם זמן ומיקום, ומופיעה בדוח החודשי.</p><span className="pill warn">דורש הרשאת מיקום בדפדפן</span></article>
        <article className="card action-panel"><h2>כתובת אימות</h2><p>{staff?.gardens?.name ?? "גן לא משויך"} · {staff?.gardens?.address ?? "כתובת טרם הוגדרה"}</p><span className="pill">GPS מוכן</span></article>
      </section>
      <section className="dashboard-section">
        <div className="section-heading"><h2>היסטוריית החתמות</h2><p>רשימת כניסות ויציאות אחרונות, כולל אימות GPS וסטטוס חריגות.</p></div>
        {rows.length === 0 ? <div className="empty-state"><strong>אין עדיין החתמות</strong><span>לאחר כניסה או יציאה מהעבודה, המשמרת תופיע כאן עם נתוני GPS ושעות.</span></div> : <div className="procedure-list">{rows.map((row) => <article className="card procedure-card" key={row.id}><div><span className="pill">{row.status}</span><h3>{new Date(row.shift_date).toLocaleDateString("he-IL")}</h3><p>כניסה: {row.actual_start ? new Date(row.actual_start).toLocaleTimeString("he-IL") : row.planned_start ?? "-"} · יציאה: {row.actual_end ? new Date(row.actual_end).toLocaleTimeString("he-IL") : row.planned_end ?? "-"}</p></div><div className="procedure-meta"><span className={row.start_gps_verified ? "pill good" : "pill warn"}>כניסה GPS</span><span className={row.end_gps_verified ? "pill good" : "pill warn"}>יציאה GPS</span></div></article>)}</div>}
      </section>
    </DashboardShell>
  );
}
