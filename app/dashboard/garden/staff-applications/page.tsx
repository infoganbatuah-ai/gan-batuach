import { BriefcaseBusiness, CheckCircle2, FileCheck2, Plus, ShieldCheck, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StaffApplicationActionButtons } from "@/components/garden-request-action-buttons";
import { ApplicationDecisionForm, StaffOpeningForm } from "@/components/self-service-forms";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveManagementGardenContext } from "@/lib/management/active-garden-context";
import { StaffInvitationForm } from "@/components/staff-invitation-form";
import {
  TeacherActionTile,
  TeacherAiInsight,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

const actions = [
  { value: "review", label: "סימון בבדיקה" },
  { value: "request_information", label: "בקשת מידע נוסף" },
  { value: "approve", label: "אישור ושליחה לקבלת המועמד/ת" },
  { value: "reject", label: "דחייה" }
];

type StaffApplicationRow = {
  id: string;
  status: string;
  requested_role?: string | null;
  duplicate_flags?: unknown[] | null;
  kindergarten_staff_openings?: { role_needed?: string | null; age_group?: string | null; employment_type?: string | null } | null;
  staff_candidate_profiles?: { full_name?: string | null; phone?: string | null; professional_role?: string | null; qualification_keys?: string[] | null; work_experience?: string | null; document_status?: Record<string, unknown> | null; duplicate_flags?: unknown[] | null } | null;
};

export default async function GardenStaffApplicationsPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenContext = await resolveManagementGardenContext(profile);
  const gardenId = gardenContext.activeGarden?.id ?? "";
  const openingsRes = await supabase.from("kindergarten_staff_openings" as never).select("id,role_needed" as never).eq("garden_id", gardenId).eq("active_status", "published").order("created_at", { ascending: false });
  const openings = (openingsRes.data ?? []) as unknown as Array<{ id: string; role_needed: string }>;
  const rows = ((await supabase.from("staff_job_applications" as never)
    .select("*, kindergarten_staff_openings(role_needed,age_group,employment_type), staff_candidate_profiles:staff_candidate_id(full_name,phone,email,professional_role,qualification_keys,profile_completeness,city,work_experience,document_status,duplicate_flags)")
    .eq("garden_id", gardenId)
    .order("created_at", { ascending: false })
    .limit(100)).data ?? []) as unknown as StaffApplicationRow[];
  const pendingRows = rows.filter((row) => ["submitted", "under_review", "information_required", "resubmitted"].includes(String(row.status)));
  const approvedRows = rows.filter((row) => ["approved", "awaiting_candidate_acceptance", "employed"].includes(row.status));
  const duplicateRows = rows.filter((row) => Array.isArray(row.duplicate_flags) && row.duplicate_flags.length);
  const selected = rows[0];

  return (
    <DashboardShell role="manager" title="מועמדויות צוות" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="ניהול מועמדויות וצוות" avatarUrl={(profile as unknown as { profile_image_url?: string | null }).profile_image_url ?? null} active="more">
        <TeacherPageTitle icon={UsersRound} title="מועמדויות צוות" subtitle="אישור צוות חדש בלי לפתוח גישה לפני החלטה" action={<a className="button primary" href="#staff-opening"><Plus size={18} /> פתיחת משרה</a>} />

        <TeacherStatsGrid>
          <TeacherStatCard title="כל המועמדויות" value={rows.length} hint="הוגשו לגן" icon={UsersRound} tone="purple" />
          <TeacherStatCard title="בבדיקה" value={pendingRows.length} hint="לטיפול" icon={FileCheck2} tone={pendingRows.length ? "orange" : "green"} />
          <TeacherStatCard title="אושרו" value={approvedRows.length} hint="ממתינים לקבלה או הועסקו" icon={CheckCircle2} tone="green" />
          <TeacherStatCard title="כפילות אפשרית" value={duplicateRows.length} hint="דורש בדיקה" icon={ShieldCheck} tone={duplicateRows.length ? "red" : "blue"} />
        </TeacherStatsGrid>

        <section className="teacher-children-layout">
          <TeacherSection title="מועמדים אחרונים" subtitle="רק לאחר אישור נפתחת גישה לגן">
            {rows.length ? (
              <TeacherCompactList>
                {rows.slice(0, 7).map((row) => (
                  <TeacherCompactItem
                    key={row.id}
                    title={row.staff_candidate_profiles?.full_name ?? "מועמד/ת"}
                    subtitle={`${row.staff_candidate_profiles?.phone ?? "טלפון חסר"} · ${row.requested_role ?? row.kindergarten_staff_openings?.role_needed ?? "צוות"}`}
                    tone={row.status === "approved" ? "green" : row.status === "rejected" ? "red" : "orange"}
                    meta={row.status === "approved" ? "אושר" : row.status === "rejected" ? "נדחה" : "בדיקה"}
                  />
                ))}
              </TeacherCompactList>
            ) : (
              <TeacherEmptyState title="אין מועמדויות צוות" text="פתחי משרה ציבורית כדי שמועמדים יוכלו להגיש בקשה." />
            )}
          </TeacherSection>

          <TeacherSection title={selected?.staff_candidate_profiles?.full_name ?? "פרטי מועמד/ת"} subtitle={selected ? selected.staff_candidate_profiles?.work_experience ?? "ניסיון לא צוין" : "בחרי מועמד מהרשימה"}>
            {selected ? (
              <div className="teacher-request-detail">
                <TeacherCompactItem title="תפקיד מבוקש" subtitle={selected.requested_role ?? selected.kindergarten_staff_openings?.role_needed ?? "צוות גן"} tone="purple" meta={<BriefcaseBusiness size={16} />} />
                <TeacherCompactItem title="כשירות מקצועית" subtitle={`${selected.staff_candidate_profiles?.professional_role ?? "תפקיד לא הוגדר"} · ${(selected.staff_candidate_profiles?.qualification_keys ?? []).join(", ") || "ללא הסמכה מובנית"}`} tone="purple" meta={<ShieldCheck size={16} />} />
                <TeacherCompactItem title="מסמכים" subtitle={`${Object.keys(selected.staff_candidate_profiles?.document_status ?? {}).length} פריטים הועלו`} tone="blue" meta={<FileCheck2 size={16} />} />
                <TeacherCompactItem title="סטטוס גישה" subtitle="אין גישה לילדים או למסמכים לפני אישור מנהלת" tone="green" meta={<ShieldCheck size={16} />} />
                <StaffApplicationActionButtons applicationId={selected.id} />
              </div>
            ) : (
              <TeacherEmptyState title="אין מועמד להצגה" text="מועמדויות חדשות יוצגו כאן עם סטטוס ופעולות." />
            )}
          </TeacherSection>
        </section>

        <TeacherAiInsight>
          מועמד עצמאי נשאר במצב מוגבל עד אישור מנהלת. אין חשיפה לילדים, הורים או מסמכי גן לפני ההפעלה.
        </TeacherAiInsight>

        <TeacherQuickActions title="פעולות צוות">
          <TeacherActionTile title="פתיחת משרה" href="#staff-opening" icon={Plus} tone="purple" />
          <TeacherActionTile title="ניהול צוות" href="/dashboard/garden/staff" icon={UsersRound} tone="blue" />
          <TeacherActionTile title="מסמכים" href="/dashboard/garden/documents" icon={FileCheck2} tone="green" />
        </TeacherQuickActions>

        <details className="teacher-management-details" id="staff-opening">
          <summary>ניהול מלא של משרות ומועמדויות</summary>
          <StaffOpeningForm />
          <StaffInvitationForm openings={openings} />
          <section className="procedure-list">
            {rows.map((row) => (
              <article className="card procedure-card" key={row.id}>
                <div>
                  <span className={row.status === "approved" ? "pill good" : row.status === "rejected" ? "pill bad" : "pill warn"}>{row.status}</span>
                  <h3>{row.staff_candidate_profiles?.full_name ?? "מועמד/ת"}</h3>
                  <p>{row.staff_candidate_profiles?.phone ?? ""} · {row.requested_role ?? row.kindergarten_staff_openings?.role_needed ?? "צוות"}</p>
                  <small>{row.staff_candidate_profiles?.work_experience ?? "לא נוסף ניסיון"} · הסמכות: {(row.staff_candidate_profiles?.qualification_keys ?? []).join(", ") || "לא הוגדרו"} · מסמכים: {Object.keys(row.staff_candidate_profiles?.document_status ?? {}).length}</small>
                  {Array.isArray(row.duplicate_flags) && row.duplicate_flags.length ? <span className="pill warn">כפילות אפשרית לבדיקה</span> : null}
                </div>
                <div className="procedure-meta">
                  <FileCheck2 />
                  <ApplicationDecisionForm endpoint={`/api/garden/staff-applications/${row.id}`} actions={actions} />
                </div>
              </article>
            ))}
            {rows.length === 0 ? <div className="empty-state"><UsersRound /><strong>אין מועמדויות צוות</strong><span>פתחו משרה ציבורית כדי שמועמדים יוכלו להגיש בקשה.</span></div> : null}
          </section>
          <section className="manager-report-row"><span><BriefcaseBusiness /> מועמדות עצמאית אינה פותחת גישה עד אישור מנהלת.</span></section>
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
