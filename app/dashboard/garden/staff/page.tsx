import Link from "next/link";
import { PermissionDeniedState } from "@/components/global-state-system";
import { israelTodayDateKey } from "@/lib/domain/israel-date";
import { StaffProfileCards } from "@/components/people-profile-cards";
import { TeachingAssignmentsPanel } from "@/components/teaching-assignments-panel";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { ClipboardCheck, ShieldCheck, UserCheck, UsersRound } from "lucide-react";
import { RoleAppShell } from "@/components/role-app-shell";
import {
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

type TeachingAssignmentRow = { id: string; profile_id: string; staff_id: string | null; assignment_kind: string; title: string; status: string };
type GardenTeachingRow = { owner_profile_id: string | null; ownership_type: string };
type EmploymentRow = { staff_id: string; status: string; role_title: string | null; start_date: string | null; approved_at: string | null };

export default async function GardenStaffPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const filters = await searchParams;
  const access = await getManagementGardenContext();
  if (!access.allowed) return <PermissionDeniedState backHref="/dashboard/garden" description="הצגת צוות הגן מוגבלת לבעלי תפקיד מורשים בגן הפעיל." />;
  const profile = access.session.profile;
  const supabase = await createClient();
  const gardenId = access.gardenId;
  const today = israelTodayDateKey();
  const [staffRes, docsRes, tasksRes, shiftsRes, certsRes, anomaliesRes, scoresRes, gardenRes, assignmentsRes, employmentsRes] = await Promise.all([
    supabase.from("staff" as any).select("id, profile_id, full_name, role_title, phone, email, approved_to_work, onboarding_status, background_check_status, police_clearance_status, class_group, profile_photo_url, manager_approved_at, inspector_verified_at, created_at").eq("garden_id", gardenId).order("full_name"),
    supabase.from("documents" as any).select("staff_id, id, status").eq("garden_id", gardenId),
    supabase.from("tasks" as any).select("assigned_to, id, status").eq("garden_id", gardenId).neq("status", "done"),
    supabase.from("staff_shifts" as any).select("staff_id, actual_start, actual_end, shift_date, attendance_confidence, confidence_score, total_minutes, status").eq("garden_id", gardenId).eq("shift_date", today),
    supabase.from("staff_certificates" as any).select("staff_id, id").eq("garden_id", gardenId),
    supabase.from("staff_workforce_anomalies" as any).select("staff_id, id, anomaly_type, severity, status").eq("garden_id", gardenId).in("status", ["requires_review", "reviewing"]),
    supabase.from("staff_workforce_scores" as any).select("staff_id, readiness_score, attendance_score, document_score, compliance_score").eq("garden_id", gardenId).eq("score_date", today),
    supabase.from("gardens" as never).select("owner_profile_id, ownership_type").eq("id", gardenId).maybeSingle(),
    supabase.from("garden_teaching_assignments" as never).select("id, profile_id, staff_id, assignment_kind, title, status").eq("garden_id", gardenId),
    supabase.from("staff_kindergarten_employments" as never).select("staff_id,status,role_title,start_date,approved_at" as never).eq("garden_id", gardenId).limit(500)
  ]);
  const countBy = (rows: any[], key: string, predicate = (_row: any) => true) => rows.reduce((map, row) => predicate(row) ? map.set(row[key], (map.get(row[key]) ?? 0) + 1) : map, new Map<string, number>());
  const missingDocs = countBy((docsRes.data ?? []) as any[], "staff_id", (row) => ["missing", "expired", "rejected"].includes(row.status));
  const certs = countBy((certsRes.data ?? []) as any[], "staff_id");
  const tasks = countBy((tasksRes.data ?? []) as any[], "assigned_to");
  const anomalies = countBy((anomaliesRes.data ?? []) as any[], "staff_id");
  const shifts = new Map(((shiftsRes.data ?? []) as any[]).map((row) => [row.staff_id, row]));
  const scores = new Map(((scoresRes.data ?? []) as any[]).map((row) => [row.staff_id, row]));
  const employments = new Map(((employmentsRes.data ?? []) as unknown as EmploymentRow[]).map((row) => [row.staff_id, row]));
  const rows = ((staffRes.data ?? []) as any[]).map((member) => {
    const missing = missingDocs.get(member.id) ?? 0;
    const compliance = Math.max(0, 100 - missing * 25 - (member.approved_to_work ? 0 : 35) - (member.background_check_status === "valid" ? 0 : 20) - (member.police_clearance_status === "valid" ? 0 : 20));
    const shift = shifts.get(member.id) as any;
    const score = scores.get(member.id) as any;
    const employment = employments.get(member.id);
    return {
      ...member,
      full_name: cleanSyntheticLabel(member.full_name, "איש/ת צוות"),
      role_title: cleanSyntheticLabel(employment?.role_title ?? member.role_title, "צוות"),
      approval_status: employment?.status ?? (member.approved_to_work ? "active" : "pending"),
      employment_status: employment?.status ?? "pending",
      employment_start_date: employment?.start_date ?? member.created_at,
      missing_documents: missing,
      certificate_count: certs.get(member.id) ?? 0,
      task_count: tasks.get(member.profile_id) ?? 0,
      anomaly_count: anomalies.get(member.id) ?? 0,
      compliance_score: score?.readiness_score ?? compliance,
      attendance_confidence: shift?.attendance_confidence ?? "requires_review",
      shift_today: shift?.actual_start ? `זוהה/תה ${new Date(shift.actual_start).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}` : null
    };
  });
  const query = String(filters.q ?? "").trim().toLocaleLowerCase("he-IL");
  const status = String(filters.status ?? "all");
  const visibleRows = rows.filter((row) => {
    const matchesQuery = !query || [row.full_name, row.role_title, row.class_group].some((value) => String(value ?? "").toLocaleLowerCase("he-IL").includes(query));
    const matchesStatus = status === "all" || row.employment_status === status || (status === "active" && row.approved_to_work);
    return matchesQuery && matchesStatus;
  });
  const activeToday = rows.filter((row) => row.shift_today).length;
  const reviewNeeded = rows.reduce((sum, row) => sum + Number(row.anomaly_count ?? 0), 0) + rows.filter((row) => row.attendance_confidence === "requires_review" && row.shift_today).length;
  const assignments = (assignmentsRes.data ?? []) as unknown as TeachingAssignmentRow[];
  const ownerAssignment = assignments.find((assignment) => assignment.assignment_kind === "owner_teacher") ?? null;
  const gardenTeaching = gardenRes.data as unknown as GardenTeachingRow | null;
  const ownerEligible = profile.role === "owner" && gardenTeaching?.owner_profile_id === profile.id && gardenTeaching?.ownership_type === "teacher_is_owner";

  const shellRole = profile.role === "owner" ? "owner" : "manager";
  return (
    <RoleAppShell role={shellRole} activeHref="/dashboard/garden/staff" title="צוות הגן" subtitle="העסקה, משמרות, מסמכים ושעות" profile={profile} className="staff-runtime-shell ux07-manager-staff-shell">
      <main className="ux07-manager-workspace ux07-staff-directory-shell">
        <section className="ux07-page-hero"><div><span>ניהול צוות פעיל</span><h1>צוות הגן</h1><p>כל אנשי הצוות, ההעסקות הפעילות והפעולות שדורשות תשומת לב במקום אחד.</p></div><div className="profile-actions"><Link className="gb-primary-button" href="/dashboard/garden/staff-applications">הוספת איש צוות</Link><Link className="button secondary" href="/dashboard/garden/staff-time">משמרות ושעות</Link></div></section>
      <div className="dashboard-runtime-content">
        <section className="ux07-staff-directory-toolbar" aria-label="חיפוש וסינון צוות">
          <form><label><span className="sr-only">חיפוש איש צוות</span><input name="q" defaultValue={filters.q ?? ""} placeholder="חיפוש לפי שם, תפקיד או כיתה" /></label><input type="hidden" name="status" value={status} /><button type="submit">חיפוש</button></form>
          <nav aria-label="סינון מצב העסקה"><Link className={status === "all" ? "active" : ""} href="/dashboard/garden/staff">הכול ({rows.length})</Link><Link className={status === "active" ? "active" : ""} href="/dashboard/garden/staff?status=active">פעילים ({rows.filter((row) => row.approved_to_work).length})</Link><Link className={status === "pending" ? "active" : ""} href="/dashboard/garden/staff?status=pending">ממתינים ({rows.filter((row) => !row.approved_to_work).length})</Link></nav>
        </section>
        <div className="ux07-staff-directory-metrics"><TeacherStatsGrid>
          <TeacherStatCard title="אנשי צוות" value={rows.length} hint="משויכים לגן" icon={UsersRound} tone="purple" />
          <TeacherStatCard title="זוהו היום" value={activeToday} hint="נוכחים" icon={UserCheck} tone="green" />
          <TeacherStatCard title="דורש בדיקה" value={reviewNeeded} hint="חריגות / GPS" icon={ShieldCheck} tone={reviewNeeded ? "red" : "green"} />
          <TeacherStatCard title="מוכנות ממוצעת" value={`${Math.round(rows.reduce((sum, row) => sum + Number(row.compliance_score), 0) / Math.max(rows.length, 1))}%`} hint="מסמכים ותעודות" icon={ClipboardCheck} tone="blue" />
        </TeacherStatsGrid></div>

        <section className="teacher-dashboard-grid">
          <TeacherSection title="צוות בתפקיד" action={<Link href="/dashboard/garden/staff-applications">מועמדויות</Link>}>
            {visibleRows.length ? (
              <TeacherCompactList>
                {visibleRows.slice(0, 8).map((member) => (
                  <TeacherCompactItem
                    key={member.id}
                    title={member.full_name ?? "איש צוות"}
                    subtitle={`${member.role_title ?? "צוות"} · ${member.class_group ?? "כל הגן"}`}
                    avatar={member.profile_photo_url}
                    tone={member.approved_to_work ? "green" : "orange"}
                    meta={member.shift_today ?? (member.approved_to_work ? "מאושר" : "ממתין")}
                  />
                ))}
              </TeacherCompactList>
            ) : (
              <TeacherEmptyState title="עדיין אין צוות משויך" text="אפשר להזמין איש צוות או לאשר מועמדות קיימת." />
            )}
          </TeacherSection>

          <TeacherSection title="מסמכים ותעודות" subtitle="בדיקת כשירות לפני עבודה עם ילדים">
            <TeacherCompactList>
              <TeacherCompactItem title="תעודות חסרות" subtitle="אישורי הכשרה / עזרה ראשונה" tone={rows.filter((row) => !row.certificate_count).length ? "orange" : "green"} meta={rows.filter((row) => !row.certificate_count).length} />
              <TeacherCompactItem title="משימות פתוחות" subtitle="משימות שהוקצו לצוות" tone="blue" meta={rows.reduce((sum, row) => sum + Number(row.task_count ?? 0), 0)} />
              <TeacherCompactItem title="בדיקות רקע" subtitle="אישור עבודה ומסמכים רגישים" tone={reviewNeeded ? "red" : "green"} meta={reviewNeeded ? "בדיקה" : "תקין"} />
            </TeacherCompactList>
          </TeacherSection>
        </section>

        <TeachingAssignmentsPanel ownerEligible={ownerEligible} ownerAssignment={ownerAssignment} assignments={assignments} staff={rows} />

        <StaffProfileCards staff={visibleRows} />
      </div>
      </main>
    </RoleAppShell>
  );
}
