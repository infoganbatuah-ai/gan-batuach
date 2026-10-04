import Link from "next/link";
import { AlertTriangle, CalendarDays, Clock, Fingerprint, TimerReset } from "lucide-react";
import { ListRowCard, StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffEmpty, StaffMetricCard, StaffPageHero, StaffSection, StaffStats } from "@/components/staff-app-ui";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";

function shortTime(value?: string | null) {
  return value ? value.slice(0, 5) : "—";
}

export default async function Page() {
  const { employment } = await requireOperationalRole(["staff"]);
  const supabase = await createClient();
  const staffRes = await supabase.from("staff" as any).select("id, full_name, garden_id").eq("id", employment!.staff_id).eq("garden_id", employment!.garden_id).maybeSingle();
  const staff = staffRes.data as any;
  if (!staff?.id || !staff?.garden_id) {
    return (
      <StaffAppFrame active="home" mode="candidate">
        <StaffPageHero eyebrow="משמרות צוות" title="לוח משמרות ייפתח אחרי שיוך לגן" text="לפני אישור מנהלת אין משמרות פעילות או שעות עבודה להצגה." icon={CalendarDays} badge={<StatusChip tone="warning">ממתין לשיוך</StatusChip>} />
        <StaffSection title="אין משמרות">
          <StaffEmpty title="עדיין לא שובצת לגן" text="לאחר שיוך לגן, לוח המשמרות והשעות שלך יופיעו כאן." icon={CalendarDays} />
        </StaffSection>
      </StaffAppFrame>
    );
  }
  const shiftsRes = staff?.id ? await supabase.from("staff_shifts" as any).select("id, shift_date, planned_start, planned_end, actual_start, actual_end, total_minutes, approved_at, status").eq("staff_id", staff.id).eq("garden_id", employment!.garden_id).order("shift_date", { ascending: false }).limit(60) : { data: [] };
  const rows = (shiftsRes.data ?? []) as any[];
  const monthKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit" }).format(new Date());
  const monthHours = rows.filter((row) => row.shift_date.startsWith(monthKey)).reduce((sum, row) => sum + (row.actual_end ? Number(row.total_minutes ?? 0) / 60 : 0), 0);
  const lateCount = rows.filter((row) => row.status === "late").length;
  const openShift = rows.find((row) => row.actual_start && !row.actual_end);
  const incomplete = rows.filter((row) => row.actual_start && !row.actual_end).length;
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setHours(12, 0, 0, 0);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + index);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
    return {
      key,
      day: new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", weekday: "short" }).format(date),
      date: new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric" }).format(date),
      shift: rows.find((row) => row.shift_date === key),
      current: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(today) === key
    };
  });
  return (
    <StaffAppFrame active="shifts">
      <StaffPageHero eyebrow="דוחות שעות" title="שעות עבודה, איחורים וחוסרים" text="הדוח מציג משמרות בפועל מול תכנון." icon={CalendarDays} badge={<StatusChip tone="success">{monthHours.toFixed(1)} שעות</StatusChip>} />
      <section className="staff-week-board" aria-labelledby="staff-week-title">
        <header>
          <div><h2 id="staff-week-title">השבוע שלי</h2><p>המשמרות הקנוניות של הגן הפעיל, יום אחר יום</p></div>
          <StatusChip tone={incomplete ? "warning" : "success"}>{incomplete ? "נדרשת השלמת יציאה" : "לוח מעודכן"}</StatusChip>
        </header>
        <div className="staff-week-grid">
          {weekDays.map((item) => {
            const state = item.shift?.actual_start && !item.shift?.actual_end ? "incomplete" : item.shift?.actual_start ? "" : "planned";
            return <article className={`staff-week-day ${item.current ? "current" : ""}`} key={item.key}>
              <span><b>{item.day}</b>{item.date}</span>
              {item.shift ? <div className={`staff-week-shift ${state}`}><strong><bdi dir="ltr">{shortTime(item.shift.planned_start)}–{shortTime(item.shift.planned_end)}</bdi></strong><small>{state === "incomplete" ? "חסרה יציאה" : item.shift.actual_start ? "נרשמה נוכחות" : "מתוכנן"}</small></div> : <div className="staff-week-shift planned"><strong>ללא משמרת</strong><small>אין שיבוץ</small></div>}
            </article>;
          })}
        </div>
      </section>
      <StaffStats>
        <StaffMetricCard title="שעות מחושבות" value={monthHours.toFixed(1)} icon={Clock} tone="purple" />
        <StaffMetricCard title="משמרות" value={rows.length} icon={CalendarDays} tone="blue" />
        <StaffMetricCard title="איחורים" value={lateCount} icon={TimerReset} tone={lateCount ? "orange" : "green"} />
        <StaffMetricCard title="חסרה יציאה" value={incomplete} hint={incomplete ? "נדרש טיפול" : "הכול תקין"} icon={AlertTriangle} tone={incomplete ? "red" : "green"} />
      </StaffStats>
      <section className={`ux07-current-shift ${openShift ? "active" : ""}`}>
        <div><Fingerprint size={28} /><span><small>מצב נוכחי</small><strong>{openShift ? "משמרת פעילה" : "אין משמרת פתוחה"}</strong><b>{openShift?.actual_start ? `כניסה ${new Date(openShift.actual_start).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}` : "זמן השרת יקבע בעת ההחתמה"}</b></span></div>
        <Link className="gb-primary-button" href="/dashboard/staff/attendance">{openShift ? "יציאה / פרטי נוכחות" : "כניסה למשמרת"}</Link>
      </section>
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
                status={<StatusChip tone={row.actual_start && !row.actual_end ? "warning" : "success"}>{row.actual_start && !row.actual_end ? "חסרה החתמת יציאה" : `${(Number(row.total_minutes ?? 0) / 60).toFixed(1)} שעות`}</StatusChip>}
              />
            ))}
          </div>
        )}
      </StaffSection>
    </StaffAppFrame>
  );
}
