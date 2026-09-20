import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { StaffTimeManagerActions, StaffTimeRateForm } from "@/components/staff-time-manager-actions";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TimeRow = {
  shift_id: string; staff_name: string; shift_date: string; planned_start: string | null;
  planned_end: string | null; actual_start: string | null; actual_end: string | null;
  worked_minutes: number | null; approval_state: string; estimated_labor_cost: number | null;
  missing_clock_out: boolean;
};

export default async function StaffTimePage() {
  const access = await getManagementGardenContext();
  if (!access.allowed) return <main className="card">אין הרשאה לצפות בשעות צוות. <Link href="/dashboard/garden/staff">חזרה לצוות</Link></main>;
  const role = access.session.profile.role === "owner" ? "owner" : "manager";
  const supabase = await createClient();
  const gardenResult = await supabase.from("gardens" as never).select("operational_timezone" as never).eq("id", access.gardenId).maybeSingle();
  const zone = (gardenResult.data as { operational_timezone?: string } | null)?.operational_timezone ?? "Asia/Jerusalem";
  const period = `${new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit" }).format(new Date())}-01`;
  const [timeResult, employmentResult] = await Promise.all([
    supabase.rpc("management_staff_time_export" as never, { p_garden_id: access.gardenId, p_period_start: period } as never),
    supabase.from("staff_kindergarten_employments" as never).select("id,staff_id,staff(full_name)" as never).eq("garden_id", access.gardenId).eq("status", "active").limit(500)
  ]);
  const rows = (timeResult.data ?? []) as TimeRow[];
  const employments = ((employmentResult.data ?? []) as unknown as { id: string; staff?: { full_name?: string } | null }[])
    .map((row) => ({ id: row.id, staff_name: row.staff?.full_name ?? "איש צוות" }));
  const totalMinutes = rows.reduce((sum, row) => sum + Number(row.worked_minutes ?? 0), 0);
  const approvedCost = rows.reduce((sum, row) => sum + Number(row.estimated_labor_cost ?? 0), 0);
  return <DashboardShell role={role} title="שעות צוות" appHome>
    <p><Link href="/dashboard/garden/staff">חזרה לצוות</Link></p>
    <h1>שעות צוות ומשמרות — {period.slice(0, 7)}</h1>
    <p>שעות שנמדדו: {(totalMinutes / 60).toFixed(1)} · עלות תפעולית משוערת לשעות מאושרות: ₪{approvedCost.toFixed(2)}.</p>
    <p>הנתונים הם קלט לתהליך שכר חיצוני. אין כאן חישוב שכר, מס, שעות נוספות חוקיות או תלוש.</p>
    <p><a href={`/api/garden/staff-time?period=${period}&format=csv`}>הורדת נתוני החודש כ־CSV</a></p>
    {timeResult.error || employmentResult.error ? <p role="alert">חלק מנתוני השעות אינם זמינים כרגע.</p> : null}
    <details><summary>הגדרת גרסת תעריף עתידית</summary><StaffTimeRateForm employments={employments} /></details>
    <div className="table-scroll"><table><thead><tr><th>איש צוות</th><th>תאריך</th><th>תכנון</th><th>בפועל</th><th>שעות</th><th>מצב</th><th>פעולות</th></tr></thead><tbody>
      {rows.map((row) => <tr key={row.shift_id}>
        <td>{row.staff_name}</td><td>{row.shift_date}</td>
        <td>{row.planned_start ?? "—"}–{row.planned_end ?? "—"}</td>
        <td>{row.actual_start ? new Date(row.actual_start).toLocaleString("he-IL", { timeZone: zone }) : "—"}–{row.actual_end ? new Date(row.actual_end).toLocaleString("he-IL", { timeZone: zone }) : "—"}</td>
        <td>{row.worked_minutes == null ? "לא חושב" : (row.worked_minutes / 60).toFixed(2)}</td>
        <td>{row.missing_clock_out ? "חסרה יציאה; נדרש תיקון" : row.approval_state}</td>
        <td><StaffTimeManagerActions shiftId={row.shift_id} actualStart={row.actual_start} actualEnd={row.actual_end} approved={row.approval_state === "approved"} /></td>
      </tr>)}
    </tbody></table></div>
  </DashboardShell>;
}
