import Link from "next/link";
import { BriefcaseBusiness, FileCheck2, Filter, Plus, Search, Send, Sparkles, UsersRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { CandidateRow, RecruitmentHero, RecruitmentMetric } from "@/components/recruitment-ui";
import { StaffInvitationForm } from "@/components/staff-invitation-form";
import { TeacherAppFrame, TeacherEmptyState, TeacherSection } from "@/components/teacher-app-ui";
import { requireRole } from "@/lib/auth";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { resolveManagementGardenContext } from "@/lib/management/active-garden-context";
import { createClient } from "@/lib/supabase/server";

type CandidateProfile = { full_name?: string | null; profile_photo_url?: string | null; city?: string | null; professional_role?: string | null; qualification_keys?: string[] | null; profile_completeness?: { percentage?: number } | null; document_status?: { required_documents_ready?: boolean } | null };
type ApplicationRow = { id: string; staff_candidate_id: string; opening_id?: string | null; status: string; requested_role?: string | null; created_at?: string | null; staff_candidate_profiles?: CandidateProfile | null; kindergarten_staff_openings?: { role_needed?: string | null; age_group?: string | null; employment_type?: string | null } | null };
type Opening = { id: string; role_needed: string; age_group?: string | null; employment_type?: string | null; active_status: string; created_at?: string | null };

export default async function GardenStaffApplicationsPage({ searchParams }: { searchParams?: Promise<{ q?: string; status?: string; role?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const supabase = await createClient();
  const gardenContext = await resolveManagementGardenContext(profile);
  const gardenId = gardenContext.activeGarden?.id ?? "";
  const [openingsResult, applicationsResult] = await Promise.all([
    supabase.from("kindergarten_staff_openings" as never).select("id,role_needed,age_group,employment_type,active_status,created_at" as never).eq("garden_id", gardenId).order("created_at", { ascending: false }),
    supabase.from("staff_job_applications" as never).select("id,staff_candidate_id,opening_id,status,requested_role,created_at" as never).eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(100)
  ]);
  const openings = (openingsResult.data ?? []) as unknown as Opening[];
  const applications = (applicationsResult.data ?? []) as unknown as ApplicationRow[];
  const candidateIds = Array.from(new Set(applications.map((row) => row.staff_candidate_id)));
  const candidatesResult = candidateIds.length
    ? await supabase.from("staff_candidate_profiles" as never).select("profile_id,full_name,profile_photo_url,city,professional_role,qualification_keys,profile_completeness,document_status" as never).in("profile_id", candidateIds)
    : { data: [], error: null };
  const candidateMap = new Map(((candidatesResult.data ?? []) as unknown as Array<CandidateProfile & { profile_id: string }>).map((candidate) => [candidate.profile_id, candidate]));
  const openingMap = new Map(openings.map((opening) => [opening.id, opening]));
  const allRows = applications.map((application) => ({
    ...application,
    staff_candidate_profiles: candidateMap.get(application.staff_candidate_id) ?? null,
    kindergarten_staff_openings: application.opening_id ? openingMap.get(application.opening_id) ?? null : null
  }));
  const query = String(params?.q ?? "").trim().toLocaleLowerCase("he");
  const rows = allRows.filter((row) => {
    const candidate = row.staff_candidate_profiles;
    const role = row.requested_role ?? row.kindergarten_staff_openings?.role_needed ?? candidate?.professional_role ?? "";
    return (!params?.status || row.status === params.status) && (!params?.role || role === params.role) && (!query || `${candidate?.full_name ?? ""} ${candidate?.city ?? ""} ${role}`.toLocaleLowerCase("he").includes(query));
  });
  const actionRequired = allRows.filter((row) => ["submitted", "resubmitted", "information_required"].includes(row.status)).length;
  const offerCount = allRows.filter((row) => row.status === "awaiting_candidate_acceptance").length;
  const published = openings.filter((opening) => opening.active_status === "published");
  const roles = Array.from(new Set(allRows.map((row) => row.requested_role ?? row.kindergarten_staff_openings?.role_needed).filter(Boolean))) as string[];

  return <DashboardShell role="manager" title="גיוס צוות" appHome>
    <TeacherAppFrame title={`בוקר טוב, ${cleanSyntheticLabel(profile.full_name, "מנהלת הגן").split(" ")[0]}`} subtitle="גיוס מועמדות והפעלת העסקה" avatarUrl={profile.profile_image_url} active="more">
      <RecruitmentHero eyebrow={cleanSyntheticLabel(gardenContext.activeGarden?.name, "הגן הפעיל")} title="בונים צוות חינוכי מצוין" text="משרות, מועמדויות והצעות במסלול אחד. הגישה התפעולית נפתחת רק אחרי קבלת ההצעה והפעלת העסקה הקנונית." action={<Link className="button primary large" href="/dashboard/garden/staff-applications/new"><Plus /> פרסום משרה חדשה</Link>} />
      <section className="ux08-metrics-grid manager">
        <RecruitmentMetric icon={BriefcaseBusiness} value={published.length} label="משרות פתוחות" tone="green" />
        <RecruitmentMetric icon={UsersRound} value={allRows.length} label="מועמדויות" tone="blue" />
        <RecruitmentMetric icon={Sparkles} value={actionRequired} label="דורשות טיפול" tone="orange" />
        <RecruitmentMetric icon={Send} value={offerCount} label="הצעות ממתינות" tone="purple" />
      </section>

      <section className="ux08-manager-toolbar">
        <div><span className="ux08-eyebrow">ניהול מועמדים</span><h1>מועמדות לגן שלך</h1><p>מידע מקצועי נחוץ בלבד, עם סטטוס ברור ופעולה הבאה.</p></div>
        <form action="/dashboard/garden/staff-applications"><label><Search /><input name="q" defaultValue={params?.q ?? ""} placeholder="חיפוש מועמדת, תפקיד או עיר" /></label><select name="status" defaultValue={params?.status ?? ""} aria-label="סינון לפי סטטוס"><option value="">כל הסטטוסים</option><option value="submitted">חדשות</option><option value="under_review">בבדיקה</option><option value="information_required">נדרש מידע</option><option value="awaiting_candidate_acceptance">הצעה נשלחה</option><option value="rejected">לא המשיכה</option><option value="employed">העסקה הופעלה</option></select><select name="role" defaultValue={params?.role ?? ""} aria-label="סינון לפי תפקיד"><option value="">כל התפקידים</option>{roles.map((role) => <option key={role}>{role}</option>)}</select><button className="button secondary" type="submit"><Filter /> סינון</button></form>
      </section>

      <section className="ux08-manager-recruitment-grid">
        <TeacherSection title="מועמדות אחרונות" subtitle={`${rows.length} תוצאות בהקשר הגן הפעיל`}>
          <div className="ux08-candidate-list">{rows.map((row) => {
            const candidate = row.staff_candidate_profiles;
            const completeness = Number(candidate?.profile_completeness?.percentage ?? 0);
            return <CandidateRow key={row.id} id={row.id} name={candidate?.full_name ?? "מועמד/ת"} photo={candidate?.profile_photo_url} role={row.requested_role ?? row.kindergarten_staff_openings?.role_needed ?? candidate?.professional_role ?? "צוות גן"} city={candidate?.city} status={row.status} completeness={completeness} documentStatus={candidate?.document_status?.required_documents_ready ? "verified" : "pending"} />;
          })}{rows.length === 0 ? <TeacherEmptyState title="אין מועמדויות לפי הסינון" text="אפשר לנקות את הסינון או לפרסם משרה חדשה." /> : null}</div>
        </TeacherSection>
        <aside className="ux08-manager-side">
          <section className="ux08-openings-card"><header><div><span className="ux08-eyebrow">המשרות שלך</span><h2>פתוחות כעת</h2></div><Link href="/dashboard/garden/staff-applications/new"><Plus /> חדשה</Link></header>{published.slice(0, 4).map((opening) => <article key={opening.id}><span><BriefcaseBusiness /></span><div><strong>{opening.role_needed}</strong><small>{opening.age_group || "כל קבוצות הגיל"} · {opening.employment_type || "היקף יתואם"}</small></div><StatusChip tone="success">פעילה</StatusChip></article>)}{published.length === 0 ? <p>אין משרה פתוחה כרגע.</p> : null}</section>
          <section className="ux08-invitation-card"><FileCheck2 /><div><h2>הזמנה חתומה</h2><p>למועמדת שכבר בחרת, תוך שמירת נמען, תוקף והיסטוריה.</p></div><details><summary>פתיחת טופס הזמנה</summary><StaffInvitationForm openings={published} /></details></section>
        </aside>
      </section>
    </TeacherAppFrame>
  </DashboardShell>;
}
