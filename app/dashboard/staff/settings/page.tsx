import Link from "next/link";
import { BadgeCheck, Bell, Building2, CalendarDays, Camera, ChevronLeft, FileCheck2, KeyRound, Languages, Mail, MapPin, Phone, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { LogoutButton } from "@/components/logout-button";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffSection } from "@/components/staff-app-ui";
import { CandidateIdentity, CompletenessRing, RecruitmentTabs } from "@/components/recruitment-ui";
import { StaffCandidateProfileForm } from "@/components/staff-candidate-profile-form";
import { StaffCandidateDocumentUpload } from "@/components/staff-candidate-document-upload";
import { AccountVerificationSummary, SettingsPlatformHeader, SettingsPlatformLayout, SettingsPlatformNavigation, SettingsSection, SettingsStatusCard, SettingsStatusGrid } from "@/components/settings-platform-ui";
import { requireRole } from "@/lib/auth";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { managementContactVerification } from "@/lib/management/contact-verification";
import { resolveStaffEmploymentContext } from "@/lib/management/staff-employment-context";
import { createClient } from "@/lib/supabase/server";

type GardenRow = { id: string; name: string | null; logo_url?: string | null; image_url?: string | null; address?: string | null; phone?: string | null; public_description?: string | null; ages?: string | null; public_profile_enabled?: boolean | null };
type StaffRow = { id: string; full_name?: string | null; role_title?: string | null; phone?: string | null; email?: string | null; class_group?: string | null; profile_photo_url?: string | null; approved_to_work?: boolean | null; onboarding_status?: string | null; created_at?: string | null };
type EmploymentRow = { id: string; status: string; role_title?: string | null; start_date?: string | null; approved_at?: string | null; created_at?: string | null };
type CandidateRow = { full_name?: string | null; profile_photo_url?: string | null; city?: string | null; professional_role?: string | null; qualification_keys?: string[] | null; availability?: { days?: string[]; notes?: string } | null; preferred_age_groups?: string[] | null; employment_preference?: string | null; professional_summary?: string | null; matching_paused?: boolean; status?: string | null };
type Completeness = { percentage?: number; blockers?: string[]; status?: string; required_fields_complete?: boolean; documents_ready?: boolean };

