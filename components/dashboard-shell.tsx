import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import type { UserRole } from "@/lib/roles";
import { PasskeyEnrollmentPrompt } from "@/components/passkey-enrollment-prompt";
import { LogoutButton } from "@/components/logout-button";
import { PolicyAcceptanceGate } from "@/components/policy-acceptance-gate";
import { AdminGlobalSearch } from "@/components/admin-global-search";
import { RoleOnboardingGuide } from "@/components/role-onboarding-guide";
import { SandboxModeBanner } from "@/components/sandbox-mode-banner";
import { AIAssistantPanel } from "@/components/ai-assistant-panel";
import { DashboardIntelligenceBar } from "@/components/dashboard-intelligence-bar";
import { DashboardCommandCenter } from "@/components/dashboard-command-center";
import { OnboardingGuideControls } from "@/components/onboarding-guide-controls";
import { DashboardBackButton } from "@/components/dashboard-back-button";
import { NotificationBell } from "@/components/notification-bell";

const navByRole: Record<UserRole, Array<{ href: string; label: string; hint: string }>> = {
  admin: [
    { href: "/dashboard/admin", label: "מרכז שליטה", hint: "סיכונים, ערים, לידים" },
    { href: "/dashboard/admin/leads", label: "לידים", hint: "המרות גנים ומפקחים" },
    { href: "/dashboard/admin/users", label: "הוספת משתמשים", hint: "גנים ופקחים" },
    { href: "/dashboard/admin/kindergartens", label: "גנים", hint: "פרופילים וסטטוס" },
    { href: "/dashboard/admin/inspectors", label: "מפקחים", hint: "ערים ושיוך" },
    { href: "/dashboard/admin/inspection-forms", label: "טפסי פיקוח", hint: "בונה דינמי" },
    { href: "/dashboard/admin/procedures", label: "נהלים", hint: "חובה ותאימות" },
    { href: "/dashboard/admin/policies", label: "תקנונים", hint: "אישורי משתמשים" },
    { href: "/dashboard/admin/cameras", label: "מצלמות", hint: "Gateway והרשאות" },
    { href: "/dashboard/admin/ai-events", label: "אירועי AI", hint: "אירועים והתראות" },
    { href: "/dashboard/admin/notifications", label: "התראות", hint: "מרכז פעולות" },
    { href: "/dashboard/admin/tasks", label: "משימות", hint: "מעקב והסלמה" },
    { href: "/dashboard/admin/complaints", label: "דיווחים ופניות", hint: "SLA וחומרה" },
    { href: "/dashboard/admin/documents", label: "מסמכים", hint: "תוקף וציות" },
    { href: "/dashboard/admin/system-health", label: "בריאות מערכת", hint: "מה חסר" },
    { href: "/dashboard/admin/navigation-health", label: "בריאות ניווט", hint: "בדיקת routes" },
    { href: "/dashboard/admin/user-journey-audit", label: "User Journey Audit", hint: "בדיקת מסעות" },
    { href: "/dashboard/admin/audit-logs", label: "Audit Logs", hint: "פעולות מערכת" },
    { href: "/dashboard/admin/demo-control", label: "Demo Control", hint: "נתוני דמו ו-QA" },
    { href: "/dashboard/admin/qa-checklist", label: "QA Checklist", hint: "בדיקות תפעול" },
    { href: "/dashboard/admin/simplicity-audit", label: "Simplicity Audit", hint: "פשטות שימוש" },
    { href: "/dashboard/admin/reports", label: "דוחות", hint: "ייצוא וניתוח" },
    { href: "/dashboard/admin/settings", label: "הגדרות", hint: "מערכת והרשאות" }
  ],  inspector: [
    { href: "/dashboard/inspector", label: "ביקורות", hint: "חודשי, GPS, ליקויים" },
    { href: "/dashboard/inspector/inspections", label: "ביקורות", hint: "נתוני פיקוח" },
    { href: "/dashboard/inspector/cameras", label: "מצלמות", hint: "גנים משויכים" },
    { href: "/dashboard/inspector/ai-events", label: "AI", hint: "התראות גנים" },
    { href: "/dashboard/inspector/reports", label: "דיווחים", hint: "פניות ואירועים" },
    { href: "/dashboard/inspector/notifications", label: "התראות", hint: "פיקוח ומשימות" },
    { href: "/dashboard/inspector/tasks", label: "משימות", hint: "לביצוע" },
    { href: "/dashboard/inspector/violations", label: "ליקויים", hint: "אישור תיקונים" },
    { href: "/dashboard/inspector/settings", label: "הגדרות", hint: "פרופיל והתראות" }
  ],
  manager: [
    { href: "/dashboard/garden", label: "ניהול גן", hint: "יום עבודה" },
    { href: "/dashboard/garden/child-journal", label: "יומן ילד", hint: "עדכוני הורים" },
    { href: "/dashboard/garden/health", label: "בריאות", hint: "אלרגיות ותרופות" },
    { href: "/dashboard/garden/pickup", label: "איסוף", hint: "GPS ומורשים" },
    { href: "/dashboard/garden/incidents", label: "אירועים", hint: "דיווח וטיפול" },
    { href: "/dashboard/garden/daily-journal", label: "יומן תפעול", hint: "צ׳קליסט יומי" },
    { href: "/dashboard/garden/cameras", label: "מצלמות", hint: "אשף חיבור" },
    { href: "/dashboard/garden/onboarding", label: "קליטה", hint: "הורים, ילדים וצוות" },
    { href: "/dashboard/garden/leads", label: "לידים / בקשות הצטרפות", hint: "רישום הורים" },
    { href: "/dashboard/garden/notifications", label: "התראות", hint: "מה דורש טיפול" },
    { href: "/dashboard/garden/children", label: "ילדים", hint: "רישום ואישור" },
    { href: "/dashboard/garden/finance", label: "כספים", hint: "גבייה ותשלומים" },
    { href: "/dashboard/garden/parents", label: "הורים", hint: "אנשי קשר" },
    { href: "/dashboard/garden/staff", label: "צוות", hint: "אישורים ותעודות" },
    { href: "/dashboard/garden/tasks", label: "משימות", hint: "לביצוע ואישור" },
    { href: "/dashboard/garden/documents", label: "מסמכים", hint: "תוקף ואישור" },
    { href: "/dashboard/garden/inspections", label: "פיקוח", hint: "דוחות ותיקונים" },
    { href: "/dashboard/garden/attendance", label: "נוכחות", hint: "ילדים וצוות" },
    { href: "/dashboard/garden/settings", label: "הגדרות", hint: "פרופיל ולוגו" }
  ],
  owner: [
    { href: "/dashboard/garden", label: "ניהול גן", hint: "יום עבודה" },
    { href: "/dashboard/garden/child-journal", label: "יומן ילד", hint: "עדכוני הורים" },
    { href: "/dashboard/garden/health", label: "בריאות", hint: "אלרגיות ותרופות" },
    { href: "/dashboard/garden/pickup", label: "איסוף", hint: "GPS ומורשים" },
    { href: "/dashboard/garden/incidents", label: "אירועים", hint: "דיווח וטיפול" },
    { href: "/dashboard/garden/daily-journal", label: "יומן תפעול", hint: "צ׳קליסט יומי" },
    { href: "/dashboard/garden/cameras", label: "מצלמות", hint: "אשף חיבור" },
    { href: "/dashboard/garden/onboarding", label: "קליטה", hint: "הורים, ילדים וצוות" },
    { href: "/dashboard/garden/leads", label: "לידים / בקשות הצטרפות", hint: "רישום הורים" },
    { href: "/dashboard/garden/notifications", label: "התראות", hint: "מה דורש טיפול" },
    { href: "/dashboard/garden/children", label: "ילדים", hint: "רישום ואישור" },
    { href: "/dashboard/garden/finance", label: "כספים", hint: "גבייה ותשלומים" },
    { href: "/dashboard/garden/parents", label: "הורים", hint: "אנשי קשר" },
    { href: "/dashboard/garden/staff", label: "צוות", hint: "אישורים ותעודות" },
    { href: "/dashboard/garden/tasks", label: "משימות", hint: "לביצוע ואישור" },
    { href: "/dashboard/garden/documents", label: "מסמכים", hint: "תוקף ואישור" },
    { href: "/dashboard/garden/inspections", label: "פיקוח", hint: "דוחות ותיקונים" },
    { href: "/dashboard/garden/attendance", label: "נוכחות", hint: "ילדים וצוות" },
    { href: "/dashboard/garden/settings", label: "הגדרות", hint: "פרופיל ולוגו" }
  ],
  staff: [
    { href: "/dashboard/staff", label: "צוות", hint: "GPS ומשימות" },
    { href: "/dashboard/staff/attendance", label: "נוכחות", hint: "כניסה/יציאה" },
    { href: "/dashboard/staff/child-journal", label: "יומן ילד", hint: "עדכוני הורים" },
    { href: "/dashboard/staff/daily-journal", label: "יומן תפעול", hint: "צ׳קליסט" },
    { href: "/dashboard/staff/cameras", label: "מצלמות", hint: "צפייה מורשית" },
    { href: "/dashboard/staff/tasks", label: "משימות", hint: "לביצוע" },
    { href: "/dashboard/staff/documents", label: "מסמכים", hint: "תעודות ואישורים" },
    { href: "/dashboard/staff/shifts", label: "שעות", hint: "דוחות חודשיים" },
    { href: "/dashboard/staff/messages", label: "הודעות", hint: "תקשורת" },
    { href: "/dashboard/staff/notifications", label: "התראות", hint: "מה חדש" },
    { href: "/dashboard/staff/settings", label: "הגדרות", hint: "פרופיל והתראות" }
  ],
  parent: [
    { href: "/dashboard/parent", label: "אזור הורים", hint: "ילד וגן" },
    { href: "/dashboard/parent/cameras", label: "מצלמות הגן", hint: "צפייה מורשית" },
    { href: "/dashboard/parent/ai-events", label: "אירועי תצפיתן", hint: "עדכונים מאושרים" },
    { href: "/dashboard/parent/daily-journal", label: "יומן יומי", hint: "עדכוני הילד" },
    { href: "/dashboard/parent/notifications", label: "התראות", hint: "עדכונים חשובים" },
    { href: "/parent-onboarding", label: "כרטיס ילד", hint: "פרטים והסכמות" },
    { href: "/dashboard/parent/documents", label: "מסמכים", hint: "אישורים וקבצים" },
    { href: "/dashboard/parent/inspections", label: "פיקוח", hint: "סיכום מאושר" },
    { href: "/dashboard/parent/complaints", label: "תלונות", hint: "פנייה מסודרת" },
    { href: "/dashboard/parent/settings", label: "הגדרות", hint: "פרופיל והתראות" }
  ]
};

