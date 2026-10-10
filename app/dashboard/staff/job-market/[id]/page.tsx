import Link from "next/link";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Building2, CalendarDays, FileCheck2, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { RecruitmentHero, RecruitmentTabs } from "@/components/recruitment-ui";
import { StaffApplicationActions } from "@/components/staff-application-actions";
import { StaffAppFrame, StaffEmpty, StaffSection } from "@/components/staff-app-ui";
import { requireRole } from "@/lib/auth";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { recruitmentMatchReason, recruitmentQualificationLabel } from "@/lib/domain/recruitment-display";
import { resolveStaffEmploymentContext } from "@/lib/management/staff-employment-context";
import { createClient } from "@/lib/supabase/server";

type Match = { id: string; garden_name?: string | null; city?: string | null; role_needed: string; qualification_keys?: string[] | null; age_group?: string | null; employment_type?: string | null; description?: string | null; match_level?: string | null; match_reasons?: string[] | null; application_status?: string | null };
type Application = { id: string; status: string };

export default async function CandidateJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const context = await resolveStaffEmploymentContext(profile);
  const [matchesRes, applicationRes] = await Promise.all([
    supabase.rpc("find_relevant_staff_jobs", { target_city: null, target_role: null, target_age_group: null, target_query: null }),
    supabase.from("staff_job_applications" as never).select("id,status" as never).eq("staff_candidate_id", profile.id).eq("opening_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle()
  ]);
  const job = ((matchesRes.data ?? []) as unknown as Match[]).find((item) => item.id === id);
  const application = applicationRes.data as unknown as Application | null;
  const candidateMode = !(context.available && context.employments.length);
  if (!job) return <StaffAppFrame active="jobs" mode={candidateMode ? "candidate" : "assigned"}><RecruitmentTabs active="jobs" /><StaffEmpty title="המשרה אינה זמינה" text="ייתכן שהמשרה נסגרה או שאינה פומבית עוד." icon={BriefcaseBusiness} /></StaffAppFrame>;

  return <StaffAppFrame active="jobs" mode={candidateMode ? "candidate" : "assigned"} profileName={profile.full_name} avatarUrl={profile.profile_image_url}>
    {candidateMode ? <RecruitmentTabs active="jobs" /> : null}
    <Link className="ux08-back-link" href="/dashboard/staff/job-market#opportunities"><ArrowRight /> חזרה למשרות</Link>
    <RecruitmentHero compact eyebrow={cleanSyntheticLabel(job.garden_name, "גן ילדים")} title={job.role_needed} text={job.description || "משרה משמעותית בצוות גן. הפרטים המוצגים כאן פומביים ובטוחים למועמדות."} action={<StaffApplicationActions openingId={job.id} applicationId={application?.id} status={application?.status ?? job.application_status} />} />
    <section className="ux08-job-detail-grid">
      <StaffSection title="פרטי המשרה"><div className="ux08-detail-facts"><span><Building2 /><small>גן</small><b>{cleanSyntheticLabel(job.garden_name, "גן ילדים")}</b></span><span><MapPin /><small>מיקום</small><b>{cleanSyntheticLabel(job.city, "לא פורסם")}</b></span><span><UsersRound /><small>קבוצת גיל</small><b>{job.age_group ?? "כל הקבוצות"}</b></span><span><CalendarDays /><small>מסגרת העסקה</small><b>{job.employment_type ?? "תפורט בהמשך"}</b></span></div></StaffSection>
      <StaffSection title="התאמה לפרופיל שלך"><div className="ux08-match-panel"><StatusChip tone={job.match_level === "exact_match" ? "success" : "info"}>{job.match_level === "exact_match" ? "התאמה מלאה לפי הנתונים" : "התאמה רלוונטית"}</StatusChip>{(job.match_reasons ?? []).map((reason) => <span key={reason}><BadgeCheck /> {recruitmentMatchReason(reason)}</span>)}</div></StaffSection>
    </section>
    <StaffSection title="דרישות והסמכות"><div className="ux08-requirements"><FileCheck2 /><div><h3>הסמכות נדרשות</h3><p>{(job.qualification_keys ?? []).map(recruitmentQualificationLabel).join(" · ") || "לא פורסמה דרישת הסמכה מובנית"}</p></div><ShieldCheck /><div><h3>גישה תפעולית</h3><p>אין גישה לילדים, נוכחות, איסוף או מצלמות לפני אישור וקבלת הצעה שמפעילים העסקה קנונית.</p></div></div></StaffSection>
  </StaffAppFrame>;
}
