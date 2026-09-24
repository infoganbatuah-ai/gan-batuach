import Link from "next/link";
import { BadgeCheck, Building2, CalendarDays, FileCheck2, Mail, MapPin, Phone, ShieldCheck, UsersRound } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffPageHero, StaffSection } from "@/components/staff-app-ui";
import { requireRole } from "@/lib/auth";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { resolveStaffEmploymentContext } from "@/lib/management/staff-employment-context";
import { createClient } from "@/lib/supabase/server";

type GardenRow = { id: string; name: string | null; logo_url?: string | null; image_url?: string | null; address?: string | null; phone?: string | null; public_description?: string | null; ages?: string | null; public_profile_enabled?: boolean | null };
type StaffRow = { id: string; full_name?: string | null; role_title?: string | null; phone?: string | null; email?: string | null; class_group?: string | null; profile_photo_url?: string | null; approved_to_work?: boolean | null; onboarding_status?: string | null; created_at?: string | null };
type EmploymentRow = { id: string; status: string; role_title?: string | null; start_date?: string | null; approved_at?: string | null; created_at?: string | null };

export default async function SettingsPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const context = await resolveStaffEmploymentContext(profile);
  const active = context.activeEmployment;
  const [gardenRes, staffRes, employmentRes] = await Promise.all([
    active ? supabase.from("gardens" as never).select("id, name, logo_url, image_url, address, phone, public_description, ages, public_profile_enabled" as never).eq("id", active.garden_id).maybeSingle() : Promise.resolve({ data: null }),
    active ? supabase.from("staff" as never).select("id,full_name,role_title,phone,email,class_group,profile_photo_url,approved_to_work,onboarding_status,created_at" as never).eq("id", active.staff_id).eq("garden_id", active.garden_id).maybeSingle() : Promise.resolve({ data: null }),
    active ? supabase.from("staff_kindergarten_employments" as never).select("id,status,role_title,start_date,approved_at,created_at" as never).eq("id", active.employment_id).maybeSingle() : Promise.resolve({ data: null })
  ]);
  const garden = gardenRes.data as unknown as GardenRow | null;
  const staff = staffRes.data as unknown as StaffRow | null;
  const employment = employmentRes.data as unknown as EmploymentRow | null;
  const name = cleanSyntheticLabel(staff?.full_name ?? profile.full_name, "איש/ת צוות");

  return <StaffAppFrame active="profile" profileName={name} avatarUrl={staff?.profile_photo_url ?? profile.profile_image_url} mode={active ? "assigned" : "candidate"}>
    <StaffPageHero eyebrow={active ? "הפרופיל שלי" : "פרופיל מועמדות"} title={name} text={active ? `${active.role_title ?? staff?.role_title ?? "צוות"} · ${active.garden_name}` : "השלימו פרטים אישיים ומסמכים לקראת שיוך לגן."} icon={BadgeCheck} badge={<StatusChip tone={active ? "success" : "warning"}>{active ? "העסקה פעילה" : "ממתין לשיוך"}</StatusChip>} />

    {active ? <section className="ux07-staff-profile-card">
      <div className="ux07-profile-identity"><Avatar name={name} src={staff?.profile_photo_url ?? profile.profile_image_url} size="lg" /><div><h2>{name}</h2><p>{employment?.role_title ?? active.role_title ?? "צוות גן"}</p><StatusChip tone="success">פעיל/ה</StatusChip></div></div>
      <div className="ux07-profile-facts">
        <span><Building2 /><small>גן פעיל</small><b>{active.garden_name}</b></span>
        <span><UsersRound /><small>כיתות</small><b>{active.classroom_names?.join(", ") || "ללא שיוך כיתה"}</b></span>
        <span><CalendarDays /><small>תחילת העסקה</small><b>{employment?.start_date ? new Date(employment.start_date).toLocaleDateString("he-IL") : "לא תועד"}</b></span>
        <span><MapPin /><small>כתובת</small><b>{garden?.address ?? "לא הוגדרה"}</b></span>
        <span><Phone /><small>טלפון</small><b dir="ltr">{staff?.phone ?? profile.phone ?? "לא הוגדר"}</b></span>
        <span><Mail /><small>דוא״ל</small><b dir="ltr">{staff?.email ?? "לא הוגדר"}</b></span>
      </div>
      <div className="profile-actions"><Link className="button secondary" href="/dashboard/staff/documents"><FileCheck2 size={17} /> מסמכים ותעודות</Link><Link className="button secondary" href="/dashboard/staff/shifts"><CalendarDays size={17} /> משמרות ושעות</Link><Link className="button secondary" href="/dashboard/staff/cameras"><ShieldCheck size={17} /> הרשאות בטיחות</Link></div>
    </section> : null}

    {context.available && context.employments.length > 1 ? <StaffSection title="העסקות פעילות לפי גן"><div className="ux07-employment-grid">{context.employments.map((item) => <article key={item.employment_id} className={item.garden_id === active?.garden_id ? "active" : ""}><Building2 /><div><strong>{item.garden_name}</strong><span>{item.role_title ?? "צוות"}</span><small>{item.classroom_names?.join(", ") || "ללא כיתה"}</small></div>{item.garden_id === active?.garden_id ? <StatusChip tone="success">הגן הפעיל</StatusChip> : <StatusChip tone="info">זמין לבחירה</StatusChip>}</article>)}</div></StaffSection> : null}

    <StaffSection title="פרטים אישיים ואבטחה"><ProfileSettingsForm profile={profile} garden={garden} roleLabel="צוות גן" includeGarden={false} requireProfilePhoto /></StaffSection>
  </StaffAppFrame>;
}
