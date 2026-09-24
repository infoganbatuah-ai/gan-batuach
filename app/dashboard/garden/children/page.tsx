import Link from "next/link";
import { AlertTriangle, Baby, CheckCircle2, ChevronLeft, CircleDot, Filter, GraduationCap, MoreHorizontal, Plus, Search, UsersRound } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ClassroomManagementForm } from "@/components/classroom-management-actions";
import { DashboardShell } from "@/components/dashboard-shell";
import { GardenChildCreatePanel } from "@/components/garden-child-create-panel";
import { TeacherAppFrame, TeacherEmptyState } from "@/components/teacher-app-ui";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type Params = { section?: string; q?: string; status?: string; classroom?: string; new?: string };
type Classroom = {
  id: string; name: string; age_group_key: string; age_group_label?: string | null;
  min_age_months?: number | null; max_age_months?: number | null; capacity_limit?: number | null; status: string;
  child_classroom_assignments?: Array<{ child_id: string; is_current: boolean }>;
  staff_classroom_assignments?: Array<{ id: string; staff_id: string; status: string; responsibility: string }>;
};
type ChildView = Record<string, unknown> & {
  id: string;
  full_name: string;
  birth_date: string | null;
  photo_url?: string | null;
  face_image_url?: string | null;
  currentClassroomId: string;
  classroomName: string;
  attendanceStatus: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  pickupName: string | null;
  enrollmentStatus: string;
};

const attendanceLabels: Record<string, { label: string; tone: "success" | "warning" | "danger" | "muted" }> = {
  present: { label: "נוכח/ת", tone: "success" }, checked_in: { label: "נוכח/ת", tone: "success" },
  absent: { label: "נעדר/ת", tone: "danger" }, departed: { label: "נאסף/ה", tone: "muted" },
  checked_out: { label: "נאסף/ה", tone: "muted" }, late: { label: "הגעה מאוחרת", tone: "warning" },
  not_updated: { label: "טרם סומן", tone: "warning" }
};

function ageText(value?: string | null) {
  if (!value) return "גיל לא צוין";
  const months = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 2_629_800_000));
  return months >= 12 ? `${Math.floor(months / 12)}.${months % 12} שנים` : `${months} חודשים`;
}

