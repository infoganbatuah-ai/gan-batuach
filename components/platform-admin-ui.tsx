import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import {
  Activity,
  BarChart3,
  BellRing,
  ClipboardCheck,
  FileText,
  Home,
  MessageSquareWarning,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
  WalletCards
} from "lucide-react";

type Icon = ComponentType<LucideProps>;

export const canonicalAdminAreas: Array<{
  href: string;
  label: string;
  description: string;
  icon: Icon;
}> = [
  { href: "/dashboard/admin", label: "ראשי", description: "מדדים, פעילות ופעולות הדורשות טיפול", icon: Home },
  { href: "/dashboard/admin/kindergartens", label: "גנים", description: "מחזור חיים, בעלות ומוכנות שירות", icon: UsersRound },
  { href: "/dashboard/admin/users", label: "משתמשים", description: "חשבונות, תפקידים וקשרים לגנים", icon: UserRound },
  { href: "/dashboard/admin/inspectors", label: "מפקחים", description: "מועמדות, אישור, שיוך ועומס", icon: ShieldCheck },
  { href: "/dashboard/admin/kindergarten-applications", label: "אישורים", description: "גנים, מפקחים ומסמכים שממתינים להחלטה", icon: ClipboardCheck },
  { href: "/dashboard/admin/subscriptions", label: "מנויים", description: "מנוי גן לפלטפורמה ומוכנות תשלום", icon: WalletCards },
  { href: "/dashboard/admin/complaints", label: "תלונות", description: "סטטוס, SLA והסלמות מורשות", icon: MessageSquareWarning },
  { href: "/dashboard/admin/provider-production", label: "ספקים ותמיכה", description: "מוכנות ספקים, תקלות ותלות חיצונית", icon: BellRing },
  { href: "/dashboard/admin/system-health", label: "מצב מערכת", description: "בריאות שירותים ופערים תפעוליים מצרפיים", icon: Activity },
  { href: "/dashboard/admin/audit-logs", label: "Audit ואבטחה", description: "פעולות רגישות, כיסוי וממצאי אבטחה", icon: FileText },
  { href: "/dashboard/admin/reports", label: "דוחות", description: "דוחות מצרפיים וייצוא מוגבל", icon: BarChart3 },
  { href: "/dashboard/admin/settings", label: "הגדרות", description: "פרופיל, מדיניות ותצורת הפלטפורמה", icon: Settings }
];

export function AdminAreaGrid({ currentHref }: { currentHref?: string }) {
  return (
    <nav className="platform-admin-area-grid" aria-label="12 אזורי הניהול הקנוניים">
      {canonicalAdminAreas.map((area) => {
        const Icon = area.icon;
        return (
          <Link className={currentHref === area.href ? "active" : undefined} href={area.href} key={area.href}>
            <span><Icon size={22} /></span>
            <b>{area.label}</b>
            <small>{area.description}</small>
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminTruthState({
  title,
  text,
  tone = "neutral",
  icon: Icon = Activity,
  action
}: {
  title: ReactNode;
  text: ReactNode;
  tone?: "good" | "warning" | "danger" | "neutral";
  icon?: Icon;
  action?: ReactNode;
}) {
  return (
    <article className={`platform-admin-truth state-${tone}`}>
      <span aria-hidden="true"><Icon size={21} /></span>
      <div><b>{title}</b><p>{text}</p></div>
      {action ? <div className="platform-admin-truth-action">{action}</div> : null}
    </article>
  );
}

export function AdminSectionIntro({
  eyebrow,
  title,
  text,
  actions
}: {
  eyebrow: string;
  title: ReactNode;
  text: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="platform-admin-intro">
      <div><span>{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>
      {actions ? <div className="platform-admin-intro-actions">{actions}</div> : null}
    </header>
  );
}
