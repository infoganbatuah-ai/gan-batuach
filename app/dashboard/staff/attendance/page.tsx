import { DashboardShell } from "@/components/dashboard-shell";
import { StaffAttendanceActions } from "@/components/staff-attendance-actions";
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
      <div className="parent-page-head staff-page-head"><div><p className="eyebrow">נוכחות חכמה</p><h1>{openShift ? "את/ה במשמרת." : "התחלת משמרת בלחיצה אחת."}</h1><p>המערכת מוכנה לנוכחות לפי מיקום הגן, משמרת ותיעוד GPS. אם המיקום לא זמין, לא נשמור החתמה לא מדויקת.</p></div><span className={openShift ? "pill good" : "pill warn"}>{openShift ? "נכנסת" : "ממתין לכניסה"}</span></div>
      <section className="grid cols-3 dashboard-panels">
        <StaffAttendanceActions staffId={staff?.id} gardenId={staff?.garden_id ?? profile.garden_id} hasOpenShift={Boolean(openShift)} />
        <article className="card action-panel"><h2>מיקום הגן</h2><p>{staff?.gardens?.name ?? "גן לא משויך"} · {staff?.gardens?.address ?? "כתובת טרם הוגדרה"}</p><span className="pill">מוכן לבדיקה</span></article>
        <article className="card action-panel"><h2>סטטוסים אפשריים</h2><p>נכנסת, יצאת, איחור או היעדרות. המנהלת רואה סיכום, לא צריך למלא טופס.</p><span className="pill warn">דורש הרשאת מיקום</span></article>
      </section>
      <section className="dashboard-section">
        <div className="section-heading"><h2>היסטוריית משמרות</h2><p>כניסות ויציאות אחרונות עם אימות מיקום.</p></div>
        {rows.length === 0 ? <div className="empty-state"><strong>אין עדיין החתמות</strong><span>לאחר כניסה או יציאה מהעבודה, המשמרת תופיע כאן עם נתוני GPS ושעות.</span></div> : <div className="procedure-list">{rows.map((row) => <article className="card procedure-card" key={row.id}><div><span className="pill">{row.status}</span><h3>{new Date(row.shift_date).toLocaleDateString("he-IL")}</h3><p>כניסה: {row.actual_start ? new Date(row.actual_start).toLocaleTimeString("he-IL") : row.planned_start ?? "-"} · יציאה: {row.actual_end ? new Date(row.actual_end).toLocaleTimeString("he-IL") : row.planned_end ?? "-"}</p></div><div className="procedure-meta"><span className={row.start_gps_verified ? "pill good" : "pill warn"}>כניסה GPS</span><span className={row.end_gps_verified ? "pill good" : "pill warn"}>יציאה GPS</span></div></article>)}</div>}
      </section>
    </DashboardShell>
  );
}
