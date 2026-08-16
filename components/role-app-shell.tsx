import Image from "next/image";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  Camera,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  Home,
  Menu,
  MessageCircle,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  WalletCards
} from "lucide-react";
import {
  AppShell,
  BottomNav,
  ResponsivePage,
  SidebarNav
} from "@/components/gan-batuach-design-system";
import { LogoutButton } from "@/components/logout-button";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";

type IconType = ComponentType<LucideProps>;

export type RoleAppShellRole =
  | "admin"
  | "manager"
  | "owner"
  | "parent"
  | "staff"
  | "inspector"
  | "digital-observer";

export type RoleAppNavItem = {
  href: string;
  label: string;
  icon: IconType;
  hint?: string;
  badge?: ReactNode;
};

export type RoleAppShellProfile = {
  full_name?: string | null;
  profile_image_url?: string | null;
};

export const roleAppShellConfig: Record<RoleAppShellRole, {
  label: string;
  homeHref: string;
  settingsHref: string;
  notificationsHref: string;
  subtitle: string;
  nav: RoleAppNavItem[];
}> = {
  admin: {
    label: "אדמין",
    homeHref: "/dashboard/admin",
    settingsHref: "/dashboard/admin/settings",
    notificationsHref: "/dashboard/admin/notifications",
    subtitle: "תפעול, אבטחה, מנויים ומוכנות השקה",
    nav: [
      { href: "/dashboard/admin", label: "ראשי", icon: ShieldCheck },
      { href: "/dashboard/admin/kindergartens", label: "גנים", icon: Home },
      { href: "/dashboard/admin/subscriptions", label: "מנויים", icon: WalletCards },
      { href: "/dashboard/admin/notifications", label: "התראות", icon: Bell },
      { href: "/dashboard/admin/settings", label: "עוד", icon: Menu }
    ]
  },
  manager: {
    label: "גננת",
    homeHref: "/dashboard/garden/operations",
    settingsHref: "/dashboard/garden/settings",
    notificationsHref: "/dashboard/garden/notifications",
    subtitle: "ניהול גן, ילדים, צוות, תשלומים ומסמכים",
    nav: [
      { href: "/dashboard/garden/operations", label: "בית", icon: Home },
      { href: "/dashboard/garden/attendance", label: "נוכחות", icon: ClipboardCheck },
      { href: "/dashboard/garden/cameras", label: "מצלמות", icon: Camera },
      { href: "/dashboard/garden/notifications", label: "התראות", icon: Bell },
      { href: "/dashboard/garden/settings", label: "עוד", icon: Menu }
    ]
  },
  owner: {
    label: "בעלים",
    homeHref: "/dashboard/garden/operations",
    settingsHref: "/dashboard/garden/settings",
    notificationsHref: "/dashboard/garden/notifications",
    subtitle: "ניהול גן, ילדים, צוות, תשלומים ומסמכים",
    nav: [
      { href: "/dashboard/garden/operations", label: "בית", icon: Home },
      { href: "/dashboard/garden/payments", label: "תשלומים", icon: WalletCards },
      { href: "/dashboard/garden/reports", label: "דוחות", icon: BarChart3 },
      { href: "/dashboard/garden/notifications", label: "התראות", icon: Bell },
      { href: "/dashboard/garden/settings", label: "עוד", icon: Menu }
    ]
  },
  parent: {
    label: "הורה",
    homeHref: "/dashboard/parent",
    settingsHref: "/dashboard/parent/settings",
    notificationsHref: "/dashboard/parent/notifications",
    subtitle: "ילדים, גנים, הודעות, תשלומים ומעקב",
    nav: [
      { href: "/dashboard/parent", label: "בית", icon: Home },
      { href: "/dashboard/parent/discover-kindergartens", label: "גנים", icon: Search },
      { href: "/dashboard/parent/messages", label: "הודעות", icon: MessageCircle },
      { href: "/dashboard/parent/notifications", label: "התראות", icon: Bell },
      { href: "/dashboard/parent/settings", label: "עוד", icon: Menu }
    ]
  },
  staff: {
    label: "צוות",
    homeHref: "/dashboard/staff",
    settingsHref: "/dashboard/staff/settings",
    notificationsHref: "/dashboard/staff/notifications",
    subtitle: "משמרות, משימות, מסמכים ותקשורת",
    nav: [
      { href: "/dashboard/staff", label: "ראשי", icon: Home },
      { href: "/dashboard/staff/shifts", label: "משמרות", icon: CalendarDays },
      { href: "/dashboard/staff/messages", label: "הודעות", icon: MessageCircle },
      { href: "/dashboard/staff/settings", label: "פרופיל", icon: UserRound },
      { href: "/dashboard/staff/tasks", label: "עוד", icon: Menu }
    ]
  },
  inspector: {
    label: "מפקח",
    homeHref: "/dashboard/inspector",
    settingsHref: "/dashboard/inspector/settings",
    notificationsHref: "/dashboard/inspector/notifications",
    subtitle: "גנים משויכים, ביקורות, ליקויים ודוחות",
    nav: [
      { href: "/dashboard/inspector", label: "ראשי", icon: Home },
      { href: "/dashboard/inspector/inspections", label: "ביקורות", icon: ClipboardCheck },
      { href: "/dashboard/inspector/reports", label: "דוחות", icon: FileText },
      { href: "/dashboard/inspector/notifications", label: "התראות", icon: Bell },
      { href: "/dashboard/inspector/settings", label: "פרופיל", icon: UserRound }
    ]
  },
  "digital-observer": {
    label: "Digital Observer",
    homeHref: "/digital-observer/dashboard",
    settingsHref: "/digital-observer/settings",
    notificationsHref: "/digital-observer/alerts",
    subtitle: "אתרים, מצלמות, התראות, תצפיתן וחיוב",
    nav: [
      { href: "/digital-observer/dashboard", label: "ראשי", icon: Home },
      { href: "/digital-observer/onboarding", label: "הקמה", icon: Camera },
      { href: "/digital-observer/billing", label: "חיוב", icon: WalletCards },
      { href: "/digital-observer/alerts", label: "התראות", icon: Bell },
      { href: "/digital-observer/settings", label: "הגדרות", icon: Menu }
    ]
  }
};

