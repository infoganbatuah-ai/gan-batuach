/* eslint-disable @next/next/no-img-element -- profile and garden images are tenant-configured remote URLs; the existing media contract does not guarantee Next Image host metadata */
import Link from "next/link";
import { Bell, Building2, Camera, CreditCard, KeyRound, PlugZap, ShieldCheck, UsersRound } from "lucide-react";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import {
  AccountVerificationSummary,
  SettingsLinkList,
  SettingsPlatformHeader,
  SettingsPlatformLayout,
  SettingsPlatformNavigation,
  SettingsSection,
  SettingsStatusCard,
  SettingsStatusGrid
} from "@/components/settings-platform-ui";
import { TeacherAppFrame } from "@/components/teacher-app-ui";
import { requireRole } from "@/lib/auth";
import { resolveManagementGardenContext } from "@/lib/management/active-garden-context";
import { managementContactVerification } from "@/lib/management/contact-verification";
import { getSafeIntegrationStatus } from "@/lib/domain/provider-integration-safety";
import { createClient } from "@/lib/supabase/server";

type GardenSettingsRecord = {
  id: string;
  name?: string | null;
  logo_url?: string | null;
  image_url?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  owner_name?: string | null;
  public_description?: string | null;
  ages?: string[] | string | null;
  public_profile_enabled?: boolean | null;
  approval_flow_status?: string | null;
  final_approval_status?: string | null;
  admin_correction_note?: string | null;
  operational_timezone?: string | null;
};
type ClassroomSettingsRecord = { id: string; status?: string | null };
type TeachingAssignmentRecord = { id: string; assignment_kind?: string | null; status?: string | null };
type CameraPolicyRecord = {
  id: string;
  status?: string | null;
  parent_view_allowed?: boolean | null;
  staff_view_allowed?: boolean | null;
  inspector_view_allowed?: boolean | null;
};

