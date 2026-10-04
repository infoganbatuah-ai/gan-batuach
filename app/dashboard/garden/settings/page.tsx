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
      <SettingsStatusGrid>
        <SettingsStatusCard label="גן פעיל" value={garden?.name ?? "לא נבחר"} detail={context.gardens.length > 1 ? `${context.gardens.length} גנים זמינים להחלפה` : "הקשר ניהול מאומת"} icon={Building2} tone="blue" />
        <SettingsStatusCard label="הרשאות הוראה" value={`${activeAssignments.length} פעילות`} detail="בעלים־כגננת והאצלה נשמרים בנפרד" icon={UsersRound} tone="purple" href="/dashboard/garden/staff" />
        <SettingsStatusCard label="מדיניות מצלמות" value={`${livePolicyCount} מקורות מורשים`} detail="לפי תפקיד, גן ויכולת מאומתת" icon={Camera} tone={livePolicyCount ? "green" : "orange"} href="/dashboard/garden/cameras" />
      </SettingsStatusGrid>
      <SettingsSection id="profile" title="פרופיל וחשבון" description="פרטי הקשר האישיים ואימות החשבון" icon={ShieldCheck}>
        <AccountVerificationSummary email={profile.email ?? user.email} emailVerified={verification.emailVerified} phone={profile.phone} phoneVerified={verification.phoneVerified} />
      </SettingsSection>
      <SettingsSection id="garden-profile" title="הגן שלי" description="שדות פרופיל קנוניים של הגן הפעיל בלבד" icon={Building2} action={context.gardens.length > 1 ? <Link className="button secondary" href="/dashboard/garden/operations">החלפת גן פעיל</Link> : undefined}>
        <ProfileSettingsForm profile={profile} garden={garden} roleLabel={role === "owner" ? "בעלים" : "מנהלת גן"} includeGarden requireProfilePhoto requireGardenLogo />
      </SettingsSection>
      <SettingsSection id="permissions" title="הרשאות ומבנה" description="אין כאן מנגנון RBAC נוסף; כל פעולה נשענת על ההרשאה הקנונית בצד השרת" icon={UsersRound}>
        <SettingsLinkList items={[
          { title: "צוות, תפקידים וכיתות", detail: `${classrooms.length} כיתות · שיוך צוות לפי העסקה פעילה`, href: "/dashboard/garden/staff", status: "לפי גן", icon: UsersRound },
          { title: "בעלים כגננת / גננת מואצלת", detail: "הרשאת הוראה נפרדת מהרשאת ניהול", href: "/dashboard/garden/staff", status: `${activeAssignments.length} פעילות`, icon: ShieldCheck },
          { title: "מדיניות מצלמות", detail: "גישה להורים, צוות ומפקחים לפי מקור ואזור", href: "/dashboard/garden/cameras", status: `${cameras.length} מקורות`, icon: Camera }
        ]} />
      </SettingsSection>
      <SettingsSection id="account-services" title="התראות, מנוי ואינטגרציות" description="קישורים למקורות האמת הקיימים, עם מצב ספק אמיתי" icon={PlugZap}>
        <SettingsLinkList items={[
          { title: "העדפות התראות ושעות שקט", detail: "Push, Email וערוצים זמינים בלבד", href: "/dashboard/garden/notifications#preferences", status: "אישי", icon: Bell },
          { title: "מנוי גן בטוח", detail: "מנוי הגן נשאר נפרד מתשלומי הורים", href: "/dashboard/garden/subscription", status: "גן ← פלטפורמה", icon: CreditCard },
          { title: "מוכנות ספק תשלום", detail: "לא מוצג Checkout ללא אימות ייצור", href: "/dashboard/garden/subscription", status: providerLabel, icon: PlugZap },
          { title: "אבטחה, MFA ו־Passkey", detail: "מכשירים, סשנים ופעולות רגישות", href: "/dashboard/security-settings", status: "אישי", icon: KeyRound }
        ]} />
      </SettingsSection>
      <SettingsSection id="privacy" title="פרטיות והפרדת נתונים" description="הגדרות נשמרות לפי משתמש, גן פעיל ותפקיד" icon={ShieldCheck}>
        <p className="settings-truth-note">החלפת גן מחליפה גם את הקשר ההרשאות. הרשאות מצלמה אינן מועתקות בין גנים, מנוי הפלטפורמה אינו חוב הורה, וסודות ספקים אינם מוצגים בממשק.</p>
      </SettingsSection>
    </SettingsPlatformLayout>
  </TeacherAppFrame>;
}