export default async function SettingsPage() {
  const { user, profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const context = await resolveStaffEmploymentContext(profile);
  const active = context.activeEmployment;
  const [gardenRes, staffRes, employmentRes, candidateRes, completenessRes] = await Promise.all([
    active ? supabase.from("gardens" as never).select("id, name, logo_url, image_url, address, phone, public_description, ages, public_profile_enabled" as never).eq("id", active.garden_id).maybeSingle() : Promise.resolve({ data: null }),
    active ? supabase.from("staff" as never).select("id,full_name,role_title,phone,email,class_group,profile_photo_url,approved_to_work,onboarding_status,created_at" as never).eq("id", active.staff_id).eq("garden_id", active.garden_id).maybeSingle() : Promise.resolve({ data: null }),
    active ? supabase.from("staff_kindergarten_employments" as never).select("id,status,role_title,start_date,approved_at,created_at" as never).eq("id", active.employment_id).maybeSingle() : Promise.resolve({ data: null }),
    !active ? supabase.from("staff_candidate_profiles" as never).select("full_name,profile_photo_url,city,professional_role,qualification_keys,availability,preferred_age_groups,employment_preference,professional_summary,matching_paused,status" as never).eq("profile_id", profile.id).maybeSingle() : Promise.resolve({ data: null }),
    !active ? supabase.rpc("evaluate_staff_candidate_profile", { target_profile_id: profile.id }) : Promise.resolve({ data: null })
  ]);
  const garden = gardenRes.data as unknown as GardenRow | null;
  const staff = staffRes.data as unknown as StaffRow | null;
  const employment = employmentRes.data as unknown as EmploymentRow | null;
  const candidate = candidateRes.data as unknown as CandidateRow | null;
  const completeness = completenessRes.data as unknown as Completeness | null;
  const name = cleanSyntheticLabel(staff?.full_name ?? profile.full_name, "איש/ת צוות");
  const gardenName = cleanSyntheticLabel(active?.garden_name, "גן");
  const roleName = cleanSyntheticLabel(employment?.role_title ?? active?.role_title ?? staff?.role_title, "צוות גן");

  const portrait = candidate?.profile_photo_url ?? staff?.profile_photo_url ?? profile.profile_image_url;
  const verification = managementContactVerification(user, profile);

  return <StaffAppFrame active="profile" profileName={candidate?.full_name ?? name} avatarUrl={portrait} mode={active ? "assigned" : "candidate"}>
    <SettingsPlatformHeader role="staff" title="הגדרות וחשבון" description="פרופיל אישי, אבטחה והעדפות לפי העסקה פעילה, גן וכיתה." />
    <SettingsPlatformLayout navigation={<SettingsPlatformNavigation role="staff" activeHref="/dashboard/staff/settings" />}>
      <SettingsStatusGrid>
        <SettingsStatusCard label="מצב" value={active ? "צוות פעיל" : "מועמדות"} detail={active ? gardenName : "טרם קיים שיוך תפעולי"} icon={BadgeCheck} tone={active ? "green" : "orange"} />
        <SettingsStatusCard label="הקשר גן" value={active ? gardenName : "ללא גן פעיל"} detail={context.employments.length > 1 ? `${context.employments.length} העסקות פעילות` : "לפי העסקה מאומתת"} icon={Building2} tone="blue" />
        <SettingsStatusCard label="מצלמות" value="לפי אזור ותפקיד" detail="אין גישה כלל־גנית כברירת מחדל" icon={Camera} tone="purple" href="/dashboard/staff/cameras" />
      </SettingsStatusGrid>
      <SettingsSection id="staff-account" title="חשבון ואימות" description="דוא״ל מאומת מספיק להפעלה רגילה; אימות טלפון אינו חובה" icon={ShieldCheck}>
        <AccountVerificationSummary email={profile.email ?? user.email} emailVerified={verification.emailVerified} phone={profile.phone ?? staff?.phone} phoneVerified={verification.phoneVerified} />
      </SettingsSection>
    </SettingsPlatformLayout>
    {!active ? <RecruitmentTabs active="profile" /> : null}
    {!active ? <section className="ux08-candidate-profile-hero"><CandidateIdentity name={candidate?.full_name ?? name} role={candidate?.professional_role} city={candidate?.city} photo={candidate?.profile_photo_url ?? profile.profile_image_url} status={candidate?.status} /><CompletenessRing percentage={Number(completeness?.percentage ?? 0)} /></section> : <section className="ux07-staff-identity-hero">
      <Avatar name={name} src={portrait} size="lg" />
      <div className="ux07-staff-identity-copy"><span>הפרופיל שלי</span><h1>{name}</h1><p>{roleName} · {gardenName}</p><div><StatusChip tone="success"><BadgeCheck size={15} /> העסקה פעילה</StatusChip>{active.classroom_names?.length ? <StatusChip tone="info"><UsersRound size={15} /> {active.classroom_names.map((classroom) => cleanSyntheticLabel(classroom, "כיתה")).join(", ")}</StatusChip> : null}</div></div>
      <nav aria-label="אזורי פרופיל צוות"><Link href="/dashboard/staff/settings">סקירה</Link><Link href="/dashboard/staff/shifts">משמרות</Link><Link href="/dashboard/staff/documents">מסמכים</Link><Link href="/dashboard/staff/notifications">הודעות</Link></nav>
    </section>}

    {active ? <section className="ux07-staff-profile-card">
      <div className="ux07-profile-card-heading"><div><span>פרטי העסקה</span><h2>תפקיד, שיוך ופרטי קשר</h2></div><StatusChip tone="success">פעיל/ה</StatusChip></div>
      <div className="ux07-profile-facts">
        <span><Building2 /><small>גן פעיל</small><b>{gardenName}</b></span>
        <span><UsersRound /><small>כיתות</small><b>{active.classroom_names?.map((name) => cleanSyntheticLabel(name, "כיתה")).join(", ") || "ללא שיוך כיתה"}</b></span>
        <span><CalendarDays /><small>תחילת העסקה</small><b>{employment?.start_date ? new Date(employment.start_date).toLocaleDateString("he-IL") : "לא תועד"}</b></span>
        <span><MapPin /><small>כתובת</small><b>{garden?.address ?? "לא הוגדרה"}</b></span>
        <span><Phone /><small>טלפון</small><b dir="ltr">{staff?.phone ?? profile.phone ?? "לא הוגדר"}</b></span>
        <span><Mail /><small>דוא״ל</small><b dir="ltr">{staff?.email ?? "לא הוגדר"}</b></span>
      </div>
      <div className="profile-actions"><Link className="button secondary" href="/dashboard/staff/documents"><FileCheck2 size={17} /> מסמכים ותעודות</Link><Link className="button secondary" href="/dashboard/staff/shifts"><CalendarDays size={17} /> משמרות ושעות</Link><Link className="button secondary" href="/dashboard/staff/cameras"><ShieldCheck size={17} /> הרשאות בטיחות</Link></div>
    </section> : null}

    {context.available && context.employments.length > 1 ? <StaffSection title="העסקות פעילות לפי גן"><div className="ux07-employment-grid">{context.employments.map((item) => <article key={item.employment_id} className={item.garden_id === active?.garden_id ? "active" : ""}><Building2 /><div><strong>{cleanSyntheticLabel(item.garden_name, "גן")}</strong><span>{cleanSyntheticLabel(item.role_title, "צוות")}</span><small>{item.classroom_names?.map((name) => cleanSyntheticLabel(name, "כיתה")).join(", ") || "ללא כיתה"}</small></div>{item.garden_id === active?.garden_id ? <StatusChip tone="success">הגן הפעיל</StatusChip> : <StatusChip tone="info">זמין לבחירה</StatusChip>}</article>)}</div></StaffSection> : null}

    {!active ? <section className="ux08-profile-editor-grid"><StaffCandidateProfileForm candidate={candidate} completeness={completeness} /><StaffCandidateDocumentUpload /></section> : null}
    {active ? <section className="ux07-settings-menu-card" aria-labelledby="staff-settings-title">
      <header><span>החשבון שלי</span><h2 id="staff-settings-title">הגדרות</h2><p>גישה מהירה לפרופיל, אבטחה והעדפות.</p></header>
      <nav aria-label="הגדרות צוות">
        <a href="#profile-settings"><UserRound /><span><b>הפרופיל שלי</b><small>פרטים אישיים ופרטי קשר</small></span><ChevronLeft /></a>
        <Link href="/dashboard/staff/shifts"><CalendarDays /><span><b>משמרות</b><small>לוח עבודה והיסטוריית שעות</small></span><ChevronLeft /></Link>
        <Link href="/dashboard/staff/attendance"><BadgeCheck /><span><b>נוכחות</b><small>מצב נוכחי ופעולות שעון</small></span><ChevronLeft /></Link>
        <Link href="/dashboard/staff/documents"><FileCheck2 /><span><b>מסמכים</b><small>אישורים ותעודות</small></span><ChevronLeft /></Link>
        <Link href="/dashboard/security-settings"><KeyRound /><span><b>אבטחה וכניסה</b><small>MFA, Passkey, מכשירים וסשנים</small></span><ChevronLeft /></Link>
        <span><Languages /><span><b>שפה</b><small>עברית</small></span><StatusChip tone="info">RTL</StatusChip></span>
        <Link href="/dashboard/staff/notifications"><Bell /><span><b>התראות</b><small>עדכונים והעדפות צפייה</small></span><ChevronLeft /></Link>
      </nav>
      <LogoutButton className="ux07-settings-logout" />
    </section> : null}
    <div id="profile-settings"><StaffSection title={active ? "פרטים אישיים ואבטחה" : "חשבון ואבטחה"}><ProfileSettingsForm profile={profile} garden={garden} roleLabel={active ? "צוות גן" : "מועמד/ת לצוות"} includeGarden={false} requireProfilePhoto /></StaffSection></div>
  </StaffAppFrame>;
}
