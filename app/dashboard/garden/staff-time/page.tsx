import Link from "next/link";
import { PermissionDeniedState } from "@/components/global-state-system";
import { AlertTriangle, CalendarDays, Clock3, Download, WalletCards } from "lucide-react";
import { MetricCard, StatusChip } from "@/components/gan-batuach-design-system";
import { RoleAppShell } from "@/components/role-app-shell";
import { StaffTimeManagerActions, StaffTimeRateForm } from "@/components/staff-time-manager-actions";
import { StaffShiftPlanningForm } from "@/components/staff-shift-planning-form";
import type { ShiftPlanningStaff } from "@/lib/domain/staff-shift-planning";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type TimeRow = { shift_id: string; staff_name: string; shift_date: string; planned_start: string | null; planned_end: string | null; actual_start: string | null; actual_end: string | null; worked_minutes: number | null; approval_state: string; estimated_labor_cost: number | null; missing_clock_out: boolean };
type EmploymentRow = { id: string; staff_id: string; start_date: string | null; end_date: string | null; staff?: { full_name?: string; profile_id?: string | null; approved_to_work?: boolean; onboarding_status?: string } | null };

function shortTime(value: string | null, zone: string) {
  return value ? new Date(value).toLocaleTimeString("he-IL", { timeZone: zone, hour: "2-digit", minute: "2-digit" }) : "—";
}

