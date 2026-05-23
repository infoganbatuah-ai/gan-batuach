import Link from "next/link";
import { BrandHeader } from "@/components/brand-header";
import type { UserRole } from "@/lib/roles";

const navByRole: Record<UserRole, Array<{ href: string; label: string; hint: string }>> = {
  admin: [
    { href: "/dashboard/admin", label: "מרכז שליטה", hint: "סיכונים, ערים, לידים" },
    { href: "/dashboard/admin/inspection-forms", label: "טפסי פיקוח", hint: "בונה דינמי" },
    { href: "/dashboard/admin/onboarding", label: "משתמשים", hint: "גנים ופקחים" },
    { href: "/dashboard/admin/ai-observer", label: "תצפיתן AI", hint: "אירועים והתראות" },
    { href: "/dashboard/admin/camera-ai", label: "מצלמות", hint: "Gateway והרשאות" },
    { href: "/dashboard/admin/procedures", label: "נהלים", hint: "חובה ותאימות" }
  ],
  inspector: [
    { href: "/dashboard/inspector", label: "ביקורות", hint: "חודשי, GPS, ליקויים" },
    { href: "/dashboard/inspector/inspections", label: "ביקורות", hint: "נתוני פיקוח" },
    { href: "/dashboard/inspector/violations", label: "ליקויים", hint: "אישור תיקונים" }
  ],
  manager: [
    { href: "/dashboard/garden", label: "ניהול גן", hint: "יום עבודה" },
    { href: "/dashboard/garden/cameras", label: "מצלמות", hint: "אשף חיבור" },
    { href: "/dashboard/garden/onboarding", label: "קליטה", hint: "הורים, ילדים וצוות" },
    { href: "/dashboard/garden/children", label: "ילדים", hint: "רישום ואישור" },
    { href: "/dashboard/garden/attendance", label: "נוכחות", hint: "ילדים וצוות" }
  ],
  staff: [
    { href: "/dashboard/staff", label: "צוות", hint: "GPS ומשימות" },
    { href: "/dashboard/staff/shifts", label: "שעות", hint: "דוחות חודשיים" },
    { href: "/dashboard/staff/messages", label: "הודעות", hint: "תקשורת" }
  ],
  parent: [
    { href: "/dashboard/parent", label: "אזור הורים", hint: "ילד וגן" },
    { href: "/parent-onboarding", label: "כרטיס ילד", hint: "פרטים והסכמות" },
    { href: "/dashboard/parent/complaints", label: "תלונות", hint: "פנייה מסודרת" }
  ]
};

export function DashboardShell({ role, title, children }: { role: UserRole; title: string; children: React.ReactNode }) {
  return (
    <>
      <BrandHeader />
      <div className="dashboard-layout">
        <aside className="sidebar">
          <h2>{title}</h2>
          <p>ממשק עבודה לפי הרשאה, גן ושיוך.</p>
          <nav>
            {navByRole[role].map((item) => (
              <Link href={item.href} key={item.href}>
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </Link>
            ))}
          </nav>
        </aside>
        <main className="dashboard-main">{children}</main>
      </div>
    </>
  );
}
