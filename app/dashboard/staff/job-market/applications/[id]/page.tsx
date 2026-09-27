import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Building2, CalendarDays, CircleAlert, FileCheck2, MessageCircle, ShieldCheck } from "lucide-react";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { ApplicationTimeline, RecruitmentTabs } from "@/components/recruitment-ui";
import { StaffApplicationActions } from "@/components/staff-application-actions";
import { StaffAppFrame, StaffSection } from "@/components/staff-app-ui";
import { requireRole } from "@/lib/auth";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { recruitmentApplicationState } from "@/lib/domain/recruitment-display";
import { createClient } from "@/lib/supabase/server";

type Application = { id: string; status: string; opening_id: string; requested_role?: string | null; submitted_at?: string | null; reviewed_at?: string | null; decided_at?: string | null; information_request?: string | null; candidate_response?: string | null; decision_reason?: string | null; requirement_snapshot?: { qualification_keys?: string[] } | null; gardens?: { name?: string | null; city?: string | null } | null; kindergarten_staff_openings?: { role_needed?: string | null; age_group?: string | null; employment_type?: string | null } | null };

export default async function CandidateApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const result = await supabase.from("staff_job_applications" as never).select("id,status,opening_id,requested_role,submitted_at,reviewed_at,decided_at,information_request,candidate_response,decision_reason,requirement_snapshot,gardens(name,city),kindergarten_staff_openings(role_needed,age_group,employment_type)" as never).eq("id", id).eq("staff_candidate_id", profile.id).maybeSingle();
  const application = result.data as unknown as Application | null;
  if (!application) return <StaffAppFrame active="applications" mode="candidate"><RecruitmentTabs active="applications" /><section className="ux08-state-card danger"><CircleAlert /><h1>המועמדות אינה זמינה</h1><p>הקישור אינו שייך לחשבון או שהמידע אינו זמין כעת.</p><Link className="button primary" href="/dashboard/staff/job-market#applications">חזרה למועמדויות</Link></section></StaffAppFrame>;
  const state = recruitmentApplicationState(application.status);
  const role = application.requested_role ?? application.kindergarten_staff_openings?.role_needed ?? "צוות גן";
  return <StaffAppFrame active="applications" mode="candidate" profileName={profile.full_name} avatarUrl={profile.profile_image_url}>
    <RecruitmentTabs active="applications" />
    <Link className="ux08-back-link" href="/dashboard/staff/job-market#applications"><ArrowRight /> חזרה למועמדויות</Link>
    <section className={`ux08-application-detail-hero state-${state.tone}`}><span className="ux08-card-icon"><BriefcaseBusiness /></span><div><span className="ux08-eyebrow">המועמדות שלי</span><h1>{role}</h1><p>{cleanSyntheticLabel(application.gardens?.name, "גן ילדים")} · {cleanSyntheticLabel(application.gardens?.city, "")}</p></div><StatusChip tone={state.tone}>{state.label}</StatusChip></section>
    <StaffSection title="איפה הדברים עומדים"><ApplicationTimeline status={application.status} /></StaffSection>
    <section className="ux08-application-detail-grid">
      <StaffSection title="פרטי הבקשה"><div className="ux08-detail-facts"><span><Building2 /><small>גן</small><b>{cleanSyntheticLabel(application.gardens?.name, "גן ילדים")}</b></span><span><CalendarDays /><small>נשלחה</small><b>{application.submitted_at ? new Date(application.submitted_at).toLocaleDateString("he-IL") : "לא תועד"}</b></span><span><FileCheck2 /><small>מסגרת</small><b>{application.kindergarten_staff_openings?.employment_type ?? "לא פורסמה"}</b></span><span><ShieldCheck /><small>גישה לגן</small><b>{application.status === "employed" ? "הופעלה" : "עדיין חסומה"}</b></span></div></StaffSection>
      <StaffSection title="הפעולה הבאה"><div className="ux08-next-action-panel">{application.information_request ? <p className="ux08-info-required"><CircleAlert /> {application.information_request}</p> : null}{application.candidate_response ? <p><MessageCircle /> ההשלמה ששלחת: {application.candidate_response}</p> : null}{application.decision_reason && application.status === "rejected" ? <p className="ux08-rejection-note">הודעה בטוחה מהמעסיק: {application.decision_reason}</p> : null}<StaffApplicationActions openingId={application.opening_id} applicationId={application.id} status={application.status} /></div></StaffSection>
    </section>
    {application.status === "awaiting_candidate_acceptance" ? <section className="ux08-state-card success"><ShieldCheck /><h2>הצעה מוכנה לאישור</h2><p>האישור מפעיל את ההעסקה בעסקה אחת, קובע את הקשר הגן וההרשאות, ורק אז מעביר לפלטפורמת הצוות הפעיל.</p></section> : null}
    {application.status === "rejected" ? <section className="ux08-state-card danger"><CircleAlert /><h2>המועמדות לא המשיכה</h2><p>ההיסטוריה נשמרת, והפרופיל שלך נשאר זמין להזדמנויות אחרות. הערות פנימיות של הגן אינן מוצגות.</p></section> : null}
  </StaffAppFrame>;
}
