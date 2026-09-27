import Link from "next/link";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, CalendarDays, CircleAlert, FileCheck2, GraduationCap, MapPin, MessageCircle, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { StaffApplicationActionButtons } from "@/components/garden-request-action-buttons";
import { ApplicationTimeline, CompletenessRing } from "@/components/recruitment-ui";
import { ApplicationDecisionForm } from "@/components/self-service-forms";
import { TeacherAppFrame, TeacherSection } from "@/components/teacher-app-ui";
import { requireRole } from "@/lib/auth";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { recruitmentApplicationState, recruitmentQualificationLabel } from "@/lib/domain/recruitment-display";
import { resolveManagementGardenContext } from "@/lib/management/active-garden-context";
import { createClient } from "@/lib/supabase/server";

const actions = [{ value: "review", label: "העברה לבדיקה" }, { value: "request_information", label: "בקשת מידע נוסף" }, { value: "approve", label: "שליחת הצעה" }, { value: "reject", label: "דחייה" }];
type Candidate = { full_name?: string | null; profile_photo_url?: string | null; phone?: string | null; email?: string | null; city?: string | null; professional_role?: string | null; qualification_keys?: string[] | null; preferred_age_groups?: string[] | null; employment_preference?: string | null; professional_summary?: string | null; work_experience?: string | null; profile_completeness?: { percentage?: number; blockers?: string[] } | null; document_status?: { required_documents_ready?: boolean } | null };
type Application = { id: string; staff_candidate_id: string; opening_id?: string | null; status: string; requested_role?: string | null; submitted_at?: string | null; reviewed_at?: string | null; information_request?: string | null; candidate_response?: string | null; decision_reason?: string | null; classroom_id?: string | null; staff_candidate_profiles?: Candidate | null; kindergarten_staff_openings?: { role_needed?: string | null; age_group?: string | null; employment_type?: string | null; requirements?: string | null } | null };