export default async function StaffTimePage() {
  const access = await getManagementGardenContext();
  if (!access.allowed) return <PermissionDeniedState backHref="/dashboard/garden/staff" description="דוחות שעות צוות זמינים רק לבעלי תפקיד מורשים בגן הפעיל." />;
  const role = access.session.profile.role === "owner" ? "owner" : "manager";
  const supabase = await createClient();
  const gardenResult = await supabase.from("gardens" as never).select("operational_timezone" as never).eq("id", access.gardenId).maybeSingle();
  const zone = (gardenResult.data as { operational_timezone?: string } | null)?.operational_timezone ?? "Asia/Jerusalem";
  const dayParts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const today = ["year", "month", "day"].map((part) => dayParts.find((item) => item.type === part)?.value ?? "").join("-");
  const period = `${today.slice(0, 7)}-01`;
  const [timeResult, employmentResult] = await Promise.all([
    supabase.rpc("management_staff_time_export" as never, { p_garden_id: access.gardenId, p_period_start: period } as never),
    supabase.from("staff_kindergarten_employments" as never).select("id,staff_id,start_date,end_date,staff(full_name,profile_id,approved_to_work,onboarding_status)" as never).eq("garden_id", access.gardenId).eq("status", "active").limit(500)
  ]);
  const rows = (timeResult.data ?? []) as TimeRow[];
  const employmentRows = (employmentResult.data ?? []) as unknown as EmploymentRow[];
  const employments = employmentRows.map((row) => ({ id: row.id, staff_name: row.staff?.full_name ?? "איש צוות" }));
  const plannableStaff: ShiftPlanningStaff[] = [...new Map(employmentRows
    .filter((row) => row.staff?.profile_id && row.staff.approved_to_work && row.staff.onboarding_status === "active")
    .map((row) => [row.staff_id, { id: row.staff_id, name: row.staff?.full_name ?? "איש צוות", startDate: row.start_date, endDate: row.end_date }])).values()];
  const totalMinutes = rows.reduce((sum, row) => sum + Number(row.worked_minutes ?? 0), 0);
  const approvedCost = rows.reduce((sum, row) => sum + Number(row.estimated_labor_cost ?? 0), 0);
  const incomplete = rows.filter((row) => row.missing_clock_out).length;
  const approved = rows.filter((row) => row.approval_state === "approved").length;

  return <RoleAppShell role={role} activeHref="/dashboard/garden/staff" title="שעות צוות" subtitle="משמרות, חריגות ונתונים מוכנים להעברה לשכר" profile={access.session.profile} className="staff-runtime-shell ux07-manager-staff-shell">
    <main className="ux07-manager-workspace">
      <section className="ux07-page-hero"><div><span>צוות · {period.slice(0, 7)}</span><h1>שעות עבודה ומשמרות</h1><p>מעקב מדויק לפי זמן השרת, אישור חריגות וייצוא לתהליך שכר חיצוני.</p></div><a className="gb-primary-button" href={`/api/garden/staff-time?period=${period}&format=csv`}><Download size={18} /> הורדת CSV</a></section>
      <section className="ux07-metrics" aria-label="סיכום שעות">
        <MetricCard label="שעות שנמדדו" value={(totalMinutes / 60).toFixed(1)} hint="בחודש הנוכחי" icon={Clock3} tone="primary" />
        <MetricCard label="משמרות" value={rows.length} hint={`${approved} אושרו`} icon={CalendarDays} tone="info" />
        <MetricCard label="חסרה יציאה" value={incomplete} hint={incomplete ? "נדרש תיקון" : "הכול תקין"} icon={AlertTriangle} tone={incomplete ? "danger" : "success"} />
        <MetricCard label="עלות מאושרת" value={`₪${approvedCost.toFixed(0)}`} hint="הערכה תפעולית בלבד" icon={WalletCards} tone="warning" />
      </section>
      {timeResult.error || employmentResult.error ? <p className="ux07-local-error" role="alert">חלק מנתוני השעות אינם זמינים כרגע. נסו שוב.</p> : null}
      <section className="ux07-panel" aria-labelledby="staff-shift-planning-title">
        <div className="ux07-panel-heading"><div><h2 id="staff-shift-planning-title">תכנון משמרת</h2><p>שיבוץ איש צוות מאושר לגן הפעיל. השמירה מתבצעת בשרת ומופיעה בלוח המשמרות שלו.</p></div><CalendarDays aria-hidden="true" /></div>
        {employmentResult.error ? <p role="alert" className="ux07-local-error">רשימת אנשי הצוות אינה זמינה. אי אפשר לתכנן משמרת כעת.</p>
          : plannableStaff.length ? <StaffShiftPlanningForm gardenId={access.gardenId} today={today} zone={zone} staff={plannableStaff} />
          : <div className="empty-state"><strong>אין כרגע אנשי צוות מאושרים לתכנון</strong><span>לאחר הפעלת העסקה ואישור עבודה ניתן לשבץ משמרת.</span></div>}
      </section>
      <section className="ux07-panel">
        <div className="ux07-panel-heading"><div><h2>יומן שעות</h2><p>נתונים מוכנים להעברה. המערכת אינה מחשבת מס, שכר נטו או תלוש.</p></div><Link href="/dashboard/garden/staff">חזרה לצוות</Link></div>
        {rows.length ? <><div className="table-scroll ux07-time-table"><table><thead><tr><th>איש צוות</th><th>תאריך</th><th>תכנון</th><th>בפועל</th><th>שעות</th><th>מצב</th><th>פעולות</th></tr></thead><tbody>{rows.map((row) => <tr key={row.shift_id} className={row.missing_clock_out ? "needs-action" : ""}><td><strong>{row.staff_name}</strong></td><td>{new Date(row.shift_date).toLocaleDateString("he-IL")}</td><td>{row.planned_start ?? "—"}–{row.planned_end ?? "—"}</td><td>{shortTime(row.actual_start, zone)}–{shortTime(row.actual_end, zone)}</td><td>{row.worked_minutes == null ? "לא חושב" : (row.worked_minutes / 60).toFixed(2)}</td><td><StatusChip tone={row.approval_state === "approved" ? "success" : row.approval_state === "scheduled" ? "info" : "warning"}>{row.approval_state === "scheduled" ? "מתוכנן" : row.missing_clock_out ? "חסרה יציאה" : row.approval_state === "approved" ? "מאושר" : "ממתין לאישור"}</StatusChip></td><td>{row.approval_state === "scheduled" ? "—" : <StaffTimeManagerActions shiftId={row.shift_id} actualStart={row.actual_start} actualEnd={row.actual_end} approved={row.approval_state === "approved"} />}</td></tr>)}</tbody></table></div>
        <div className="ux07-mobile-time-list">{rows.map((row) => <article key={row.shift_id}><div><strong>{row.staff_name}</strong><span>{new Date(row.shift_date).toLocaleDateString("he-IL")}</span></div><p>{row.planned_start?.slice(0, 5) ?? "—"}–{row.planned_end?.slice(0, 5) ?? "—"} · {row.approval_state === "scheduled" ? "מתוכנן" : `${shortTime(row.actual_start, zone)}–${shortTime(row.actual_end, zone)}`}</p><StatusChip tone={row.approval_state === "scheduled" ? "info" : row.missing_clock_out ? "danger" : "success"}>{row.approval_state === "scheduled" ? "מתוכנן" : row.missing_clock_out ? "חסרה יציאה" : "רשומה תקינה"}</StatusChip></article>)}</div></> : <div className="empty-state"><strong>אין רשומות בחודש הזה</strong><span>משמרות והחתמות יופיעו כאן לאחר שמירה בשרת.</span></div>}
      </section>
      <details className="ux07-rate-panel"><summary>הגדרת גרסת תעריף עתידית</summary><p>שדה ניהולי מורשה בלבד. שינוי נשמר בהיסטוריה ואינו מחשב שכר.</p><StaffTimeRateForm employments={employments} /></details>
    </main>
  </RoleAppShell>;
}
