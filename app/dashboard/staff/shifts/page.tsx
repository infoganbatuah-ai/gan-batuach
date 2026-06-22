import { CalendarDays, Clock, TimerReset } from "lucide-react";
import { ListRowCard, StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffEmpty, StaffMetricCard, StaffPageHero, StaffSection, StaffStats } from "@/components/staff-app-ui";
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
  return (
    <StaffAppFrame active="shifts">
      <StaffPageHero eyebrow="דוחות שעות" title="שעות עבודה, איחורים וחוסרים" text="הדוח מציג משמרות בפועל מול תכנון." icon={CalendarDays} badge={<StatusChip tone="success">{monthHours.toFixed(1)} שעות</StatusChip>} />
      <StaffStats>
        <StaffMetricCard title="שעות מחושבות" value={monthHours.toFixed(1)} icon={Clock} tone="purple" />
        <StaffMetricCard title="משמרות" value={rows.length} icon={CalendarDays} tone="blue" />
        <StaffMetricCard title="איחורים" value={lateCount} icon={TimerReset} tone={lateCount ? "orange" : "green"} />
      </StaffStats>
      <StaffSection title="היסטוריית משמרות">
        {rows.length === 0 ? (
          <StaffEmpty title="אין משמרות להצגה" text="לאחר שהמנהלת תגדיר משמרות או שתבוצע החתמה, שעות העבודה יופיעו כאן." icon={CalendarDays} />
        ) : (
          <div className="staff-task-list-ref">
            {rows.map((row) => (
              <ListRowCard
                key={row.id}
                title={new Date(row.shift_date).toLocaleDateString("he-IL")}
                subtitle={`מתוכנן ${row.planned_start ?? "-"}-${row.planned_end ?? "-"}`}
                meta={`בפועל ${row.actual_start ? new Date(row.actual_start).toLocaleTimeString("he-IL") : "-"}-${row.actual_end ? new Date(row.actual_end).toLocaleTimeString("he-IL") : "-"}`}
                status={<StatusChip tone={row.status === "late" ? "warning" : "success"}>{hours(row.actual_start, row.actual_end).toFixed(1)} שעות</StatusChip>}
              />
            ))}
          </div>
        )}
      </StaffSection>
    </StaffAppFrame>
  );
}
