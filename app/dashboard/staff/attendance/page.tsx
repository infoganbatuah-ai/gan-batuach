import Link from "next/link";
import { Fingerprint, MapPin, ShieldCheck, TimerReset, UsersRound } from "lucide-react";
import { israelTodayDateKey } from "@/lib/domain/israel-date";
import { formatStaffMinutes, staffRowsRead, staffShiftTimeLabel, staffSingleRead, summarizeStaffPeriod, type StaffShiftSummaryRow } from "@/lib/domain/staff-attendance-summary";
import { StaffAttendanceActions } from "@/components/staff-attendance-actions";
import { ListRowCard, StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffEmpty, StaffMetricCard, StaffPageHero, StaffSection, StaffStats } from "@/components/staff-app-ui";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";

type StaffRecord = { id: string; garden_id: string; gardens: { name?: string | null; address?: string | null } | null };
type StaffShiftRow = StaffShiftSummaryRow & { id: string; shift_date: string; status?: string | null; attendance_confidence?: string | null; review_reason?: string | null };
type StaffSample = { id: string; distance_meters?: number | null; inside_geofence?: boolean | null };
type StaffAnomaly = { id: string; details?: string | null; anomaly_type: string; severity?: string | null; status: string; created_at: string };
type StaffScore = { explanation?: string | null; readiness_score?: number | null; attendance_score?: number | null };