export function RoleAppShell({
  role,
  activeHref,
  title,
  subtitle,
  profile,
  backHref,
  children,
  actions,
  className
}: {
  role: RoleAppShellRole;
  activeHref?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  profile?: RoleAppShellProfile | null;
  backHref?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const config = roleAppShellConfig[role];
  const resolvedActive = activeHref ?? config.homeHref;
  const displayName = cleanSyntheticLabel(profile?.full_name, config.label);
  const firstLetter = String(displayName).trim().slice(0, 1) || "ג";
  const header = (
    <header className="role-app-header">
      <div className="role-app-brand">
        <Link className="role-app-logo" href={config.homeHref} aria-label="גן בטוח">
          <Image src="/assets/company-symbol.png" alt="" width={54} height={54} priority />
          <Image src="/assets/company-name.png" alt="גן בטוח" width={174} height={60} priority />
        </Link>
        <div className="role-app-title">
          <h1>{title ?? config.label}</h1>
          <p>{subtitle ?? config.subtitle}</p>
        </div>
      </div>
      <div className="role-app-actions">
        {backHref ? (
          <Link className="role-app-icon-button" href={backHref} aria-label="חזרה">
            <ChevronLeft size={24} />
          </Link>
        ) : null}
        <Link className="role-app-avatar" href={config.settingsHref} aria-label="פרופיל">
          {profile?.profile_image_url ? <img src={profile.profile_image_url} alt="" /> : <span>{firstLetter}</span>}
        </Link>
        <Link className="role-app-icon-button" href={config.notificationsHref} aria-label="התראות">
          <Bell size={23} />
        </Link>
        {actions}
        <LogoutButton />
      </div>
    </header>
  );
  const sidebar = (
    <SidebarNav
      title={<span className="role-app-sidebar-title"><b>{config.label}</b><span>{config.subtitle}</span></span>}
      activeHref={resolvedActive}
      items={config.nav}
    />
  );

  return (
    <AppShell
      className={`role-app-shell role-app-${role} ${className ?? ""}`}
      header={header}
      sidebar={sidebar}
      bottomNav={<BottomNav className="role-app-bottom-nav" activeHref={resolvedActive} items={config.nav} />}
    >
      <ResponsivePage className="role-app-page" size="lg">
        {children}
      </ResponsivePage>
    </AppShell>
  );
}

export function createRoleAppShellAdapter(role: RoleAppShellRole) {
  return function RoleAppShellAdapter({
    children,
    activeHref,
    title,
    subtitle,
    profile,
    backHref
  }: {
    children: ReactNode;
    activeHref?: string;
    title?: ReactNode;
    subtitle?: ReactNode;
    profile?: RoleAppShellProfile | null;
    backHref?: string;
  }) {
    return (
      <RoleAppShell role={role} activeHref={activeHref} title={title} subtitle={subtitle} profile={profile} backHref={backHref}>
        {children}
      </RoleAppShell>
    );
  };
}

export const ManagerRoleAppShell = createRoleAppShellAdapter("manager");
export const ParentRoleAppShell = createRoleAppShellAdapter("parent");
export const StaffRoleAppShell = createRoleAppShellAdapter("staff");
export const InspectorRoleAppShell = createRoleAppShellAdapter("inspector");
export const AdminRoleAppShell = createRoleAppShellAdapter("admin");
export const DigitalObserverRoleAppShell = createRoleAppShellAdapter("digital-observer");
