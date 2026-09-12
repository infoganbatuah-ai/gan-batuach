import { BriefcaseBusiness, Building2 } from "lucide-react";
import { StaffCandidateProfileForm } from "@/components/staff-candidate-profile-form";
import { StaffApplicationActions } from "@/components/staff-application-actions";
import { FormField, ListRowCard, SearchFilterBar, StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffEmpty, StaffPageHero, StaffSection } from "@/components/staff-app-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type CandidateProfile = { city?: string | null; professional_role?: string | null; qualification_keys?: string[] | null; availability?: { days?: string[]; notes?: string } | null; preferred_age_groups?: string[] | null; employment_preference?: string | null; professional_summary?: string | null; matching_paused?: boolean };
type Completeness = { percentage?: number; blockers?: string[]; status?: string };
type JobMatch = { id: string; garden_name?: string | null; city?: string | null; role_needed: string; age_group?: string | null; employment_type?: string | null; match_level?: string | null; match_reasons?: string[] | null; application_status?: string | null };
type ApplicationRow = { id: string; opening_id: string; status: string };
type StaffRow = { id: string; garden_id?: string | null; approved_to_work?: boolean | null };

export default async function StaffJobMarketPage({ searchParams }: { searchParams?: Promise<{ city?: string; q?: string }> }) {
  const { profile } = await requireRole(["staff"]);
  const params = await searchParams;
  const supabase = await createClient();
  const staffRes = await supabase.from("staff" as never).select("id, garden_id, approved_to_work" as never).eq("profile_id", profile.id).maybeSingle();
  const staff = staffRes.data as unknown as StaffRow | null;
  const isAssigned = Boolean(staff?.garden_id && staff?.approved_to_work);
  const [candidateRes, completenessRes, matchesRes, applicationsRes] = await Promise.all([
    supabase.from("staff_candidate_profiles" as never).select("profile_id,city,professional_role,qualification_keys,availability,preferred_age_groups,employment_preference,professional_summary,matching_paused,profile_completeness,status" as never).eq("profile_id", profile.id).maybeSingle(),
    supabase.rpc("evaluate_staff_candidate_profile", { target_profile_id: profile.id }),
    supabase.rpc("find_relevant_staff_jobs", { target_city: params?.city ?? null, target_role: null, target_age_group: null, target_query: params?.q ?? null }),
    supabase.from("staff_job_applications" as never).select("id,opening_id,status" as never).eq("staff_candidate_id", profile.id).order("created_at", { ascending: false })
  ]);
  const candidate = candidateRes.data as unknown as CandidateProfile | null;
  const completeness = completenessRes.data as unknown as Completeness | null;
  const filtered = (matchesRes.data ?? []) as unknown as JobMatch[];
  const applications = new Map(((applicationsRes.data ?? []) as unknown as ApplicationRow[]).filter((row) => row.opening_id).map((row) => [row.opening_id, row]));

  return (
    <StaffAppFrame active={isAssigned ? "more" : "jobs"} mode={isAssigned ? "assigned" : "candidate"}>
      <StaffPageHero eyebrow="מועמדות צוות" title="מצאו גן שמחפש עובדים" text="מוצגים רק פרטים ציבוריים של משרות. אין גישה למידע פנימי לפני אישור מנהלת." icon={BriefcaseBusiness} badge={<StatusChip tone="success">{filtered.length} משרות פתוחות</StatusChip>} />
      <form action="/dashboard/staff/job-market">
        <SearchFilterBar
          search={<FormField label="חיפוש" name="q" placeholder="תפקיד או שם גן" defaultValue={params?.q ?? ""} />}
          filters={<FormField label="עיר" name="city" placeholder="עיר" defaultValue={params?.city ?? ""} />}
          action={<button className="gb-primary-button" type="submit">סינון</button>}
        />
      </form>
      <StaffSection title="הפרופיל שמניע את ההתאמות">
        <StaffCandidateProfileForm candidate={candidate} completeness={completeness} />
      </StaffSection>
      <StaffSection title="משרות פתוחות">
        {filtered.length === 0 ? (
          <StaffEmpty title="אין משרות פתוחות" text="כאשר גן יפרסם משרה, היא תופיע כאן." icon={BriefcaseBusiness} />
        ) : (
          <div className="staff-task-list-ref">
            {filtered.map((opening) => (
              <ListRowCard
                key={opening.id}
                title={opening.role_needed}
                subtitle={`${opening.garden_name ?? "גן"} · ${opening.city ?? ""}`}
                meta={`${opening.age_group ?? "כל הגילאים"} · ${opening.employment_type ?? "סוג העסקה לא פורסם"}`}
                avatar={<Building2 size={22} />}
                status={<StatusChip tone={opening.match_level === "exact_match" ? "success" : "warning"}>{opening.match_level === "exact_match" ? "התאמה מלאה" : "התאמה חלקית"}</StatusChip>}
                actions={<span><small className="gateway-setup-state">{(opening.match_reasons ?? []).join(" · ") || "פרטי התאמה חסרים"}</small><StaffApplicationActions openingId={opening.id} applicationId={applications.get(opening.id)?.id} status={applications.get(opening.id)?.status ?? opening.application_status} /></span>}
              />
            ))}
          </div>
        )}
      </StaffSection>
    </StaffAppFrame>
  );
}
