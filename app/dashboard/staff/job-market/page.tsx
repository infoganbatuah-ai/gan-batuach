import Link from "next/link";
import { Bell, BriefcaseBusiness, Building2, FileCheck2, Search, Sparkles, UserRound } from "lucide-react";
import { FormField, SearchFilterBar, StatusChip } from "@/components/gan-batuach-design-system";
import { StaffApplicationActions } from "@/components/staff-application-actions";
import { StaffAppFrame, StaffEmpty, StaffSection } from "@/components/staff-app-ui";
import { ApplicationCard, CandidateIdentity, CompletenessRing, RecruitmentHero, RecruitmentJobCard, RecruitmentMetric, RecruitmentTabs } from "@/components/recruitment-ui";
import { requireRole } from "@/lib/auth";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { recruitmentBlockerLabel } from "@/lib/domain/recruitment-display";
import { resolveStaffEmploymentContext } from "@/lib/management/staff-employment-context";
import { createClient } from "@/lib/supabase/server";

type CandidateProfile = {
  full_name?: string | null; profile_photo_url?: string | null; city?: string | null; professional_role?: string | null;
  qualification_keys?: string[] | null; availability?: { days?: string[]; notes?: string } | null;
  preferred_age_groups?: string[] | null; employment_preference?: string | null; professional_summary?: string | null;
  matching_paused?: boolean; status?: string | null;
};
type Completeness = { percentage?: number; blockers?: string[]; status?: string; required_fields_complete?: boolean; documents_ready?: boolean };
type JobMatch = { id: string; garden_id: string; garden_name?: string | null; city?: string | null; role_needed: string; qualification_keys?: string[] | null; age_group?: string | null; employment_type?: string | null; description?: string | null; match_level?: string | null; match_reasons?: string[] | null; application_status?: string | null };
type ApplicationRow = {
  id: string; opening_id: string | null; status: string; submitted_at?: string | null; information_request?: string | null;
  gardens?: { name?: string | null } | null;
  kindergarten_staff_openings?: { role_needed?: string | null } | null;
};

