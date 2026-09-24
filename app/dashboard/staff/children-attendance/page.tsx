import Link from "next/link";
import { CheckCircle2, Clock3, LogOut, ShieldCheck, UserRoundX, UsersRound } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { GardenAttendanceActionButton } from "@/components/garden-attendance-action-button";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffEmpty, StaffMetricCard, StaffPageHero, StaffSection, StaffStats } from "@/components/staff-app-ui";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";

type AttendanceState = "present" | "absent" | "departed" | "expected";

function stateOf(row?: Record<string, unknown>): AttendanceState {
  if (!row) return "expected";
  if (row.check_out_at || ["checked_out", "departed", "left_early"].includes(String(row.status))) return "departed";
  if (row.status === "absent") return "absent";
  if (row.check_in_at || ["present", "checked_in", "late"].includes(String(row.status))) return "present";
  return "expected";
}

function timeText(value?: unknown) {
  return typeof value === "string" ? new Date(value).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "—";
}

export default async function StaffChildrenAttendancePage() {
  const { profile, employment } = await requireOperationalRole(["staff"]);
  const supabase = await createClient();
  const gardenId = employment!.garden_id;
  const staffId = employment!.staff_id;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const teaching = await supabase.rpc("can_teach_in_garden" as never, { target_garden_id: gardenId, required_scope: "attendance" } as never);
  const assignmentsRes = await supabase.from("staff_classroom_assignments" as never).select("classroom_id,classrooms(id,name)" as never).eq("staff_id", staffId).eq("garden_id", gardenId).eq("status", "active").limit(100);
  const assignments = (assignmentsRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const classroomIds = assignments.map((item) => String(item.classroom_id)).filter(Boolean);
  const childAssignmentsRes = classroomIds.length ? await supabase.from("child_classroom_assignments" as never).select("child_id,classroom_id,classrooms(name)" as never).eq("garden_id", gardenId).eq("is_current", true).in("classroom_id", classroomIds).limit(500) : { data: [], error: null };
  const childAssignments = (childAssignmentsRes.data ?? []) as unknown as Array<Record<string, unknown>>;
  const childIds = childAssignments.map((item) => String(item.child_id)).filter(Boolean);
  const [childrenRes, attendanceRes] = childIds.length ? await Promise.all([
    supabase.from("children" as never).select("id,full_name,photo_url,status" as never).eq("garden_id", gardenId).in("id", childIds).order("full_name"),
    supabase.from("attendance" as never).select("child_id,status,check_in_at,check_out_at,pickup_name" as never).eq("garden_id", gardenId).eq("attendance_date", today).in("child_id", childIds)
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  const attendanceByChild = new Map(((attendanceRes.data ?? []) as unknown as Array<Record<string, unknown>>).map((item) => [String(item.child_id), item]));
  const assignmentByChild = new Map(childAssignments.map((item) => [String(item.child_id), item]));
  const rows: Array<{ id: string; fullName: string; photoUrl: string | null; state: AttendanceState; attendance?: Record<string, unknown>; classroomName: string }> = ((childrenRes.data ?? []) as unknown as Array<Record<string, unknown>>).map((child) => {
    const attendance = attendanceByChild.get(String(child.id));
    const assignment = assignmentByChild.get(String(child.id));
    const classroom = assignment?.classrooms as Record<string, unknown> | undefined;
    return { id: String(child.id), fullName: String(child.full_name ?? "ילד/ה"), photoUrl: typeof child.photo_url === "string" ? child.photo_url : null, state: stateOf(attendance), attendance, classroomName: String(classroom?.name ?? "כיתה") };
  });
  const count = (state: AttendanceState) => rows.filter((row) => row.state === state).length;
  const allowed = teaching.data === true && !teaching.error;

  return <StaffAppFrame active="more" profileName={profile.full_name} avatarUrl={(profile as { profile_image_url?: string | null }).profile_image_url ?? null}>
    <div className="ux06-staff-operations">
      <StaffPageHero eyebrow="נוכחות ילדים" title="הכיתות שלי היום" text="אפשר לעדכן רק ילדים בכיתות שהוקצו לך ובגן הפעיל." icon={UsersRound} badge={<StatusChip tone={allowed ? "success" : "danger"}>{allowed ? "הרשאת נוכחות פעילה" : "אין הרשאת נוכחות"}</StatusChip>} />
      <StaffStats>
        <StaffMetricCard title="ילדים בהיקף" value={rows.length} hint={assignments.length ? `${assignments.length} כיתות` : "אין כיתה משויכת"} icon={UsersRound} tone="blue" />
        <StaffMetricCard title="נוכחים" value={count("present")} hint="לפי רשומת שרת" icon={CheckCircle2} tone="green" />
        <StaffMetricCard title="דורש פעולה" value={count("expected") + count("absent")} hint="טרם הגיעו או נעדרים" icon={Clock3} tone="orange" />
      </StaffStats>
      <StaffSection title="נוכחות כיתתית" action={<Link className="button secondary tiny" href="/dashboard/staff/pickup">איסוף ושחרור</Link>}>
        {!allowed ? <StaffEmpty title="אין הרשאה לעדכון נוכחות" text="הגישה נקבעת לפי העסקה פעילה, גן, כיתה והרשאת תפקיד." icon={ShieldCheck} /> : rows.length ? <div className="ux06-staff-child-list">{rows.map((row) => {
          const meta = row.state === "present" ? { label: "נוכח/ת", tone: "success" as const, icon: CheckCircle2 } : row.state === "absent" ? { label: "נעדר/ת", tone: "danger" as const, icon: UserRoundX } : row.state === "departed" ? { label: "יצא/ה", tone: "info" as const, icon: LogOut } : { label: "טרם הגיע/ה", tone: "warning" as const, icon: Clock3 };
          const Icon = meta.icon;
          return <article key={row.id}><Avatar name={row.fullName} src={row.photoUrl} size="sm" /><span><b>{row.fullName}</b><small>{row.classroomName} · הגעה {timeText(row.attendance?.check_in_at)}</small></span><StatusChip tone={meta.tone}><Icon size={14} /> {meta.label}</StatusChip><GardenAttendanceActionButton childId={row.id} currentStatus={row.state === "expected" ? "not_updated" : row.state === "departed" ? "left_early" : row.state} /></article>;
        })}</div> : <StaffEmpty title="אין ילדים בהיקף הכיתתי" text="ילדים יופיעו רק לאחר שיוך כיתה פעיל ומורשה." icon={UsersRound} />}
      </StaffSection>
      <p className="ux06-authority-note"><ShieldCheck size={18} /> מצלמה או זיהוי פנים אינם יוצרים נוכחות. כל פעולה נבדקת שוב בשרת.</p>
    </div>
  </StaffAppFrame>;
}