export default async function ManagerCandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const context = await resolveManagementGardenContext(profile);
  const gardenId = context.activeGarden?.id ?? "";
  const [applicationResult, classroomsResult] = await Promise.all([
    supabase.from("staff_job_applications" as never).select("id,staff_candidate_id,opening_id,status,requested_role,submitted_at,reviewed_at,information_request,candidate_response,decision_reason,classroom_id" as never).eq("id", id).eq("garden_id", gardenId).maybeSingle(),
    supabase.from("classrooms" as never).select("id,name" as never).eq("garden_id", gardenId).eq("status", "active").order("name")
  ]);
  const applicationBase = applicationResult.data as unknown as Application | null;
  const classrooms = (classroomsResult.data ?? []) as unknown as Array<{ id: string; name: string }>;
  if (!applicationBase) return <DashboardShell role="manager" title="פרטי מועמדת" appHome><TeacherAppFrame title="מרכז הגיוס" active="more"><section className="ux08-state-card danger"><CircleAlert /><h1>המועמדות אינה זמינה</h1><p>היא אינה שייכת לגן הפעיל או שכבר אינה זמינה.</p><Link className="button primary" href="/dashboard/garden/staff-applications">חזרה לגיוס</Link></section></TeacherAppFrame></DashboardShell>;
  const [candidateResult, openingResult] = await Promise.all([
    supabase.from("staff_candidate_profiles" as never).select("full_name,profile_photo_url,phone,email,city,professional_role,qualification_keys,preferred_age_groups,employment_preference,professional_summary,work_experience,profile_completeness,document_status" as never).eq("profile_id", applicationBase.staff_candidate_id).maybeSingle(),
    applicationBase.opening_id ? supabase.from("kindergarten_staff_openings" as never).select("role_needed,age_group,employment_type,requirements" as never).eq("id", applicationBase.opening_id).eq("garden_id", gardenId).maybeSingle() : Promise.resolve({ data: null })
  ]);
  const application: Application = {
    ...applicationBase,
    staff_candidate_profiles: candidateResult.data as unknown as Candidate | null,
    kindergarten_staff_openings: openingResult.data as unknown as Application["kindergarten_staff_openings"]
  };
  const candidate = application.staff_candidate_profiles;
  const state = recruitmentApplicationState(application.status);
  const name = candidate?.full_name ?? "מועמד/ת";
  const role = application.requested_role ?? application.kindergarten_staff_openings?.role_needed ?? candidate?.professional_role ?? "צוות גן";
  const completeness = Number(candidate?.profile_completeness?.percentage ?? 0);

  return <DashboardShell role="manager" title={name} appHome>
    <TeacherAppFrame title={cleanSyntheticLabel(profile.full_name, "מנהלת")} subtitle="סקירת מועמדות" avatarUrl={profile.profile_image_url} active="more">
      <Link className="ux08-back-link" href="/dashboard/garden/staff-applications"><ArrowRight /> חזרה למועמדות</Link>
      <section className="ux08-manager-candidate-hero">
        <Avatar name={name} src={candidate?.profile_photo_url} size="lg" />
        <div><span className="ux08-eyebrow">פרופיל מועמדת</span><h1>{name}</h1><p>{role}{candidate?.city ? ` · ${candidate.city}` : ""}</p><div><StatusChip tone={state.tone}>{state.label}</StatusChip><StatusChip tone={candidate?.document_status?.required_documents_ready ? "success" : "warning"}><FileCheck2 /> {candidate?.document_status?.required_documents_ready ? "מסמכי חובה מוכנים" : "מסמכים דורשים השלמה"}</StatusChip></div></div>
        <CompletenessRing percentage={completeness} />
      </section>
      <nav className="ux08-profile-subnav" aria-label="פרטי המועמדת"><a href="#profile">פרטים אישיים</a><a href="#experience">ניסיון</a><a href="#documents">מסמכים</a><a href="#decision">החלטה</a></nav>

      <section className="ux08-manager-candidate-grid" id="profile">
        <TeacherSection title="זהות מקצועית" subtitle="רק מידע שנדרש לקבלת החלטת גיוס">
          <div className="ux08-detail-facts"><span><BriefcaseBusiness /><small>תפקיד מבוקש</small><b>{role}</b></span><span><MapPin /><small>מיקום</small><b>{candidate?.city ?? "לא צוין"}</b></span><span><CalendarDays /><small>היקף מועדף</small><b>{candidate?.employment_preference ?? "גמיש"}</b></span><span><ShieldCheck /><small>גישה תפעולית</small><b>{application.status === "employed" ? "פעילה" : "חסומה עד הפעלה"}</b></span></div>
        </TeacherSection>
        <TeacherSection title="מסלול המועמדות" subtitle="היסטוריה נשמרת, בלי קיצורי דרך"><ApplicationTimeline status={application.status} />{application.information_request ? <p className="ux08-info-required"><CircleAlert /> התבקשה השלמה: {application.information_request}</p> : null}{application.candidate_response ? <p className="ux08-candidate-response"><MessageCircle /> תשובת המועמדת: {application.candidate_response}</p> : null}</TeacherSection>
      </section>

      <section className="ux08-manager-candidate-grid" id="experience">
        <TeacherSection title="ניסיון וגישה חינוכית" subtitle="הצהרת המועמדת"><div className="ux08-rich-copy"><GraduationCap /><p>{candidate?.professional_summary || candidate?.work_experience || "לא נוסף עדיין תקציר מקצועי."}</p></div></TeacherSection>
        <TeacherSection title="כישורים והסמכות" subtitle="לפי הפרופיל הקנוני"><div className="ux08-qualification-list">{(candidate?.qualification_keys ?? []).map((item) => <span key={item}><BadgeCheck /> {recruitmentQualificationLabel(item)}</span>)}{(candidate?.qualification_keys ?? []).length === 0 ? <p>לא נוספו הסמכות.</p> : null}</div></TeacherSection>
      </section>

      <section className="ux08-manager-document-summary" id="documents"><FileCheck2 /><div><h2>מצב מסמכים</h2><p>המערכת מציגה רק מוכנות קנונית. מסמך שהועלה אינו נחשב מאומת עד לסיום הבדיקה.</p></div><StatusChip tone={candidate?.document_status?.required_documents_ready ? "success" : "warning"}>{candidate?.document_status?.required_documents_ready ? "מוכן" : "דורש טיפול"}</StatusChip></section>

      <section className="ux08-manager-decision" id="decision">
        <div><span className="ux08-eyebrow">פעולה הבאה</span><h2>החלטת גיוס</h2><p>שליחת הצעה אינה מפעילה גישה. ההעסקה נוצרת רק לאחר קבלת ההצעה מצד המועמדת והשלמת העסקה הקנונית.</p><StaffApplicationActionButtons applicationId={application.id} /></div>
        <ApplicationDecisionForm endpoint={`/api/garden/staff-applications/${application.id}`} actions={actions} classrooms={classrooms} />
      </section>
    </TeacherAppFrame>
  </DashboardShell>;
}