export default async function SettingsPage() {
  const { user, profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const context = await resolveManagementGardenContext(profile);
  const gardenId = context.activeGarden?.id ?? profile.garden_id;
  const [gardenRes, classroomsRes, assignmentsRes, camerasRes] = await Promise.all([
    gardenId ? supabase.from("gardens" as never).select("id,name,logo_url,image_url,address,phone,email,owner_name,public_description,ages,public_profile_enabled,approval_flow_status,final_approval_status,admin_correction_note,operational_timezone" as never).eq("id", gardenId).maybeSingle() : Promise.resolve({ data: null }),
    gardenId ? supabase.from("classrooms" as never).select("id,status" as never).eq("garden_id", gardenId).limit(100) : Promise.resolve({ data: [] }),
    gardenId ? supabase.from("garden_teaching_assignments" as never).select("id,assignment_kind,status" as never).eq("garden_id", gardenId).limit(100) : Promise.resolve({ data: [] }),
    gardenId ? supabase.from("camera_streams" as never).select("id,status,parent_view_allowed,staff_view_allowed,inspector_view_allowed" as never).eq("garden_id", gardenId).limit(120) : Promise.resolve({ data: [] })
  ]);
  const garden = gardenRes.data as unknown as GardenSettingsRecord | null;
  const classrooms = (classroomsRes.data ?? []) as unknown as ClassroomSettingsRecord[];
  const assignments = (assignmentsRes.data ?? []) as unknown as TeachingAssignmentRecord[];
  const cameras = (camerasRes.data ?? []) as unknown as CameraPolicyRecord[];
  const verification = managementContactVerification(user, profile);
  const role = profile.role === "owner" ? "owner" : "manager";
  const provider = getSafeIntegrationStatus("payment", process.env.PAYMENT_PROVIDER);
  const providerLabel = provider === "not_configured" || provider === "disabled" ? "לא מוגדר" : "נדרש אימות ייצור";
  const activeAssignments = assignments.filter((item) => item.status === "active");
  const livePolicyCount = cameras.filter((camera) => camera.parent_view_allowed || camera.staff_view_allowed || camera.inspector_view_allowed).length;

  return <TeacherAppFrame role={role} title={`שלום, ${profile.full_name ?? "מנהלת הגן"}`} subtitle={`${garden?.name ?? "הגן הפעיל"} · הגדרות`} avatarUrl={profile.profile_image_url ?? null} active="more">
    <SettingsPlatformHeader role={role} title="הגדרות וחשבון" description="פרופיל אישי, הגדרות הגן, הרשאות, אבטחה, התראות ומנוי — לפי הגן הפעיל והרשאת השרת." />
    <SettingsPlatformLayout navigation={<SettingsPlatformNavigation role={role} activeHref="/dashboard/garden/settings" />}>
      <div className="ux18-reference-column ux18-reference-profile-column">
        <SettingsSection id="profile" title="פרופיל אישי" description="פרטי החשבון שלך" icon={ShieldCheck}>
          <div className="ux18-reference-identity">
            <img src={profile.profile_image_url ?? "/assets/teacher-avatar.svg"} alt={`תמונת הפרופיל של ${profile.full_name ?? "מנהלת הגן"}`} />
            <dl>
              <div><dt>שם מלא</dt><dd>{profile.full_name ?? "לא הוגדר"}</dd></div>
              <div><dt>תפקיד</dt><dd>{role === "owner" ? "בעלת גן" : "מנהלת גן"}</dd></div>
              <div><dt>דוא״ל</dt><dd dir="ltr">{profile.email ?? user.email ?? "לא הוגדר"}</dd></div>
              <div><dt>טלפון</dt><dd dir="ltr">{profile.phone ?? "לא הוגדר"}</dd></div>
            </dl>
          </div>
          <AccountVerificationSummary email={profile.email ?? user.email} emailVerified={verification.emailVerified} phone={profile.phone} phoneVerified={verification.phoneVerified} />
        </SettingsSection>
      </div>

      <div className="ux18-reference-column ux18-reference-security-column">
        <SettingsSection id="permissions" title="אבטחה והרשאות" description="גישה קנונית בצד השרת" icon={UsersRound}>
          <SettingsLinkList items={[
            { title: "צוות, תפקידים וכיתות", detail: `${classrooms.length} כיתות · שיוך לפי העסקה`, href: "/dashboard/garden/staff", status: "לפי גן", icon: UsersRound },
            { title: "אבטחת חשבון", detail: "MFA, Passkey ומכשירים מחוברים", href: "/dashboard/security-settings", status: "אישי", icon: KeyRound },
            { title: "מדיניות מצלמות", detail: "גישה לפי תפקיד ואזור", href: "/dashboard/garden/cameras", status: `${cameras.length} מקורות`, icon: Camera }
          ]} />
        </SettingsSection>
        <SettingsSection id="privacy" title="העדפות ופרטיות" description="שפה, התראות והפרדת נתונים" icon={ShieldCheck}>
          <SettingsLinkList items={[
            { title: "התראות ושעות שקט", detail: "ערוצים זמינים בלבד", href: "/dashboard/garden/notifications#preferences", status: "אישי", icon: Bell },
            { title: "פרטיות והרשאות", detail: "הקשר משתמש, גן ותפקיד", href: "/dashboard/security-settings", status: "מוגן", icon: ShieldCheck }
          ]} />
        </SettingsSection>
      </div>

      <div className="ux18-reference-column ux18-reference-garden-column">
        <SettingsStatusGrid>
          <SettingsStatusCard label="הגן שלי" value={garden?.name ?? "לא נבחר"} detail={context.gardens.length > 1 ? `${context.gardens.length} גנים זמינים` : "הקשר ניהול מאומת"} icon={Building2} tone="blue" />
          <SettingsStatusCard label="הרשאות הוראה" value={`${activeAssignments.length} פעילות`} detail="בעלים־כגננת והאצלה נשמרים בנפרד" icon={UsersRound} tone="purple" href="/dashboard/garden/staff" />
          <SettingsStatusCard label="מצלמות" value={`${livePolicyCount} מורשות`} detail="לפי תפקיד ויכולת" icon={Camera} tone={livePolicyCount ? "green" : "orange"} href="/dashboard/garden/cameras" />
        </SettingsStatusGrid>
        <SettingsSection id="garden-profile" title="הגן שלי" description="פרופיל והגדרות הגן הפעיל" icon={Building2} action={context.gardens.length > 1 ? <Link className="button secondary" href="/dashboard/garden/operations">החלפת גן</Link> : undefined}>
          <div className="ux18-reference-garden-summary">
            <img src={garden?.image_url ?? garden?.logo_url ?? "/assets/hero-control-center.png"} alt={`תמונת ${garden?.name ?? "הגן"}`} />
            <div><b>{garden?.name ?? "הגן הפעיל"}</b><small>{garden?.address ?? "כתובת הגן טרם הוגדרה"}</small></div>
          </div>
          <SettingsLinkList items={[
            { title: "פרטי גן ושעות פעילות", detail: "שם, כתובת, קשר ולוח פעילות", href: "#garden-editor", status: "עריכה", icon: Building2 },
            { title: "כיתות והרשאות", detail: `${classrooms.length} כיתות פעילות`, href: "/dashboard/garden/staff", status: "ניהול", icon: UsersRound },
            { title: "מסמכים נדרשים", detail: "מסמכי גן וציות", href: "/dashboard/garden/documents", status: "בדיקה", icon: ShieldCheck }
          ]} />
          <details className="ux18-reference-editor" id="garden-editor">
            <summary>עריכת פרטי חשבון וגן</summary>
            <ProfileSettingsForm profile={profile} garden={garden} roleLabel={role === "owner" ? "בעלים" : "מנהלת גן"} includeGarden requireProfilePhoto requireGardenLogo />
          </details>
        </SettingsSection>
        <SettingsSection id="account-services" title="מנוי, תשלומים ואינטגרציות" description="מצב ספק אמיתי בלבד" icon={PlugZap}>
          <SettingsLinkList items={[
            { title: "מנוי גן בטוח", detail: "מנוי הגן נשאר נפרד מתשלומי הורים", href: "/dashboard/garden/subscription", status: "גן ← פלטפורמה", icon: CreditCard },
            { title: "מוכנות ספק תשלום", detail: "ללא Checkout עד אימות", href: "/dashboard/garden/subscription", status: providerLabel, icon: PlugZap }
          ]} />
        </SettingsSection>
      </div>
    </SettingsPlatformLayout>
  </TeacherAppFrame>;
}
