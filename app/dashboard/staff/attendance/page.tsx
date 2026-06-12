import { DashboardShell } from "@/components/dashboard-shell";
import { StaffAttendanceActions } from "@/components/staff-attendance-actions";
import { RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function timeText(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "-";
}

function confidenceText(value?: string | null) {
  if (value === "verified") return "מאומת";
  if (value === "probable") return "סביר";
  return "דורש בדיקה";
}

function confidenceTone(value?: string | null) {
  if (value === "verified") return "good" as const;
  if (value === "probable") return "warn" as const;
  return "bad" as const;
}

export default async function Page() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const staffRes = await supabase.from("staff" as any).select("id, garden_id, full_name, gardens(name, address, gps_lat, gps_lng)").eq("profile_id", profile.id).maybeSingle();
  const staff = staffRes.data as any;
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartText = monthStart.toISOString().slice(0, 10);
  const [shiftsRes, samplesRes, anomaliesRes, scoreRes] = await Promise.all([
    staff?.id ? supabase.from("staff_shifts" as any).select("id, shift_date, planned_start, planned_end, actual_start, actual_end, start_gps_verified, end_gps_verified, status, attendance_confidence, confidence_score, total_minutes, overtime_minutes, auto_started, auto_closed, review_reason").eq("staff_id", staff.id).order("shift_date", { ascending: false }).limit(45) : Promise.resolve({ data: [] }),
    staff?.id ? supabase.from("staff_location_samples" as any).select("id, inside_geofence, distance_meters, gps_accuracy_meters, captured_at").eq("staff_id", staff.id).order("captured_at", { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    staff?.id ? supabase.from("staff_workforce_anomalies" as any).select("id, anomaly_type, severity, status, details, created_at").eq("staff_id", staff.id).in("status", ["requires_review", "reviewing"]).order("created_at", { ascending: false }).limit(6) : Promise.resolve({ data: [] }),
    staff?.id ? supabase.from("staff_workforce_scores" as any).select("*").eq("staff_id", staff.id).order("score_date", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null })
  ]);
  const rows = (shiftsRes.data ?? []) as any[];
  const openShift = rows.find((row) => row.actual_start && !row.actual_end);
  const todayShift = rows.find((row) => row.shift_date === new Date().toISOString().slice(0, 10)) ?? openShift;
  const monthlyMinutes = rows.filter((row) => String(row.shift_date) >= monthStartText).reduce((sum, row) => sum + Number(row.total_minutes ?? (row.actual_start && row.actual_end ? Math.round((new Date(row.actual_end).getTime() - new Date(row.actual_start).getTime()) / 60000) : 0)), 0);
  const weeklyMinutes = rows.filter((row) => new Date(row.shift_date).getTime() >= Date.now() - 7 * 86400000).reduce((sum, row) => sum + Number(row.total_minutes ?? 0), 0);
  const latestSample = ((samplesRes.data ?? []) as any[])[0];
  const anomalies = (anomaliesRes.data ?? []) as any[];
  const score = scoreRes.data as any;
  return (
    <DashboardShell role="staff" title="נוכחות צוות">
      <div className="parent-page-head staff-page-head"><div><p className="eyebrow">נוכחות אוטומטית</p><h1>{openShift ? "המערכת מזהה שאת/ה בגן." : "הנוכחות תיפתח לבד כשתהיה/י בגן."}</h1><p>לא צריך להחתים ידנית. אחרי 30 דקות של נוכחות רצופה באזור הגן, המשמרת נפתחת מהזמן שבו נכנסת. אחרי 30 דקות מחוץ לגן, היא נסגרת מהזמן שבו יצאת.</p></div><span className={openShift ? "pill good" : "pill warn"}>{openShift ? "משמרת פעילה" : "ממתין לדגימות"}</span></div>
      <section className="staff-attendance-kpis">
        <RoleMetricCard label="היום" value={openShift ? "במשמרת" : todayShift?.actual_end ? "הושלם" : "ממתין"} hint={todayShift?.actual_start ? `כניסה ${timeText(todayShift.actual_start)}` : "נדרשת נוכחות בגן"} tone={openShift || todayShift?.actual_end ? "good" : "warn"} />
        <RoleMetricCard label="השבוע" value={`${Math.round(weeklyMinutes / 60)} ש׳`} hint={`${weeklyMinutes % 60} דק׳`} tone="default" />
        <RoleMetricCard label="החודש" value={`${Math.round(monthlyMinutes / 60)} ש׳`} hint={`${monthlyMinutes % 60} דק׳`} tone="default" />
        <RoleMetricCard label="אימות" value={confidenceText(todayShift?.attendance_confidence)} hint={todayShift?.review_reason ?? "לפי GPS ודגימות חוזרות"} tone={confidenceTone(todayShift?.attendance_confidence)} />
      </section>
      <section className="grid cols-3 dashboard-panels">
        <StaffAttendanceActions staffId={staff?.id} gardenId={staff?.garden_id ?? profile.garden_id} hasOpenShift={Boolean(openShift)} />
        <article className="card action-panel"><h2>מיקום הגן</h2><p>{staff?.gardens?.name ?? "גן לא משויך"} · {staff?.gardens?.address ?? "כתובת טרם הוגדרה"}</p><span className={latestSample?.inside_geofence ? "pill good" : "pill warn"}>{latestSample?.inside_geofence ? "בתחום הגן" : "מחכה לדגימה"}</span><small>{latestSample?.distance_meters != null ? `${Math.round(latestSample.distance_meters)} מטר מהגן` : "מרחק יחושב אחרי דגימת GPS"}</small></article>
        <article className="card action-panel"><h2>שקיפות והוגנות</h2><p>המערכת שומרת דגימות מיקום רק לצורך נוכחות. אם הדיוק נמוך או יש חריגה, המנהלת בודקת לפני החלטה.</p><span className={anomalies.length ? "pill warn" : "pill good"}>{anomalies.length ? "דורש בדיקה" : "תקין"}</span></article>
      </section>
      <section className="staff-workforce-panels">
        <article className="card action-panel">
          <h2>ציון מוכנות צוות</h2>
          <p>{score?.explanation ?? "ציון המוכנות יחושב מנוכחות, מסמכים, הכשרה וציות."}</p>
          <div className="parent-trust-list">
            <span>מוכנות <b>{score?.readiness_score ?? "-"}</b></span>
            <span>נוכחות <b>{score?.attendance_score ?? "-"}</b></span>
            <span>מסמכים <b>{score?.document_score ?? "-"}</b></span>
            <span>ציות <b>{score?.compliance_score ?? "-"}</b></span>
          </div>
        </article>
        <article className="card action-panel">
          <h2>חריגות לבדיקה</h2>
          {anomalies.length ? anomalies.map((item) => <div className="list-item" key={item.id}><div><strong>{item.details ?? item.anomaly_type}</strong><span>{new Date(item.created_at).toLocaleString("he-IL")}</span></div><StatusBadge tone={item.severity === "critical" || item.severity === "high" ? "bad" : "warn"}>{item.status}</StatusBadge></div>) : <div className="empty-mini">אין חריגות פתוחות.</div>}
        </article>
      </section>
      <section className="dashboard-section">
        <div className="section-heading"><h2>היסטוריית משמרות</h2><p>כניסות ויציאות אוטומטיות עם אימות מיקום וביטחון.</p></div>
        {rows.length === 0 ? <div className="empty-state"><strong>אין עדיין משמרות</strong><span>לאחר שהמערכת תזהה נוכחות רצופה בגן, המשמרת תופיע כאן.</span></div> : <div className="procedure-list">{rows.map((row) => <article className="card procedure-card" key={row.id}><div><span className="pill">{row.status}</span><h3>{new Date(row.shift_date).toLocaleDateString("he-IL")}</h3><p>כניסה: {timeText(row.actual_start)} · יציאה: {timeText(row.actual_end)} · סה״כ {Math.round(Number(row.total_minutes ?? 0) / 60)} ש׳ {Number(row.total_minutes ?? 0) % 60} דק׳</p></div><div className="procedure-meta"><StatusBadge tone={confidenceTone(row.attendance_confidence)}>{confidenceText(row.attendance_confidence)}</StatusBadge><span className={row.auto_started ? "pill good" : "pill warn"}>פתיחה אוטומטית</span><span className={row.auto_closed ? "pill good" : "pill warn"}>סגירה אוטומטית</span></div></article>)}</div>}
      </section>
    </DashboardShell>
  );
}
