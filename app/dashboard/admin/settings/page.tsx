import { BellRing, Camera, KeyRound, LockKeyhole, PlugZap, Settings, ShieldCheck, UsersRound, WalletCards } from "lucide-react";
import { AdminAppFrame } from "@/components/admin-app-ui";
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
import { AdminAreaGrid } from "@/components/platform-admin-ui";
import { requireRole } from "@/lib/auth";
import { managementContactVerification } from "@/lib/management/contact-verification";

export default async function AdminSettingsPage() {
  const { user, profile } = await requireRole(["admin"]);
  const verification = managementContactVerification(user, profile);
  return <AdminAppFrame profile={profile} activeHref="/dashboard/admin/settings" title="הגדרות פלטפורמה" subtitle="תצורה, מדיניות ופרופיל אדמין." badge="הגדרות">
    <SettingsPlatformHeader role="admin" title="הגדרות וחשבון" description="פרופיל אדמין, אבטחה, הרשאות, ספקים ומדיניות. מידע פרטי וסודות נשארים מחוץ לממשק." />
    <SettingsPlatformLayout navigation={<SettingsPlatformNavigation role="admin" activeHref="/dashboard/admin/settings" />}>
      <SettingsStatusGrid>
        <SettingsStatusCard label="הרשאה" value="Platform Admin" detail="מאומתת בצד השרת" icon={ShieldCheck} tone="green" />
        <SettingsStatusCard label="מודל הרשאות" value="קנוני" detail="ללא RBAC מקביל" icon={UsersRound} tone="blue" href="/dashboard/admin/users" />
        <SettingsStatusCard label="ספקים" value="לפי ראיות" detail="לא מסמנים מוכנות ללא אימות" icon={PlugZap} tone="orange" href="/dashboard/admin/provider-production" />
      </SettingsStatusGrid>
      <SettingsSection id="admin-account" title="חשבון ואבטחה" description="מצב אימות אישי וכניסה לפעולות אבטחה" icon={LockKeyhole}>
        <AccountVerificationSummary email={profile.email ?? user.email} emailVerified={verification.emailVerified} phone={profile.phone} phoneVerified={verification.phoneVerified} />
      </SettingsSection>
      <SettingsSection id="profile" title="פרופיל אדמין" description="פרטי קשר בלבד; התפקיד והסמכויות אינם משתנים בטופס הזה" icon={Settings}>
        <ProfileSettingsForm profile={profile} roleLabel="מנהל מערכת" />
      </SettingsSection>
      <SettingsSection id="permissions" title="הרשאות, ספקים ומדיניות" description="כל אזור מפנה למקור האמת הקנוני שלו" icon={ShieldCheck}>
        <SettingsLinkList items={[
          { title: "משתמשים ותפקידים", detail: "הרשאות פלטפורמה וקשרי גן", href: "/dashboard/admin/users", status: "Server authorized", icon: UsersRound },
          { title: "אבטחת זהות", detail: "MFA, Passkey, מכשירים ואירועים", href: "/dashboard/admin/identity-security", status: "Audit", icon: KeyRound },
          { title: "הרשאות מצלמה", detail: "מדיניות צפייה לפי הורה, גן ומקור", href: "/dashboard/admin/camera-permissions", status: "פרטי", icon: Camera },
          { title: "מנויים ומוכנות תשלום", detail: "מנוי גן לפלטפורמה בלבד", href: "/dashboard/admin/subscriptions", status: "נפרד משכר לימוד", icon: WalletCards },
          { title: "מוכנות ספקים", detail: "Email, Push, תשלום ו־Digital Observer", href: "/dashboard/admin/provider-production", status: "ללא secrets", icon: PlugZap },
          { title: "התראות אדמין", detail: "העדפות אישיות ואירועי פלטפורמה", href: "/dashboard/admin/notifications", status: "אישי", icon: BellRing }
        ]} />
      </SettingsSection>
      <SettingsSection id="admin-ia" title="12 אזורי הניהול הקנוניים" description="מסכי מומחה נשארים תחת אזורי האב ואינם הופכים לניווט ראשי" icon={Settings}>
        <AdminAreaGrid currentHref="/dashboard/admin/settings" />
      </SettingsSection>
      <SettingsSection id="privacy" title="גבולות פרטיות" description="אדמין אינו מקבל דפדוף חופשי בתוכן פרטי" icon={ShieldCheck}>
        <p className="settings-truth-note">מידע ילדים, שיחות, מסמכים, מדיה וסודות ספקים אינם מוצגים במסך ההגדרות. כל שינוי רגיש נשען על הרשאת שרת ו־Audit קנוני.</p>
      </SettingsSection>
    </SettingsPlatformLayout>
  </AdminAppFrame>;
}
