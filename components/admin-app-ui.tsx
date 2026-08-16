import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronLeft,
  CreditCard,
  Home,
  Menu,
  Search,
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
import { RoleAppShell } from "@/components/role-app-shell";

type AdminProfile = {
  full_name?: string | null;
  profile_image_url?: string | null;
};

const adminNavItems = [
  { href: "/dashboard/admin", label: "ראשי", icon: ShieldCheck },
  { href: "/dashboard/admin/kindergarten-applications", label: "אישורים", icon: CalendarDays },
  { href: "/dashboard/admin/users", label: "משתמשים", icon: UserRound },
  { href: "/dashboard/admin/subscriptions", label: "תשלומים", icon: CreditCard },
  { href: "/dashboard/admin/notifications", label: "התראות", icon: Bell, badge: "2" },
  { href: "/dashboard/admin/settings", label: "עוד", icon: Menu }
];

export function AdminAppFrame({
  profile,
  activeHref = "/dashboard/admin",
  children,
  title = "מרכז שליטה ארצי",
  subtitle = "תמונת מצב מלאה, מהירה ומדויקת לכל מערכת גן בטוח.",
  badge = "תפעול מבוקר",
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
  return (
    <RoleAppShell
      role="admin"
      activeHref={activeHref}
      title={title}
      subtitle={subtitle}
      profile={profile}
      backHref={backHref}
      actions={badge ? <span className="dashboard-header-badge">{badge}</span> : undefined}
      className="admin-runtime-shell"
    >
      <div className="admin-app-page dashboard-runtime-content">
        {children}
      </div>
    </RoleAppShell>
  );
}
