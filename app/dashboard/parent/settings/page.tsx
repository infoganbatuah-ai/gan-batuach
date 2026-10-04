import { Bell, Camera, KeyRound, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { ParentAppFrame, ParentHero } from "@/components/parent-app-ui";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import {
  AccountVerificationSummary,
  SettingsLinkList,
  SettingsPlatformLayout,
  SettingsPlatformNavigation,
  SettingsSection,
  SettingsStatusCard,
  SettingsStatusGrid
} from "@/components/settings-platform-ui";
import { requireRole } from "@/lib/auth";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { managementContactVerification } from "@/lib/management/contact-verification";
import { createClient } from "@/lib/supabase/server";

type ParentSettingsRecord = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
  photo_url?: string | null;
  status?: string | null;
  completed_profile?: boolean | null;
};
type ParentChildLink = { id: string; garden_id?: string | null; status?: string | null };
type ParentCameraPermission = { id: string; allowed?: boolean | null; valid_until?: string | null; garden_id?: string | null };

export default async function SettingsPage() {
  const { user, profile } = await requireRole(["parent"]);
  const displayName = cleanSyntheticLabel(profile.full_name, "הורה");
  const verification = managementContactVerification(user, profile);
  const supabase = await createClient();
  const parentRes = await supabase.from("parents" as never).select("id,full_name,phone,address,photo_url,status,completed_profile" as never).or(`profile_id.eq.${profile.id},user_id.eq.${profile.id}`).limit(1).maybeSingle();
  const parent = parentRes.data as unknown as ParentSettingsRecord | null;
  const [childrenRes, cameraPermissionsRes] = await Promise.all([
    parent?.id ? supabase.from("children" as never).select("id,garden_id,status" as never).eq("primary_parent_id", parent.id).limit(30) : Promise.resolve({ data: [] }),
    parent?.id ? supabase.from("parent_camera_permissions" as never).select("id,allowed,valid_until,garden_id" as never).eq("parent_id", parent.id).limit(100) : Promise.resolve({ data: [] })
  ]);
  const links = (childrenRes.data ?? []) as unknown as ParentChildLink[];
  const cameraPermissions = (cameraPermissionsRes.data ?? []) as unknown as ParentCameraPermission[];
  const permittedCameras = cameraPermissions.filter((item) => item.allowed && (!item.valid_until || new Date(item.valid_until) > new Date())).length;

  return <ParentAppFrame active="more" profileName={displayName} avatarUrl={profile.profile_image_url ?? null}>
    <ParentHero title="הגדרות וחשבון" subtitle="פרופיל, אבטחה, התראות ופרטיות משפחתית" />
    <SettingsPlatformLayout navigation={<SettingsPlatformNavigation role="parent" activeHref="/dashboard/parent/settings" />}>
      <SettingsStatusGrid>
        <SettingsStatusCard label="פרופיל" value={parent?.completed_profile ? "מושלם" : "להשלמה"} detail="פרטי ההורה בלבד" icon={UserRound} tone={parent?.completed_profile ? "green" : "orange"} />
        <SettingsStatusCard label="ילדים מקושרים" value={String(links.filter((item) => item.status === "active").length)} detail="לפי קשר הורה מאומת" icon={UsersRound} tone="blue" />
        <SettingsStatusCard label="גישה למצלמות" value={permittedCameras ? `${permittedCameras} מורשות` : "ללא הרשאה"} detail="לפי ילד, גן ומדיניות" icon={Camera} tone={permittedCameras ? "green" : "purple"} href="/dashboard/parent/cameras" />
      </SettingsStatusGrid>
      <SettingsSection id="account" title="חשבון ואימות" description="דוא״ל מאומת מספיק להפעלה רגילה; אימות טלפון נשאר אופציונלי" icon={ShieldCheck}>
        <AccountVerificationSummary email={profile.email ?? user.email} emailVerified={verification.emailVerified} phone={profile.phone ?? parent?.phone} phoneVerified={verification.phoneVerified} />
      </SettingsSection>
      <SettingsSection id="profile" title="פרופיל אישי" description="עדכון פרטי ההורה בלבד" icon={UserRound}>
        <ProfileSettingsForm profile={{ ...profile, ...parent, full_name: displayName, profile_image_url: parent?.photo_url ?? profile.profile_image_url }} roleLabel="הורה" includeGarden={false} />
      </SettingsSection>
      <SettingsSection id="preferences" title="העדפות, פרטיות וגישה" description="הגדרות שמותר להורה לשלוט בהן" icon={Bell}>
        <SettingsLinkList items={[
          { title: "התראות ושעות שקט", detail: "בחירת קטגוריות וערוצים זמינים", href: "/dashboard/parent/notifications#preferences", status: "אישי", icon: Bell },
          { title: "מורשי איסוף", detail: "אנשים וזמנים הקשורים לילדים שלך", href: "/dashboard/parent/pickup", status: "לפי ילד", icon: UsersRound },
          { title: "מדיניות מצלמות", detail: "גישה רק למצלמות שהגן אישר במפורש", href: "/dashboard/parent/cameras", status: permittedCameras ? "מורשה" : "לא מורשה", icon: Camera },
          { title: "אבטחה וכניסה מהירה", detail: "סיסמה, MFA, Passkey ומכשירים", href: "/dashboard/security-settings", status: "מאובטח", icon: KeyRound }
        ]} />
      </SettingsSection>
      <SettingsSection id="privacy" title="גבולות פרטיות" description="הורה אינו מנהל הגדרות גן או הרשאות של משפחות אחרות" icon={ShieldCheck}>
        <p className="settings-truth-note">החלפת ילד מעדכנת את הגן וההרשאות הזמינות. הרשאות מצלמה, איסוף ומסמכים אינן נשמרות מהקשר קודם ואינן חושפות מידע של ילדים אחרים.</p>
      </SettingsSection>
    </SettingsPlatformLayout>
  </ParentAppFrame>;
}
