import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock3, LogIn, LogOut, Search, ShieldCheck, UserRoundX, UsersRound } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DashboardShell } from "@/components/dashboard-shell";
import { GardenAttendanceActionButton } from "@/components/garden-attendance-action-button";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { TeacherAppFrame, TeacherEmptyState } from "@/components/teacher-app-ui";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type Params = { date?: string; q?: string; status?: string; classroom?: string };
type Row = {
  id: string;
  name: string;
  photoUrl: string | null;
  classroomId: string;
  classroomName: string;
  status: "present" | "absent" | "departed" | "expected";
  arrival: string | null;
  departure: string | null;
  pickupName: string | null;
};

const stateMeta = {
  present: { label: "נוכח/ת", tone: "success" as const },
  absent: { label: "נעדר/ת", tone: "danger" as const },
  departed: { label: "יצא/ה", tone: "info" as const },
  expected: { label: "טרם הגיע/ה", tone: "warning" as const }
};

function dateKey(value: string | undefined, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function timeText(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "—";
}

function rowState(attendance?: Record<string, unknown>): Row["status"] {
  if (!attendance) return "expected";
  if (attendance.check_out_at || ["checked_out", "departed", "left_early"].includes(String(attendance.status))) return "departed";
  if (attendance.status === "absent") return "absent";
  if (attendance.check_in_at || ["present", "checked_in", "late"].includes(String(attendance.status))) return "present";
  return "expected";
}

export default async function GardenAttendancePage({ searchParams }: { searchParams: Promise<Params> }) {
  const access = await getManagementGardenContext();
  if (!access.allowed) notFound();
  const params = await searchParams;
  const supabase = await createClient();
  const gardenId = access.gardenId;
  const gardenRes = await supabase.from("gardens" as never).select("name,operational_timezone" as never).eq("id", gardenId).maybeSingle();
  const zone = String((gardenRes.data as Record<string, unknown> | null)?.operational_timezone ?? "Asia/Jerusalem");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const selectedDate = dateKey(params.date, today);
  const [childrenRes, attendanceRes, classroomsRes] = await Promise.all([
    supabase.from("children" as never).select("id,full_name,photo_url,status,child_classroom_assignments(classroom_id,is_current,classrooms(id,name))" as never).eq("garden_id", gardenId).order("full_name").limit(500),
    supabase.from("attendance" as never).select("id,child_id,status,check_in_at,check_out_at,pickup_name,arrival_recorded_by,departure_recorded_by" as never).eq("garden_id", gardenId).eq("attendance_date", selectedDate).limit(500),
    supabase.from("classrooms" as never).select("id,name,status" as never).eq("garden_id", gardenId).eq("status", "active").order("sort_order").order("name")
  ]);
  const sourceErrors = [childrenRes.error, attendanceRes.error, classroomsRes.error, gardenRes.error].filter(Boolean);
  const attendanceByChild = new Map(((attendanceRes.data ?? []) as unknown as Array<Record<string, unknown>>).map((item) => [String(item.child_id), item]));
  const rows: Row[] = ((childrenRes.data ?? []) as unknown as Array<Record<string, unknown>>).map((child) => {
    const assignments = (child.child_classroom_assignments ?? []) as Array<Record<string, unknown>>;
    const assignment = assignments.find((item) => item.is_current === true);
    const classroom = assignment?.classrooms as Record<string, unknown> | undefined;
    const attendance = attendanceByChild.get(String(child.id));
    return {
      id: String(child.id),
      name: String(child.full_name ?? "ילד/ה"),
      photoUrl: typeof child.photo_url === "string" ? child.photo_url : null,
      classroomId: String(assignment?.classroom_id ?? ""),
      classroomName: String(classroom?.name ?? "ללא כיתה"),
      status: rowState(attendance),
      arrival: typeof attendance?.check_in_at === "string" ? attendance.check_in_at : null,
      departure: typeof attendance?.check_out_at === "string" ? attendance.check_out_at : null,
      pickupName: typeof attendance?.pickup_name === "string" ? attendance.pickup_name : null
    };
  });
  const query = (params.q ?? "").trim().toLocaleLowerCase("he");
  const filtered = rows.filter((row) =>
    (!query || `${row.name} ${row.classroomName}`.toLocaleLowerCase("he").includes(query)) &&
    (!params.classroom || row.classroomId === params.classroom) &&
    (!params.status || params.status === "all" || row.status === params.status)
  );
  const count = (state: Row["status"]) => rows.filter((row) => row.status === state).length;
  const metrics = [
    { state: "all", label: "צפויים", value: rows.length, icon: UsersRound },
    { state: "present", label: "נוכחים", value: count("present"), icon: CheckCircle2 },
    { state: "absent", label: "נעדרים", value: count("absent"), icon: UserRoundX },
    { state: "departed", label: "יצאו", value: count("departed"), icon: LogOut },
    { state: "expected", label: "טרם הגיעו", value: count("expected"), icon: Clock3 }
  ] as const;
  const profile = access.session.profile;
  const gardenName = String((gardenRes.data as Record<string, unknown> | null)?.name ?? "הגן הפעיל").replace(/\[DEMO\]/g, "").trim();

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="נוכחות" appHome>
      <TeacherAppFrame role={profile.role === "owner" ? "owner" : "manager"} title="נוכחות" subtitle={gardenName} avatarUrl={(profile as { profile_image_url?: string | null }).profile_image_url ?? null} active="children">
        <div className="ux06-operations">
          <header className="ux06-page-header">
            <div><span><ShieldCheck size={18} /> תפעול יומי מאובטח</span><h2>נוכחות</h2><p>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p></div>
            <nav aria-label="פעולות נוכחות ואיסוף"><Link className="button secondary" href="/dashboard/garden/pickup">איסוף ושחרור</Link><Link className="button primary" href="/dashboard/garden/reports?section=attendance">דוח נוכחות</Link></nav>
          </header>

          {sourceErrors.length ? <div className="ux06-local-error"><b>חלק מנתוני הנוכחות אינם זמינים כרגע.</b><span>לא מוצגים ערכי אפס במקום מידע שנכשל.</span></div> : null}

          <section className="ux06-metrics" aria-label="סיכום נוכחות">
            {metrics.map(({ state, label, value, icon: Icon }) => <Link className={params.status === state || (!params.status && state === "all") ? `active ${state}` : state} href={state === "all" ? `?date=${selectedDate}` : `?date=${selectedDate}&status=${state}`} key={state}><Icon size={22} /><b>{value}</b><span>{label}</span></Link>)}
          </section>

          <section className="ux06-toolbar">
            <form action="/dashboard/garden/attendance">
              <input type="hidden" name="date" value={selectedDate} />
              <label className="ux06-search"><Search size={20} /><input name="q" defaultValue={params.q ?? ""} placeholder="חיפוש ילד/ה או כיתה" /></label>
              <label><span>כיתה</span><select name="classroom" defaultValue={params.classroom ?? ""}><option value="">כל הכיתות</option>{((classroomsRes.data ?? []) as unknown as Array<{ id: string; name: string }>).map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
              <label><span>מצב</span><select name="status" defaultValue={params.status ?? "all"}><option value="all">כל המצבים</option><option value="present">נוכחים</option><option value="absent">נעדרים</option><option value="departed">יצאו</option><option value="expected">טרם הגיעו</option></select></label>
              <button className="button secondary" type="submit">סינון</button>
            </form>
            <form action="/dashboard/garden/attendance"><label><CalendarDays size={19} /><span className="sr-only">בחירת יום</span><input name="date" type="date" defaultValue={selectedDate} /></label><button className="button secondary" type="submit">הצגה</button></form>
          </section>

          {filtered.length ? <>
            <section className="ux06-attendance-table" role="table" aria-label="רשימת נוכחות יומית">
              <div className="ux06-table-head" role="row"><span>ילד/ה</span><span>כיתה</span><span>מצב</span><span>הגעה</span><span>יציאה / איסוף</span><span>פעולה</span></div>
              {filtered.map((row) => {
                const meta = stateMeta[row.status];
                return <article className="ux06-attendance-row" role="row" key={row.id}>
                  <Link href={`/dashboard/garden/children/${row.id}`}><Avatar name={row.name} src={row.photoUrl} size="sm" /><b>{row.name}</b></Link>
                  <span>{row.classroomName}</span>
                  <StatusChip tone={meta.tone}>{meta.label}</StatusChip>
                  <time dir="ltr">{timeText(row.arrival)}</time>
                  <span><b dir="ltr">{timeText(row.departure)}</b><small>{row.pickupName ?? "טרם נרשם איסוף"}</small></span>
                  <div>{selectedDate === today ? <GardenAttendanceActionButton childId={row.id} currentStatus={row.status === "departed" ? "left_early" : row.status === "expected" ? "not_updated" : row.status} /> : <Link className="button secondary tiny" href={`/dashboard/garden/children/${row.id}?tab=attendance`}>היסטוריה</Link>}</div>
                </article>;
              })}
            </section>
            <section className="ux06-mobile-list" aria-label="רשימת נוכחות לנייד">{filtered.map((row) => {
              const meta = stateMeta[row.status];
              return <article key={`mobile-${row.id}`}><Link href={`/dashboard/garden/children/${row.id}`}><Avatar name={row.name} src={row.photoUrl} size="sm" /><span><b>{row.name}</b><small>{row.classroomName}</small></span></Link><StatusChip tone={meta.tone}>{meta.label}</StatusChip><dl><div><dt>הגעה</dt><dd dir="ltr">{timeText(row.arrival)}</dd></div><div><dt>יציאה</dt><dd dir="ltr">{timeText(row.departure)}</dd></div></dl>{selectedDate === today ? <GardenAttendanceActionButton childId={row.id} currentStatus={row.status === "departed" ? "left_early" : row.status === "expected" ? "not_updated" : row.status} /> : null}</article>;
            })}</section>
          </> : <TeacherEmptyState title="אין ילדים בסינון הזה" text="אפשר לבחור יום, כיתה או מצב אחר. היעדר רשומה מוצג כטרם הגיע/ה ואינו הופך לאפס." />}
          <p className="ux06-authority-note"><LogIn size={18} /> זמני הגעה ויציאה נקבעים בשרת. מצלמות וזיהוי חזותי אינם קובעים נוכחות ואינם משחררים ילד.</p>
        </div>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
