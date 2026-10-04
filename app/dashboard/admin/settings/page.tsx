import Link from "next/link";
import { BellRing, LockKeyhole, Settings, ShieldCheck } from "lucide-react";
import { AdminAppFrame } from "@/components/admin-app-ui";
import { PremiumCard, SectionHeader } from "@/components/gan-batuach-design-system";
import { AdminAreaGrid, AdminSectionIntro, AdminTruthState } from "@/components/platform-admin-ui";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { requireRole } from "@/lib/auth";

export default async function AdminSettingsPage() {
  const { profile } = await requireRole(["admin"]);
  return (
    <AdminAppFrame profile={profile} activeHref="/dashboard/admin/settings" title="הגדרות פלטפורמה" subtitle="תצורה, מדיניות ופרופיל אדמין." badge="הגדרות">
      <div className="platform-admin">
        <AdminSectionIntro eyebrow="PLATFORM SETTINGS" title="הגדרות ומדיניות" text="עדכון פרופיל אדמין, מעבר מהיר בין 12 אזורי הניהול ובדיקת מוכנות ספקים ואבטחה. סודות ופרטי חיבור אינם מוצגים בממשק." />
        <section aria-labelledby="canonical-admin-areas"><SectionHeader title="12 אזורי הניהול הקנוניים" subtitle="מסכי מומחה ממשיכים להתקיים תחת אזורי האב ואינם הופכים לניווט ראשי." icon={Settings} /><AdminAreaGrid currentHref="/dashboard/admin/settings" /></section>
        <section className="platform-admin-service-grid" aria-label="מוקדי הגדרות">
          <AdminTruthState title="הרשאות ותפקידים" text="השרת הוא מקור האמת. שינויי תפקיד מתועדים ב־Audit." icon={ShieldCheck} action={<Link className="admin-link-button" href="/dashboard/admin/users">ניהול משתמשים</Link>} />
          <AdminTruthState title="אבטחה ופרטיות" text="אין הצגת secrets, service-role או מידע פרטי רחב במסכי אדמין." icon={LockKeyhole} action={<Link className="admin-link-button" href="/dashboard/admin/audit-logs">Audit ואבטחה</Link>} />
          <AdminTruthState title="ספקים והתראות" text="מוכנות מוצגת לפי אימות בפועל; ספק חסר נשאר במצב נדרשת הגדרה." icon={BellRing} action={<Link className="admin-link-button" href="/dashboard/admin/provider-production">בדיקת ספקים</Link>} />
        </section>
        <PremiumCard size="lg"><SectionHeader title="פרופיל אדמין" subtitle="פרטי קשר והעדפות; הרשאות נשארות תחת מנגנון השרת." icon={Settings} /><ProfileSettingsForm profile={profile} roleLabel="מנהל מערכת" /></PremiumCard>
      </div>
    </AdminAppFrame>
  );
}