function timeText(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }) : "-";
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
  const { employment } = await requireOperationalRole(["staff"]);
  const supabase = await createClient();
  const staffRes = await supabase.from("staff" as never).select("id, garden_id, full_name, gardens(name, address, gps_lat, gps_lng)" as never).eq("id", employment!.staff_id).eq("garden_id", employment!.garden_id).maybeSingle();
  const staffRead = staffSingleRead(staffRes);
  if (staffRead.state === "unavailable") {
    return (
      <StaffAppFrame active="shifts">
        <StaffPageHero eyebrow="נוכחות צוות" title="נתוני הנוכחות אינם זמינים כרגע" text="לא ניתן לאמת את השיוך והמשמרת. רעננו את המסך ונסו שוב." icon={Fingerprint} badge={<StatusChip tone="warning">לא זמין</StatusChip>} />
        <StaffSection title="פעולות נוכחות"><StaffEmpty title="לא ניתן לטעון נתוני צוות" text="הפעולות יופיעו אחרי אימות השיוך והמשמרת." icon={Fingerprint} /></StaffSection>
      </StaffAppFrame>
    );
  }
  const staff = staffRead.value as StaffRecord | null;
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
  const [shiftsRes, samplesRes, anomaliesRes, scoreRes] = await Promise.all([
    staff?.id ? supabase.from("staff_shifts" as never).select("id, shift_date, planned_start, planned_end, actual_start, actual_end, start_gps_verified, end_gps_verified, status, attendance_confidence, confidence_score, total_minutes, overtime_minutes, auto_started, auto_closed, review_reason" as never).eq("staff_id", staff.id).eq("garden_id", employment!.garden_id).order("shift_date", { ascending: false }).limit(45) : Promise.resolve({ data: [] }),
    staff?.id ? supabase.from("staff_location_samples" as never).select("id, inside_geofence, distance_meters, gps_accuracy_meters, captured_at" as never).eq("staff_id", staff.id).eq("garden_id", employment!.garden_id).order("captured_at", { ascending: false }).limit(8) : Promise.resolve({ data: [] }),
    staff?.id ? supabase.from("staff_workforce_anomalies" as never).select("id, anomaly_type, severity, status, details, created_at" as never).eq("staff_id", staff.id).eq("garden_id", employment!.garden_id).in("status", ["requires_review", "reviewing"]).order("created_at", { ascending: false }).limit(6) : Promise.resolve({ data: [] }),
    staff?.id ? supabase.from("staff_workforce_scores" as never).select("*" as never).eq("staff_id", staff.id).eq("garden_id", employment!.garden_id).order("score_date", { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null })
  ]);
  const shiftsRead = staffRowsRead(shiftsRes);
  const samplesRead = staffRowsRead(samplesRes);
  const anomaliesRead = staffRowsRead(anomaliesRes);
  const scoreRead = staffSingleRead(scoreRes);
  const rows = shiftsRead.rows as StaffShiftRow[];
  const openShift = rows.find((row) => row.actual_start && !row.actual_end);
  const todayKey = israelTodayDateKey();
  const todayShift = rows.find((row) => row.shift_date === todayKey) ?? openShift;
  const monthly = shiftsRead.state === "available" ? summarizeStaffPeriod(rows, "month", todayKey) : { minutes: 0, state: "unavailable" as const };
  const weekly = shiftsRead.state === "available" ? summarizeStaffPeriod(rows, "lastSevenDays", todayKey) : { minutes: 0, state: "unavailable" as const };
  const latestSample = (samplesRead.rows as StaffSample[])[0];
  const anomalies = anomaliesRead.rows as StaffAnomaly[];
  const score = scoreRead.value as StaffScore | null;
  const weeklyText = formatStaffMinutes(weekly.minutes);
  const monthlyText = formatStaffMinutes(monthly.minutes);
  const periodHint = (state: typeof weekly.state, text: string) => state === "unavailable" ? "נתוני שעות דורשים בדיקה" : state === "partial" ? `נתון חלקי · ${text}` : text;
  return (
    <StaffAppFrame active="shifts">
      <StaffPageHero
        eyebrow="נוכחות אוטומטית"
        title={shiftsRead.state === "unavailable" ? "נתוני המשמרת אינם זמינים כרגע" : openShift ? "המערכת מזהה שאת/ה בגן" : "הנוכחות תיפתח לבד כשתהיה/י בגן"}
        text="אחרי נוכחות רצופה באזור הגן, המשמרת נפתחת ונסגרת לפי דגימות מאומתות."
        icon={Fingerprint}
        badge={<StatusChip tone={openShift ? "success" : "warning"}>{shiftsRead.state === "unavailable" ? "לא זמין" : openShift ? "משמרת פעילה" : "ממתין לדגימות"}</StatusChip>}
      />
      <StaffStats>
        <StaffMetricCard title="היום" value={shiftsRead.state === "unavailable" ? "לא זמין" : openShift ? "במשמרת" : todayShift?.actual_end ? "הושלם" : "ממתין"} hint={shiftsRead.state === "unavailable" ? "לא ניתן לאמת מצב משמרת" : todayShift?.actual_start ? `כניסה ${timeText(todayShift.actual_start)}` : "נדרשת נוכחות בגן"} icon={Fingerprint} tone={openShift || todayShift?.actual_end ? "green" : "orange"} />
        <StaffMetricCard title="7 הימים האחרונים" value={weekly.state === "unavailable" ? "לא זמין" : weeklyText!.hours} hint={periodHint(weekly.state, weeklyText!.remainder)} icon={TimerReset} tone="purple" />
        <StaffMetricCard title="החודש" value={monthly.state === "unavailable" ? "לא זמין" : monthlyText!.hours} hint={periodHint(monthly.state, monthlyText!.remainder)} icon={TimerReset} tone="blue" />
        <StaffMetricCard title="אימות" value={shiftsRead.state === "unavailable" ? "לא זמין" : todayShift ? confidenceText(todayShift.attendance_confidence) : "אין משמרת היום"} hint={shiftsRead.state === "unavailable" ? "לא ניתן לאמת משמרת" : todayShift?.review_reason ?? "לפי GPS ודגימות חוזרות"} icon={ShieldCheck} tone={todayShift?.attendance_confidence === "verified" ? "green" : "orange"} />
      </StaffStats>
      <StaffSection title="פעולות נוכחות">
        <div className="staff-ops-grid">
          {shiftsRead.state === "available" ? <StaffAttendanceActions staffId={staff?.id} gardenId={employment!.garden_id} hasOpenShift={Boolean(openShift)} /> : <StaffEmpty title="פעולות הנוכחות מושהות" text="לא ניתן לאמת אם יש משמרת פתוחה. רעננו את המסך לפני פעולה נוספת." icon={Fingerprint} />}
          <ListRowCard title="מיקום הגן" subtitle={`${staff?.gardens?.name ?? "גן לא משויך"} · ${staff?.gardens?.address ?? "כתובת טרם הוגדרה"}`} meta={samplesRead.state === "unavailable" ? "דגימות מיקום אינן זמינות" : latestSample?.distance_meters != null ? `${Math.round(latestSample.distance_meters)} מטר מהגן` : "מרחק יחושב אחרי דגימת GPS"} avatar={<MapPin size={22} />} status={<StatusChip tone={latestSample?.inside_geofence ? "success" : "warning"}>{samplesRead.state === "unavailable" ? "לא זמין" : !latestSample ? "מחכה לדגימה" : latestSample.inside_geofence ? "בתחום הגן" : "מחוץ לתחום הגן"}</StatusChip>} actions={null} />
          <ListRowCard title="שקיפות והוגנות" subtitle="דגימות מיקום נשמרות רק לצורך נוכחות, ובחריגה מתבצעת בדיקה." status={<StatusChip tone={anomalies.length ? "warning" : "success"}>{anomaliesRead.state === "unavailable" ? "לא זמין" : anomalies.length ? "דורש בדיקה" : "אין חריגות פתוחות"}</StatusChip>} actions={null} />
        </div>
      </StaffSection>
      <StaffSection title="נוכחות ואיסוף ילדים">
        <div className="ux06-staff-entry-grid">
          <Link href="/dashboard/staff/children-attendance"><UsersRound size={24} /><span><b>נוכחות הכיתות שלי</b><small>הגעה, היעדרות וילדים שטרם הגיעו</small></span></Link>
          <Link href="/dashboard/staff/pickup"><ShieldCheck size={24} /><span><b>אישור איסוף</b><small>בדיקת מורשה ואישור שחרור אנושי</small></span></Link>
        </div>
      </StaffSection>
      <StaffSection title="מוכנות וחריגות">
        <div className="staff-task-list-ref">
          <ListRowCard title="ציון מוכנות צוות" subtitle={scoreRead.state === "unavailable" ? "ציון המוכנות אינו זמין כרגע." : score?.explanation ?? "ציון המוכנות יחושב מנוכחות, מסמכים, הכשרה וציות."} meta={scoreRead.state === "unavailable" ? "לא זמין" : `מוכנות ${score?.readiness_score ?? "-"} · נוכחות ${score?.attendance_score ?? "-"}`} actions={null} />
          {anomaliesRead.state === "unavailable" ? <StaffEmpty title="לא ניתן לטעון חריגות" text="המצב אינו מאומת כרגע. רעננו ונסו שוב." icon={ShieldCheck} /> : anomalies.length ? anomalies.map((item) => <ListRowCard key={item.id} title={item.details ?? item.anomaly_type} subtitle={new Date(item.created_at).toLocaleString("he-IL")} status={<StatusChip tone={item.severity === "critical" || item.severity === "high" ? "danger" : "warning"}>{item.status}</StatusChip>} />) : <StaffEmpty title="אין חריגות פתוחות" text="לא נמצאו חריגות פתוחות ברשומות שנטענו." icon={ShieldCheck} />}
        </div>
      </StaffSection>
      <StaffSection title="היסטוריית משמרות">
        {shiftsRead.state === "unavailable" ? (
          <StaffEmpty title="לא ניתן לטעון היסטוריית משמרות" text="הנתונים אינם זמינים כרגע. רעננו את המסך ונסו שוב." icon={Fingerprint} />
        ) : rows.length === 0 ? (
          <StaffEmpty title="אין עדיין משמרות" text="לאחר שהמערכת תזהה נוכחות רצופה בגן, המשמרת תופיע כאן." icon={Fingerprint} />
        ) : (
          <div className="staff-task-list-ref">
            {rows.map((row) => (
              <ListRowCard
                key={row.id}
                title={new Date(`${row.shift_date}T12:00:00Z`).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })}
                subtitle={`כניסה: ${timeText(row.actual_start)} · יציאה: ${timeText(row.actual_end)}`}
                meta={staffShiftTimeLabel(row)}
                status={<StatusChip tone={confidenceTone(row.attendance_confidence)}>{confidenceText(row.attendance_confidence)}</StatusChip>}
              />
            ))}
          </div>
        )}
      </StaffSection>
    </StaffAppFrame>
  );
}
