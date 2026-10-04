import { Bell, Camera, KeyRound, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { InspectorAppFrame } from "@/components/inspector-app-ui";
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
import { requireRole } from "@/lib/auth";
import { managementContactVerification } from "@/lib/management/contact-verification";
import { createClient } from "@/lib/supabase/server";

export default async function InspectorSettingsPage() {
  const { user, profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, gardensRes, applicationRes] = await Promise.all([
    supabase.from("inspectors" as never).select("id,service_cities,profile_photo_url,status" as never).eq("id", profile.id).maybeSingle(),
    supabase.from("gardens" as never).select("id,name" as never).eq("inspector_id", profile.id).limit(100),
    supabase.from("inspector_applications" as never).select("status,reviewed_at" as never).eq("profile_id", profile.id).maybeSingle()
  ]);
  const inspector = inspectorRes.data as any;
  const gardens = (gardensRes.data ?? []) as any[];
  const application = applicationRes.data as any;
  const profileForUi = { ...profile, profile_image_url: inspector?.profile_photo_url ?? profile.profile_image_url };
  const verification = managementContactVerification(user, profile);

  return <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/settings" title="הגדרות מפקח" subtitle="פרופיל, אבטחה והעדפות" badge="הגדרות">
    <SettingsPlatformHeader role="inspector" title="הגדרות וחשבון" description="פרופיל מפקח, מצב בקשה, שיוכים, התראות והרשאות — ללא הגדרות בעלים או אדמין." />
    <SettingsPlatformLayout navigation={<SettingsPlatformNavigation role="inspector" activeHref="/dashboard/inspector/settings" />}>
      <SettingsStatusGrid>
        <SettingsStatusCard label="מצב מפקח" value={application?.status === "approved" ? "מאושר" : application?.status ?? "לא זמין"} detail="אישור נפרד משיוך לגן" icon={ShieldCheck} tone={application?.status === "approved" ? "green" : "orange"} />
        <SettingsStatusCard label="גנים משויכים" value={String(gardens.length)} detail="גישה לפי שיוך בלבד" icon={MapPin} tone="blue" />
        <SettingsStatusCard label="מצלמות" value="לפי מדיניות" detail="אין הנחת גישת Live" icon={Camera} tone="purple" href="/dashboard/inspector/cameras" />
      </SettingsStatusGrid>
      <SettingsSection id="account" title="חשבון ואימות" description="דוא״ל מאומת מספיק להפעלה רגילה" icon={ShieldCheck}>
        <AccountVerificationSummary email={profile.email ?? user.email} emailVerified={verification.emailVerified} phone={profile.phone} phoneVerified={verification.phoneVerified} />
      </SettingsSection>
      <SettingsSection id="profile" title="פרופיל אישי" description="פרטי המפקח והתמונה המשמשת במסכי הפיקוח" icon={UserRound}>
        <ProfileSettingsForm profile={profileForUi} roleLabel="מפקח" includeGarden={false} requireProfilePhoto />
      </SettingsSection>
      <SettingsSection id="integrations" title="העדפות וגישה" description="הגדרות אישיות והקשרי גישה מורשים" icon={KeyRound}>
        <SettingsLinkList items={[
          { title: "התראות ושעות שקט", detail: "ביקורות, ליקויים ופעולות שממתינות", href: "/dashboard/inspector/notifications#preferences", status: "אישי", icon: Bell },
          { title: "אבטחה, MFA ו־Passkey", detail: "מכשירים וסשנים ללא חשיפת אסימונים", href: "/dashboard/security-settings", status: "מאובטח", icon: KeyRound },
          { title: "גישה למצלמות", detail: "אין גישה, ראיות בלבד או Live רק אם הותר ואומת", href: "/dashboard/inspector/cameras", status: "לפי מדיניות", icon: Camera },
          { title: "שיוכי גנים", detail: gardens.map((garden) => garden.name).join(", ") || "אין גנים משויכים", href: "/dashboard/inspector/control-center", status: `${gardens.length} גנים`, icon: MapPin }
        ]} />
      </SettingsSection>
      <SettingsSection id="privacy" title="פרטיות והפרדת תפקידים" description="מפקח רואה מידע רק בתחום השיוך והצורך המקצועי" icon={ShieldCheck}>
        <p className="settings-truth-note">הגדרות הגן, מנוי, משתמשים וסודות אינטגרציה אינם זמינים למפקח. אישור מועמדות אינו יוצר שיוך לגן, והרשאת מצלמה אינה נגזרת אוטומטית מתפקיד המפקח.</p>
      </SettingsSection>
    </SettingsPlatformLayout>
  </InspectorAppFrame>;
}
