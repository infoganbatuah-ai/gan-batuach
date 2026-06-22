import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronLeft,
  Home,
  Menu,
  ShieldCheck,
  UserRound
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import {
  AppShell,
  BottomNav,
  ResponsivePage,
  SidebarNav
} from "@/components/gan-batuach-design-system";

type AdminProfile = {
  full_name?: string | null;
  profile_image_url?: string | null;
};

const adminNavItems = [
  { href: "/dashboard/admin/kindergartens", label: "גנים", icon: Home },
  { href: "/dashboard/admin/tasks", label: "יומן", icon: CalendarDays },
  { href: "/dashboard/admin", label: "אדמין", icon: ShieldCheck },
  { href: "/dashboard/admin/notifications", label: "התראות", icon: Bell, badge: "2" },
  { href: "/dashboard/admin/settings", label: "עוד", icon: Menu }
];

export function AdminAppFrame({
  profile,
  activeHref = "/dashboard/admin",
  children,
  title = "מרכז שליטה ארצי",
  subtitle = "תמונת מצב מלאה, מהירה ומדויקת לכל מערכת גן בטוח.",
  badge = "✨ תפעול בטוח לילדים",
  backHref
}: {
  profile: AdminProfile;
  activeHref?: string;
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  backHref?: string;
}) {
  const firstName = String(profile.full_name ?? "אדמין").split(" ").filter(Boolean)[0] ?? "אדמין";
  const header = (
    <header className="admin-app-header">
      <div className="admin-header-actions">
        <span className="admin-avatar-wrap">
          <Avatar name={profile.full_name ?? firstName} src={profile.profile_image_url} size="lg" />
          <i />
        </span>
        {backHref ? (
          <Link className="admin-icon-button" href={backHref} aria-label="חזרה">
            <ChevronLeft size={26} />
          </Link>
        ) : null}
        <button type="button" className="admin-icon-button" aria-label="התראות">
          <Bell size={24} />
          <i />
        </button>
      </div>
      <div className="admin-brand-block">
        <div className="admin-brand-logo">
          <Image src="/assets/company-symbol.png" alt="" width={82} height={82} priority />
          <Image src="/assets/company-name.png" alt="גן בטוח" width={210} height={76} priority />
        </div>
        <div className="admin-page-title">
          {badge ? <span>{badge}</span> : null}
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
    </header>
  );

  const sidebar = (
    <SidebarNav
      title="אדמין"
      activeHref={activeHref}
      items={[
        ...adminNavItems,
        { href: "/dashboard/admin/kindergartens", label: "גנים", icon: ShieldCheck, hint: "ניהול ובקרה" },
        { href: "/dashboard/admin/inspectors", label: "מפקחים", icon: UserRound, hint: "שיוך ועומסים" },
        { href: "/dashboard/admin/subscriptions", label: "מנויים", icon: BarChart3, hint: "הכנסות וסיכון" }
      ]}
    />
  );

  return (
    <AppShell
      className="admin-app-shell"
      header={header}
      sidebar={sidebar}
      bottomNav={<BottomNav className="admin-bottom-nav" activeHref={activeHref} items={adminNavItems} />}
    >
      <ResponsivePage className="admin-app-page" size="lg">
        {children}
      </ResponsivePage>
    </AppShell>
  );
}