const dashboardHomeByRole: Record<UserRole, string> = {
  admin: "/dashboard/admin",
  inspector: "/dashboard/inspector",
  manager: "/dashboard/garden",
  owner: "/dashboard/garden",
  staff: "/dashboard/staff",
  parent: "/dashboard/parent"
};

export function DashboardShell({ role, title, children }: { role: UserRole; title: string; children: React.ReactNode }) {
  return (
    <>
      <BrandHeader />
      <div className="dashboard-layout">
        <aside className="sidebar">
          <h2>{title}</h2>
          <LogoutButton />
          <p>ממשק עבודה לפי הרשאה, גן ושיוך.</p>
          <nav>
            {navByRole[role].map((item) => (
              <Link href={item.href} key={item.href}>
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </Link>
            ))}
          </nav>
          <PasskeyEnrollmentPrompt />
        </aside>
        <main className="dashboard-main">
          <div className="dashboard-page-navigation">
            <DashboardBackButton fallbackHref={dashboardHomeByRole[role]} />
            <NotificationBell role={role} />
          </div>
          <PolicyAcceptanceGate />
          <SandboxModeBanner />
          <OnboardingGuideControls role={role} />
          <RoleOnboardingGuide role={role} />
          <DashboardIntelligenceBar role={role} title={title} />
          <DashboardCommandCenter role={role} title={title} />
          {role === "admin" ? <AdminGlobalSearch /> : null}
          {children}
          <AIAssistantPanel role={role} />
        </main>
        <nav className="mobile-tabbar" aria-label="ניווט דשבורד">{navByRole[role].slice(0, 5).map((item) => <Link href={item.href} key={item.href}><strong>{item.label}</strong><span>{item.hint}</span></Link>)}</nav>
        <Link className="mobile-fab" href={navByRole[role][1]?.href ?? navByRole[role][0].href}>+</Link>
      </div>
    </>
  );
}
