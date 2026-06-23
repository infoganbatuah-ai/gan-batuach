import { Fingerprint, MapPin, ShieldCheck, TimerReset } from "lucide-react";
import { StaffAttendanceActions } from "@/components/staff-attendance-actions";
import { ListRowCard, StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffEmpty, StaffMetricCard, StaffPageHero, StaffSection, StaffStats } from "@/components/staff-app-ui";
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
  if (value === "verified") return "success" as const;
  if (value === "probable") return "warning" as const;
  return "danger" as const;
}

export default async function Page() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const staffRes = await supabase.from("staff" as any).select("id, garden_id, full_name, gardens(name, address, gps_lat, gps_lng)").eq("profile_id", profile.id).maybeSingle();
  const staff = staffRes.data as any;
  if (!staff?.id || !staff?.garden_id) {
    return (
      <StaffAppFrame active="home" mode="candidate">
        <StaffPageHero
          eyebrow="נוכחות צוות"
          title="נוכחות תיפתח אחרי שיוך לגן"
          text="מערכת הנוכחות זמינה רק לעובדי צוות שאושרו ושויכו לגן פעיל."
          icon={Fingerprint}
          badge={<StatusChip tone="warning">ממתין לשיוך</StatusChip>}
        />
        <StaffSection title="אין פעולות נוכחות">
          <StaffEmpty title="עדיין לא שובצת לגן" text="לאחר אישור מנהלת, כניסה ויציאה מהעבודה יופיעו כאן." icon={Fingerprint} />
        </StaffSection>
      </StaffAppFrame>
    );
  }
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
    <StaffAppFrame active="shifts">
      <StaffPageHero
        eyebrow="נוכחות אוטומטית"
        title={openShift ? "המערכת מזהה שאת/ה בגן" : "הנוכחות תיפתח לבד כשתהיה/י בגן"}
        text="אחרי נוכחות רצופה באזור הגן, המשמרת נפתחת ונסגרת לפי דגימות מאומתות."
        icon={Fingerprint}
        badge={<StatusChip tone={openShift ? "success" : "warning"}>{openShift ? "משמרת פעילה" : "ממתין לדגימות"}</StatusChip>}
      />
      <StaffStats>
        <StaffMetricCard title="היום" value={openShift ? "במשמרת" : todayShift?.actual_end ? "הושלם" : "ממתין"} hint={todayShift?.actual_start ? `כניסה ${timeText(todayShift.actual_start)}` : "נדרשת נוכחות בגן"} icon={Fingerprint} tone={openShift || todayShift?.actual_end ? "green" : "orange"} />
        <StaffMetricCard title="השבוע" value={`${Math.round(weeklyMinutes / 60)} ש׳`} hint={`${weeklyMinutes % 60} דק׳`} icon={TimerReset} tone="purple" />
        <StaffMetricCard title="החודש" value={`${Math.round(monthlyMinutes / 60)} ש׳`} hint={`${monthlyMinutes % 60} דק׳`} icon={TimerReset} tone="blue" />
        <StaffMetricCard title="אימות" value={confidenceText(todayShift?.attendance_confidence)} hint={todayShift?.review_reason ?? "לפי GPS ודגימות חוזרות"} icon={ShieldCheck} tone={todayShift?.attendance_confidence === "verified" ? "green" : "orange"} />
      </StaffStats>
      <StaffSection title="פעולות נוכחות">
        <div className="staff-ops-grid">
          <StaffAttendanceActions staffId={staff?.id} gardenId={staff?.garden_id ?? profile.garden_id} hasOpenShift={Boolean(openShift)} />
          <ListRowCard title="מיקום הגן" subtitle={`${staff?.gardens?.name ?? "גן לא משויך"} · ${staff?.gardens?.address ?? "כתובת טרם הוגדרה"}`} meta={latestSample?.distance_meters != null ? `${Math.round(latestSample.distance_meters)} מטר מהגן` : "מרחק יחושב אחרי דגימת GPS"} avatar={<MapPin size={22} />} status={<StatusChip tone={latestSample?.inside_geofence ? "success" : "warning"}>{latestSample?.inside_geofence ? "בתחום הגן" : "מחכה לדגימה"}</StatusChip>} actions={null} />
          <ListRowCard title="שקיפות והוגנות" subtitle="דגימות מיקום נשמרות רק לצורך נוכחות, ובחריגה מתבצעת בדיקה." status={<StatusChip tone={anomalies.length ? "warning" : "success"}>{anomalies.length ? "דורש בדיקה" : "תקין"}</StatusChip>} actions={null} />
        </div>
      </StaffSection>
      <StaffSection title="מוכנות וחריגות">
        <div className="staff-task-list-ref">
          <ListRowCard title="ציון מוכנות צוות" subtitle={score?.explanation ?? "ציון המוכנות יחושב מנוכחות, מסמכים, הכשרה וציות."} meta={`מוכנות ${score?.readiness_score ?? "-"} · נוכחות ${score?.attendance_score ?? "-"}`} actions={null} />
          {anomalies.length ? anomalies.map((item) => <ListRowCard key={item.id} title={item.details ?? item.anomaly_type} subtitle={new Date(item.created_at).toLocaleString("he-IL")} status={<StatusChip tone={item.severity === "critical" || item.severity === "high" ? "danger" : "warning"}>{item.status}</StatusChip>} />) : <StaffEmpty title="אין חריגות פתוחות" text="המשמרת תקינה כרגע." icon={ShieldCheck} />}
        </div>
      </StaffSection>
      <StaffSection title="היסטוריית משמרות">
        {rows.length === 0 ? (
          <StaffEmpty title="אין עדיין משמרות" text="לאחר שהמערכת תזהה נוכחות רצופה בגן, המשמרת תופיע כאן." icon={Fingerprint} />
        ) : (
          <div className="staff-task-list-ref">
            {rows.map((row) => (
              <ListRowCard
                key={row.id}
                title={new Date(row.shift_date).toLocaleDateString("he-IL")}
                subtitle={`כניסה: ${timeText(row.actual_start)} · יציאה: ${timeText(row.actual_end)}`}
                meta={`סה״כ ${Math.round(Number(row.total_minutes ?? 0) / 60)} ש׳ ${Number(row.total_minutes ?? 0) % 60} דק׳`}
                status={<StatusChip tone={confidenceTone(row.attendance_confidence)}>{confidenceText(row.attendance_confidence)}</StatusChip>}
              />
            ))}
          </div>
        )}
      </StaffSection>
    </StaffAppFrame>
  );
}