function timeText(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

export default async function GardenChildrenPage({ searchParams }: { searchParams: Promise<Params> }) {
  const access = await getManagementGardenContext();
  if (!access.allowed) notFound();
  const { profile } = access.session;
  const params = await searchParams;
  const section = params.section === "classrooms" ? "classrooms" : "children";
  const supabase = await createClient();
  const gardenId = access.gardenId;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [childrenRes, attendanceRes, classroomsRes, reservationsRes, enrollmentsRes, gardenRes] = await Promise.all([
    supabase.from("children" as never).select("*, child_classroom_assignments(id,classroom_id,is_current,assigned_at,ended_at,classrooms(id,name,age_group_label))" as any).eq("garden_id", gardenId).order("full_name"),
    supabase.from("attendance" as never).select("child_id,status,check_in_at,check_out_at,pickup_name" as never).eq("garden_id", gardenId).eq("attendance_date", today),
    supabase.from("classrooms" as never).select("id,name,age_group_key,age_group_label,min_age_months,max_age_months,capacity_limit,status,sort_order,child_classroom_assignments(child_id,is_current),staff_classroom_assignments(id,staff_id,status,responsibility)" as never).eq("garden_id", gardenId).order("sort_order").order("name"),
    supabase.from("classroom_seat_reservations" as never).select("id,classroom_id,status,expires_at" as never).eq("garden_id", gardenId).eq("status", "active"),
    supabase.from("child_kindergarten_enrollments" as never).select("child_id,status,start_date,end_date" as never).eq("garden_id", gardenId).order("created_at", { ascending: false }),
    supabase.from("gardens" as never).select("name,operational_timezone" as never).eq("id", gardenId).maybeSingle()
  ]);
  const sourceErrors = [childrenRes.error, attendanceRes.error, classroomsRes.error, reservationsRes.error, enrollmentsRes.error, gardenRes.error].filter(Boolean);
  const attendanceByChild = new Map(((attendanceRes.data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => [String(row.child_id), row]));
  const enrollmentByChild = new Map<string, Record<string, unknown>>();
  for (const row of (enrollmentsRes.data ?? []) as unknown as Array<Record<string, unknown>>) if (!enrollmentByChild.has(String(row.child_id))) enrollmentByChild.set(String(row.child_id), row);
  const classrooms = (classroomsRes.data ?? []) as unknown as Classroom[];
  const classroomById = new Map(classrooms.map((room) => [room.id, room]));
  const rawChildren = (childrenRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const children: ChildView[] = rawChildren.map((child) => {
    const assignments = (child.child_classroom_assignments ?? []) as Array<Record<string, unknown>>;
    const currentAssignment = assignments.find((assignment) => assignment.is_current === true);
    const classroom = currentAssignment?.classrooms as Record<string, unknown> | undefined;
    const attendance = attendanceByChild.get(String(child.id));
    const enrollment = enrollmentByChild.get(String(child.id));
    return { ...child, id: String(child.id), full_name: String(child.full_name ?? "ילד/ה"), birth_date: typeof child.birth_date === "string" ? child.birth_date : null, currentClassroomId: String(currentAssignment?.classroom_id ?? ""), classroomName: String(classroom?.name ?? child.classroom ?? child.age_group ?? "ללא כיתה"), attendanceStatus: String(attendance?.status ?? "not_updated"), checkInAt: typeof attendance?.check_in_at === "string" ? attendance.check_in_at : null, checkOutAt: typeof attendance?.check_out_at === "string" ? attendance.check_out_at : null, pickupName: typeof attendance?.pickup_name === "string" ? attendance.pickup_name : null, enrollmentStatus: String(enrollment?.status ?? child.status ?? "לא הוגדר") };
  });
  const query = (params.q ?? "").trim().toLocaleLowerCase("he");
  const filteredChildren = children.filter((child) => (!query || `${child.full_name ?? ""} ${child.classroomName}`.toLocaleLowerCase("he").includes(query)) && (!params.classroom || child.currentClassroomId === params.classroom) && (!params.status || params.status === "all" || child.attendanceStatus === params.status || child.enrollmentStatus === params.status));
  const activeReservations = (reservationsRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const selectedClassroom = params.classroom ? classroomById.get(params.classroom) : undefined;
  const classroomCards = classrooms.map((room) => {
    const occupied = (room.child_classroom_assignments ?? []).filter((assignment) => assignment.is_current).length;
    const reserved = activeReservations.filter((reservation) => String(reservation.classroom_id) === room.id && (!reservation.expires_at || new Date(String(reservation.expires_at)).getTime() > Date.now())).length;
    const limit = room.capacity_limit ?? null;
    return { ...room, occupied, reserved, available: limit == null ? null : Math.max(limit - occupied - reserved, 0), overCapacity: limit != null && occupied + reserved > limit };
  });
  const classDetail = selectedClassroom ? classroomCards.find((room) => room.id === selectedClassroom.id) : undefined;
  const classChildren = classDetail ? children.filter((child) => child.currentClassroomId === classDetail.id) : [];
  const present = children.filter((child) => ["present", "checked_in"].includes(child.attendanceStatus)).length;
  const departed = children.filter((child) => ["departed", "checked_out"].includes(child.attendanceStatus) || child.checkOutAt).length;
  const pending = children.filter((child) => !["active", "approved"].includes(String(child.enrollmentStatus))).length;
  const gardenName = String((gardenRes.data as Record<string, unknown> | null)?.name ?? "הגן הפעיל").replace(/\[DEMO\]/g, "").trim();

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="ילדים וכיתות" appHome>
      <TeacherAppFrame role={profile.role === "owner" ? "owner" : "manager"} title="ילדים וכיתות" subtitle={gardenName} avatarUrl={(profile as { profile_image_url?: string | null }).profile_image_url ?? null} active="children">
        <div className="ux04-domain-workspace">
          <header className="ux04-workspace-header">
            <div><span className="ux04-eyebrow"><UsersRound size={17} /> מרחב ילדים</span><h2>{section === "classrooms" ? "כיתות" : "ילדים"}</h2><p>{section === "classrooms" ? `${classrooms.length} כיתות פעילות והקיבולת שלהן` : `${children.length} ילדים ב${gardenName}`}</p></div>
            <Link className="button primary" href={section === "classrooms" ? "/dashboard/garden/children?section=classrooms&new=classroom" : "/dashboard/garden/children?new=1"}><Plus size={18} />{section === "classrooms" ? "הוספת כיתה" : "הוספת ילד/ה"}</Link>
          </header>
          <nav className="ux04-domain-tabs" aria-label="ילדים, כיתות ורישום">
            <Link className={section === "children" ? "active" : ""} href="/dashboard/garden/children"><Baby size={18} /> ילדים</Link>
            <Link className={section === "classrooms" ? "active" : ""} href="/dashboard/garden/children?section=classrooms"><GraduationCap size={18} /> כיתות</Link>
            <Link href="/dashboard/garden/enrollment-requests"><CircleDot size={18} /> בקשות רישום</Link>
          </nav>
          {sourceErrors.length ? <div className="ux04-source-error"><AlertTriangle size={20} /><span><b>חלק מהמידע אינו זמין כרגע</b><small>לא הוצגו ערכי אפס במקום נתונים שנכשלו. אפשר לרענן ולנסות שוב.</small></span></div> : null}
          {section === "children" ? (
            <>
              <section className="ux04-summary-strip" aria-label="סיכום ילדים"><span className="blue"><b>{children.length}</b><small>סה״כ ילדים</small></span><span className="green"><b>{present}</b><small>נוכחים היום</small></span><span className="purple"><b>{departed}</b><small>נאספו היום</small></span><span className={pending ? "orange" : "green"}><b>{pending}</b><small>רישום דורש טיפול</small></span></section>
              <form className="ux04-filter-bar" action="/dashboard/garden/children">
                <label className="ux04-search"><Search size={20} /><input name="q" defaultValue={params.q ?? ""} placeholder="חיפוש לפי שם ילד/ה או כיתה" /></label>
                <label><Filter size={18} /><select name="classroom" defaultValue={params.classroom ?? ""}><option value="">כל הכיתות</option>{classrooms.map((room) => <option value={room.id} key={room.id}>{room.name}</option>)}</select></label>
                <label><CheckCircle2 size={18} /><select name="status" defaultValue={params.status ?? "all"}><option value="all">כל הסטטוסים</option><option value="present">נוכחים</option><option value="absent">נעדרים</option><option value="not_updated">טרם סומנו</option><option value="active">רישום פעיל</option></select></label>
                <button className="button secondary" type="submit">החלת סינון</button>
              </form>
              {params.new === "1" ? <GardenChildCreatePanel gardenId={gardenId} defaultOpen /> : null}
              {filteredChildren.length ? (
                <section className="ux04-list-surface">
                  <div className="ux04-children-table" role="table" aria-label="רשימת ילדים">
                    <div className="ux04-table-head" role="row"><span>שם</span><span>גיל</span><span>כיתה</span><span>סטטוס היום</span><span>שעת הגעה</span><span>איסוף</span><span>פעולות</span></div>
                    {filteredChildren.map((child) => {
                      const attendance = attendanceLabels[child.attendanceStatus] ?? attendanceLabels.not_updated;
                      return <article className="ux04-child-row" role="row" key={String(child.id)}><Link className="ux04-child-identity" href={`/dashboard/garden/children/${child.id}`}><Avatar name={String(child.full_name ?? "ילד/ה")} src={typeof child.photo_url === "string" ? child.photo_url : typeof child.face_image_url === "string" ? child.face_image_url : undefined} size="sm" /><span><b>{String(child.full_name ?? "ילד/ה")}</b><small>{child.enrollmentStatus === "active" ? "רישום פעיל" : child.enrollmentStatus}</small></span></Link><span>{ageText(typeof child.birth_date === "string" ? child.birth_date : null)}</span><Link href={child.currentClassroomId ? `/dashboard/garden/children?section=classrooms&classroom=${child.currentClassroomId}` : "/dashboard/garden/children?section=classrooms"}>{child.classroomName}</Link><StatusChip tone={attendance.tone}>{attendance.label}</StatusChip><span dir="ltr">{timeText(child.checkInAt)}</span><span>{child.pickupName ?? (child.checkOutAt ? timeText(child.checkOutAt) : "טרם נאסף/ה")}</span><Link className="ux04-more-button" href={`/dashboard/garden/children/${child.id}`} aria-label={`פתיחת כרטיס ${child.full_name}`}><MoreHorizontal size={20} /></Link></article>;
                    })}
                  </div>
                  <div className="ux04-mobile-child-list">{filteredChildren.map((child) => { const attendance = attendanceLabels[child.attendanceStatus] ?? attendanceLabels.not_updated; return <Link className="ux04-mobile-child-card" href={`/dashboard/garden/children/${child.id}`} key={`mobile-${child.id}`}><Avatar name={String(child.full_name ?? "ילד/ה")} src={typeof child.photo_url === "string" ? child.photo_url : undefined} size="sm" /><span><b>{String(child.full_name ?? "ילד/ה")}</b><small>{ageText(typeof child.birth_date === "string" ? child.birth_date : null)} · {child.classroomName}</small></span><StatusChip tone={attendance.tone}>{attendance.label}</StatusChip><b className="ux04-mobile-time" dir="ltr">{timeText(child.checkInAt)}</b><ChevronLeft size={20} /></Link>; })}</div>
                </section>
              ) : <TeacherEmptyState title={query || params.classroom || params.status ? "לא נמצאו ילדים בסינון הזה" : "עדיין אין ילדים בגן"} text="אפשר לנקות את הסינון, להוסיף ילד/ה או לאשר בקשת רישום." action={<Link className="button primary" href="/dashboard/garden/children?new=1">הוספת ילד/ה</Link>} />}
            </>
          ) : (
            <>
              {params.new === "classroom" ? <ClassroomManagementForm /> : null}
              <section className="ux04-classroom-grid">{classroomCards.map((room, index) => { const ratio = room.capacity_limit ? Math.min(100, Math.round(((room.occupied + room.reserved) / room.capacity_limit) * 100)) : 0; return <Link className={`ux04-classroom-card tone-${(index % 4) + 1}`} href={`/dashboard/garden/children?section=classrooms&classroom=${room.id}`} key={room.id}><div className="ux04-classroom-art"><GraduationCap size={34} /><span>{room.age_group_label ?? "כיתת גן"}</span></div><header><div><h3>{room.name}</h3><p>{room.age_group_label ?? room.age_group_key}</p></div><MoreHorizontal size={20} /></header><div className="ux04-capacity-line"><span style={{ width: `${ratio}%` }} /></div><p><b>{room.occupied}{room.reserved ? ` + ${room.reserved}` : ""}</b><span>{room.capacity_limit ? `מתוך ${room.capacity_limit}` : "קיבולת טרם הוגדרה"}</span></p><footer><StatusChip tone={room.overCapacity ? "danger" : room.available === 0 ? "warning" : "success"}>{room.overCapacity ? "חריגה" : room.available == null ? "נדרשת הגדרה" : room.available === 0 ? "מלא" : `${room.available} מקומות`}</StatusChip><span>{(room.staff_classroom_assignments ?? []).filter((assignment) => assignment.status === "active").length} אנשי צוות</span></footer></Link>; })}</section>
              {classDetail ? <section className="ux04-classroom-detail"><header><div><span className="ux04-eyebrow">כיתה נבחרת</span><h3>{classDetail.name}</h3><p>{classDetail.age_group_label ?? classDetail.age_group_key} · {classDetail.occupied} ילדים · {classDetail.reserved} מקומות שמורים</p></div><StatusChip tone={classDetail.overCapacity ? "danger" : classDetail.available === 0 ? "warning" : "success"}>{classDetail.overCapacity ? "חריגה מקיבולת" : classDetail.available == null ? "קיבולת לא הוגדרה" : `${classDetail.available} מקומות פנויים`}</StatusChip></header><div className="ux04-classroom-detail-grid"><div><h4>ילדי הכיתה</h4>{classChildren.length ? classChildren.map((child) => <Link className="ux04-class-child" href={`/dashboard/garden/children/${child.id}`} key={String(child.id)}><Avatar name={String(child.full_name ?? "ילד/ה")} src={typeof child.photo_url === "string" ? child.photo_url : undefined} size="sm" /><span><b>{String(child.full_name ?? "ילד/ה")}</b><small>{ageText(typeof child.birth_date === "string" ? child.birth_date : null)}</small></span><StatusChip tone={(attendanceLabels[child.attendanceStatus] ?? attendanceLabels.not_updated).tone}>{(attendanceLabels[child.attendanceStatus] ?? attendanceLabels.not_updated).label}</StatusChip></Link>) : <p className="ux04-empty-copy">אין ילדים משויכים לכיתה.</p>}</div><ClassroomManagementForm classroom={classDetail} /></div></section> : classrooms.length ? <p className="ux04-selection-hint">בחרו כיתה כדי לראות ילדים, צוות, קיבולת ועריכה.</p> : <TeacherEmptyState title="עדיין אין כיתות" text="צרו כיתה ראשונה. קבוצת גיל מסווגת את הכיתה אך אינה מחליפה אותה." action={<Link className="button primary" href="/dashboard/garden/children?section=classrooms&new=classroom">הוספת כיתה</Link>} />}
            </>
          )}
        </div>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
