import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock3, LogOut, UserRoundX } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DashboardShell } from "@/components/dashboard-shell";
import { ParentAppFrame, ParentEmptyState, ParentHero, ParentMetricCard, ParentSection } from "@/components/parent-app-ui";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { requireRole } from "@/lib/auth";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createClient } from "@/lib/supabase/server";

type FamilyChild = {
  id?: string | null;
  child_id?: string | null;
  permanent_child_file_id?: string | null;
  full_name?: string | null;
  photo_url?: string | null;
  child?: { full_name?: string | null; photo_url?: string | null } | null;
};

type AttendanceRow = {
  id: string;
  attendance_date: string;
  status?: string | null;
  check_in_at?: string | null;
  check_out_at?: string | null;
  pickup_name?: string | null;
};

function timeText(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "—";
}

function attendanceMeta(status?: string | null, checkedOut?: string | null) {
  if (checkedOut || status === "checked_out" || status === "departed" || status === "left_early") return { label: "יצא/ה", tone: "info" as const };
  if (status === "present" || status === "checked_in" || status === "late") return { label: "בגן", tone: "success" as const };
  if (status === "absent") return { label: "נעדר/ת", tone: "danger" as const };
  return { label: "טרם עודכן", tone: "warning" as const };
}

export default async function ParentAttendancePage({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const { profile } = await requireRole(["parent"]);
  const params = await searchParams;
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase, profile);
  const childMap = new Map<string, FamilyChild>();
  for (const child of family.children as unknown as FamilyChild[]) if (child.id) childMap.set(String(child.id), child);
  for (const enrollment of family.enrollments as unknown as FamilyChild[]) {
    const id = String(enrollment.child_id ?? enrollment.permanent_child_file_id ?? "");
    if (id && !childMap.has(id)) childMap.set(id, { ...enrollment, id, full_name: enrollment.full_name ?? enrollment.child?.full_name, photo_url: enrollment.photo_url ?? enrollment.child?.photo_url });
  }
  const children = [...childMap.values()];
  const selected = children.find((child) => String(child.id) === params.child) ?? children[0] ?? null;
  const attendanceRes = selected
    ? await supabase.from("attendance" as never)
      .select("id,attendance_date,status,check_in_at,check_out_at,pickup_name,note,updated_at" as never)
      .eq("child_id", selected.id)
      .order("attendance_date", { ascending: false })
      .limit(60)
    : { data: [], error: null };
  const rows = (attendanceRes.data ?? []) as unknown as AttendanceRow[];
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const today = rows.find((row) => row.attendance_date === todayKey) ?? null;
  const todayMeta = attendanceMeta(today?.status, today?.check_out_at);
  const presentDays = rows.filter((row) => ["present", "checked_in", "checked_out", "departed", "late", "left_early"].includes(String(row.status))).length;
  const absentDays = rows.filter((row) => row.status === "absent").length;

  return (
    <DashboardShell role="parent" title="נוכחות" appHome>
      <ParentAppFrame active="calendar" activeHref="/dashboard/parent/attendance" profileName={profile.full_name} avatarUrl={(profile as unknown as { profile_image_url?: string | null }).profile_image_url ?? null}>
        <ParentHero title="נוכחות" subtitle="הגעה, יציאה והיסטוריה של הילדים שלך" />

        {children.length > 1 ? <form className="parent-child-selector ux05-child-switcher" method="get" aria-label="בחירת ילד להצגת נוכחות">
          <label htmlFor="attendance-child">הצגת נוכחות עבור</label>
          <select id="attendance-child" name="child" defaultValue={selected?.id ?? undefined}>
            {children.map((child) => <option key={String(child.id)} value={String(child.id)}>{cleanSyntheticLabel(child.full_name, "ילד/ה")}</option>)}
          </select>
          <button className="parent-outline-button" type="submit">החלפה</button>
        </form> : null}

        {selected ? <section className="ux05-attendance-child">
          <Avatar name={cleanSyntheticLabel(selected.full_name, "ילד/ה")} src={selected.photo_url} size="lg" />
          <div><span>נוכחות היום</span><h2>{cleanSyntheticLabel(selected.full_name, "ילד/ה")}</h2><StatusChip tone={todayMeta.tone}>{todayMeta.label}</StatusChip></div>
          <Link className="parent-outline-button" href={`/dashboard/parent/children/${selected.id}`}>כרטיס הילד</Link>
        </section> : null}

        <section className="parent-metrics-grid ux05-attendance-metrics">
          <ParentMetricCard title="מצב היום" value={selected ? todayMeta.label : "אין ילד משויך"} hint="לפי רשומת הנוכחות של הגן" icon={CheckCircle2} tone={todayMeta.tone === "success" ? "green" : todayMeta.tone === "danger" ? "red" : "orange"} />
          <ParentMetricCard title="שעת הגעה" value={timeText(today?.check_in_at)} hint="זמן שרת" icon={Clock3} tone="blue" />
          <ParentMetricCard title="שעת יציאה" value={timeText(today?.check_out_at)} hint={today?.pickup_name ? `איסוף: ${today.pickup_name}` : "טרם נרשמה יציאה"} icon={LogOut} tone="purple" />
          <ParentMetricCard title="ימי היעדרות" value={absentDays} hint={`${presentDays} ימי נוכחות בתקופה`} icon={UserRoundX} tone={absentDays ? "orange" : "green"} />
        </section>

        <ParentSection title="היסטוריית נוכחות" subtitle="הרשומות מוצגות כפי שנקלטו ואושרו בגן">
          {rows.length ? <div className="ux05-attendance-history" role="list">
            {rows.map((row) => {
              const meta = attendanceMeta(row.status, row.check_out_at);
              return <article key={row.id} role="listitem">
                <span className="ux05-attendance-date"><CalendarDays size={18} /><b>{new Date(`${row.attendance_date}T12:00:00`).toLocaleDateString("he-IL")}</b></span>
                <span><small>הגעה</small><b>{timeText(row.check_in_at)}</b></span>
                <span><small>יציאה</small><b>{timeText(row.check_out_at)}</b></span>
                <span><small>איסוף</small><b>{row.pickup_name ?? "—"}</b></span>
                <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
              </article>;
            })}
          </div> : <ParentEmptyState title={selected ? "אין עדיין רשומות נוכחות" : "אין ילד משויך"} text={selected ? "לאחר שהגן יעדכן הגעה או יציאה, הרשומה תופיע כאן." : "לאחר קישור ילד לחשבון תופיע כאן היסטוריית הנוכחות."} />}
        </ParentSection>

        <p className="ux05-policy-note">נוכחות נקבעת רק לפי רשומת הנוכחות הקנונית של הגן. מצלמות או זיהוי חזותי אינם קובעים הגעה, יציאה או הרשאת איסוף.</p>
      </ParentAppFrame>
    </DashboardShell>
  );
}