export default async function StaffJobMarketPage({ searchParams }: { searchParams?: Promise<{ city?: string; q?: string }> }) {
  const { profile } = await requireRole(["staff"]);
  const params = await searchParams;
  const supabase = await createClient();
  const employmentContext = await resolveStaffEmploymentContext(profile);
  const isAssigned = Boolean(employmentContext.available && employmentContext.employments.length);
  const [candidateRes, completenessRes, matchesRes, applicationsRes, documentsRes, unreadRes] = await Promise.all([
    supabase.from("staff_candidate_profiles" as never).select("profile_id,full_name,profile_photo_url,city,professional_role,qualification_keys,availability,preferred_age_groups,employment_preference,professional_summary,matching_paused,profile_completeness,status" as never).eq("profile_id", profile.id).maybeSingle(),
    supabase.rpc("evaluate_staff_candidate_profile", { target_profile_id: profile.id }),
    supabase.rpc("find_relevant_staff_jobs", { target_city: params?.city ?? null, target_role: null, target_age_group: null, target_query: params?.q ?? null }),
    supabase.from("staff_job_applications" as never).select("id,opening_id,status,submitted_at,information_request,gardens(name),kindergarten_staff_openings(role_needed)" as never).eq("staff_candidate_id", profile.id).order("created_at", { ascending: false }).limit(30),
    supabase.from("staff_candidate_documents" as never).select("id,status" as never, { count: "exact" }).eq("profile_id", profile.id).is("deleted_at", null),
    supabase.from("notifications" as never).select("id" as never, { count: "exact", head: true }).or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id}`).eq("entity_type", "staff_job_applications").is("read_at", null)
  ]);
  const candidate = candidateRes.data as unknown as CandidateProfile | null;
  const completeness = completenessRes.data as unknown as Completeness | null;
  const matches = (matchesRes.data ?? []) as unknown as JobMatch[];
  const applications = (applicationsRes.data ?? []) as unknown as ApplicationRow[];
  const applicationsByOpening = new Map(applications.filter((row) => row.opening_id).map((row) => [row.opening_id!, row]));
  const percentage = Number(completeness?.percentage ?? 0);
  const openApplications = applications.filter((row) => !["rejected", "withdrawn", "cancelled", "employed"].includes(row.status));
  const invitationCount = applications.filter((row) => row.status === "awaiting_candidate_acceptance").length;
  const name = candidate?.full_name || profile.full_name || "מועמד/ת לצוות";
  const nextAction = !candidate ? "התחילו בפרופיל המקצועי" : !completeness?.documents_ready ? "העלו מסמך הסמכה" : openApplications.length ? "בדקו עדכונים במועמדויות" : "בחרו משרה מתאימה";

  return <StaffAppFrame active="jobs" mode={isAssigned ? "assigned" : "candidate"} profileName={name} avatarUrl={candidate?.profile_photo_url ?? profile.profile_image_url}>
    {!isAssigned ? <RecruitmentTabs active="home" /> : null}
    <RecruitmentHero
      eyebrow={isAssigned ? "אפשרויות נוספות" : "מרכז המועמדות שלך"}
      title={isAssigned ? "משרות נוספות בגנים" : `הצעד הבא בקריירה שלך, ${name.split(" ")[0]}`}
      text="פרופיל מקצועי אחד, מסמכים פרטיים ומסלול ברור מהתאמה ועד הפעלת העסקה. גישה לגן נפתחת רק לאחר הפעלה קנונית."
      action={<><Link className="button primary large" href="#opportunities"><Search /> מציאת משרה</Link><Link className="button secondary" href="/dashboard/staff/settings"><UserRound /> עדכון פרופיל</Link></>}
    />

    <section className="ux08-metrics-grid" aria-label="מצב המועמדות">
      <RecruitmentMetric icon={BriefcaseBusiness} value={matches.length} label="משרות רלוונטיות" tone="green" />
      <RecruitmentMetric icon={Sparkles} value={openApplications.length} label="מועמדויות פעילות" tone="purple" />
      <RecruitmentMetric icon={Building2} value={invitationCount} label="הצעות שמחכות לך" tone="orange" />
      <RecruitmentMetric icon={Bell} value={unreadRes.count ?? 0} label="עדכוני גיוס חדשים" tone="blue" />
    </section>

    <section className="ux08-candidate-dashboard-grid">
      <article className="ux08-profile-summary-card">
        <CandidateIdentity name={name} role={candidate?.professional_role} city={candidate?.city} photo={candidate?.profile_photo_url ?? profile.profile_image_url} status={candidate?.status} />
        <div className="ux08-profile-progress"><CompletenessRing percentage={percentage} /><div><span className="ux08-eyebrow">השלב הבא</span><h2>{nextAction}</h2><p>{completeness?.required_fields_complete ? "הפרופיל מוכן להגשת מועמדות." : "השלימו את הפריטים החסרים כדי להגיש בבטחה."}</p></div></div>
        {completeness?.blockers?.length ? <div className="ux08-missing-list">{completeness.blockers.map((item) => <Link href={item === "required_documents_pending" ? "/dashboard/staff/documents" : "/dashboard/staff/settings"} key={item}><span /> {recruitmentBlockerLabel(item)}</Link>)}</div> : <div className="ux08-ready-banner"><FileCheck2 /> כל פרטי החובה הושלמו · {documentsRes.count ?? 0} מסמכים פרטיים</div>}
      </article>
      <article className="ux08-next-actions-card"><span className="ux08-eyebrow">מסלול הקבלה</span><h2>כל מה שצריך, במקום אחד</h2><ol><li className={percentage >= 70 ? "done" : "current"}><b>1</b><span><strong>פרופיל מקצועי</strong><small>כישורים, ניסיון והעדפות</small></span></li><li className={completeness?.documents_ready ? "done" : "current"}><b>2</b><span><strong>מסמכים ותעודות</strong><small>העלאה אינה אימות</small></span></li><li className={openApplications.length ? "done" : "current"}><b>3</b><span><strong>מועמדות לגן</strong><small>סטטוס והשלמות בזמן אמת</small></span></li><li className={invitationCount ? "current" : ""}><b>4</b><span><strong>קבלת הצעה</strong><small>הפעלה בטוחה לעובד/ת פעיל/ה</small></span></li></ol></article>
    </section>

    <StaffSection title="משרות שמתאימות לך" action={<StatusChip tone="info">מידע ציבורי בלבד</StatusChip>}>
      <form action="/dashboard/staff/job-market" id="opportunities"><SearchFilterBar search={<FormField label="חיפוש" name="q" placeholder="תפקיד או שם גן" defaultValue={params?.q ?? ""} />} filters={<FormField label="עיר" name="city" placeholder="עיר" defaultValue={params?.city ?? ""} />} action={<button className="gb-primary-button" type="submit"><Search /> חיפוש</button>} /></form>
      {matches.length ? <div className="ux08-job-grid">{matches.map((opening) => {
        const application = applicationsByOpening.get(opening.id);
        return <RecruitmentJobCard key={opening.id} id={opening.id} gardenName={cleanSyntheticLabel(opening.garden_name, "גן ילדים")} city={cleanSyntheticLabel(opening.city, "")} role={opening.role_needed} ageGroup={opening.age_group} employmentType={opening.employment_type} matchLevel={opening.match_level} reasons={opening.match_reasons} applicationStatus={application?.status ?? opening.application_status} actions={<StaffApplicationActions openingId={opening.id} applicationId={application?.id} status={application?.status ?? opening.application_status} />} />;
      })}</div> : <StaffEmpty title="לא נמצאו משרות לפי הסינון" text="אפשר לעדכן עיר או להסיר את מילות החיפוש. לא מוצג מרחק משוער ללא נתוני מיקום קנוניים." icon={Search} />}
    </StaffSection>

    <StaffSection title="המועמדויות שלי" action={<Link href="/dashboard/staff/recruitment-notifications">עדכוני גיוס</Link>}>
      <div id="applications" className="ux08-application-grid">{applications.map((application) => <ApplicationCard key={application.id} id={application.id} garden={cleanSyntheticLabel(application.gardens?.name, "גן ילדים")} role={application.kindergarten_staff_openings?.role_needed ?? "צוות גן"} status={application.status} submittedAt={application.submitted_at} informationRequest={application.information_request} />)}{applications.length === 0 ? <StaffEmpty title="עדיין אין מועמדויות" text="בחרו משרה מתאימה והגישו לאחר השלמת הפרופיל והמסמכים." icon={BriefcaseBusiness} /> : null}</div>
    </StaffSection>
  </StaffAppFrame>;
}
