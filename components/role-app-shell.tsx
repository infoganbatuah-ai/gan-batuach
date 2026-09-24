import Image from "next/image";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import {
  BarChart3,
  Bell,
  BookOpenCheck,
  CalendarDays,
  Camera,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  Home,
  Menu,
  MessageCircle,
  Settings,
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
import { ManagementGardenContextSlot } from "@/components/management-garden-context-slot";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { israelTodayDateLine } from "@/lib/domain/israel-date";

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
  desktopNav?: RoleAppNavItem[];
}> = {
  admin: {
    label: "אדמין",
    homeHref: "/dashboard/admin",
    settingsHref: "/dashboard/admin/settings",
    notificationsHref: "/dashboard/admin/notifications",
    subtitle: "תפעול, אבטחה, מנויים ומוכנות השקה",
    nav: [
      { href: "/dashboard/admin", label: "בית", icon: Home },
      { href: "/dashboard/admin/kindergartens", label: "גנים", icon: UsersRound },
      { href: "/dashboard/admin/inspectors", label: "פיקוח", icon: ShieldCheck },
      { href: "/dashboard/admin/reports", label: "דוחות", icon: BarChart3 },
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
      { href: "/dashboard/garden/children", label: "ילדים", icon: UsersRound },
      { href: "/dashboard/garden/staff", label: "צוות", icon: UserRound },
      { href: "/dashboard/garden/messages", label: "תקשורת", icon: MessageCircle },
      { href: "/dashboard/garden/command-center", label: "עוד", icon: Menu }
    ],
    desktopNav: ownerDesktopNavigation()
  },
  owner: {
    label: "בעלים",
    homeHref: "/dashboard/garden/operations",
    settingsHref: "/dashboard/garden/settings",
    notificationsHref: "/dashboard/garden/notifications",
    subtitle: "ניהול גן, ילדים, צוות, תשלומים ומסמכים",
    nav: [
      { href: "/dashboard/garden/operations", label: "בית", icon: Home },
      { href: "/dashboard/garden/children", label: "ילדים", icon: UsersRound },
      { href: "/dashboard/garden/staff", label: "צוות", icon: UserRound },
      { href: "/dashboard/garden/messages", label: "תקשורת", icon: MessageCircle },
      { href: "/dashboard/garden/command-center", label: "עוד", icon: Menu }
    ],
    desktopNav: ownerDesktopNavigation()
  },
  parent: {
    label: "הורה",
    homeHref: "/dashboard/parent",
    settingsHref: "/dashboard/parent/settings",
    notificationsHref: "/dashboard/parent/notifications",
    subtitle: "ילדים, גנים, הודעות, תשלומים ומעקב",
    nav: [
      { href: "/dashboard/parent", label: "בית", icon: Home },
      { href: "/dashboard/parent/attendance", label: "נוכחות", icon: BookOpenCheck },
      { href: "/dashboard/parent/cameras", label: "מצלמות", icon: Camera },
      { href: "/dashboard/parent/messages", label: "הודעות", icon: MessageCircle },
      { href: "/dashboard/parent/settings", label: "עוד", icon: Menu }
    ],
    desktopNav: parentDesktopNavigation()
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
      { href: "/dashboard/staff/tasks", label: "משימות", icon: ClipboardCheck },
      { href: "/dashboard/staff/messages", label: "הודעות", icon: MessageCircle },
      { href: "/dashboard/staff/settings", label: "עוד", icon: Menu }
    ],
    desktopNav: [
      { href: "/dashboard/staff", label: "ראשי", hint: "המשמרת והיום שלי", icon: Home },
      { href: "/dashboard/staff/shifts", label: "משמרות ושעות", hint: "לוח, החתמות והיסטוריה", icon: CalendarDays },
      { href: "/dashboard/staff/children-attendance", label: "נוכחות ילדים", hint: "לפי שיוך הכיתה שלי", icon: BookOpenCheck },
      { href: "/dashboard/staff/pickup", label: "איסוף ושחרור", hint: "אימות מורשי איסוף", icon: ShieldCheck },
      { href: "/dashboard/staff/tasks", label: "משימות", hint: "פתוחות, באיחור והושלמו", icon: ClipboardCheck },
      { href: "/dashboard/staff/messages", label: "הודעות", hint: "שיחות מורשות בגן", icon: MessageCircle },
      { href: "/dashboard/staff/documents", label: "מסמכים", hint: "אישורים ותוקף", icon: FileText },
      { href: "/dashboard/staff/cameras", label: "בטיחות ומצלמות", hint: "לפי הרשאת הגן", icon: Camera },
      { href: "/dashboard/staff/settings", label: "הגדרות", hint: "פרופיל, אבטחה והעדפות", icon: Settings }
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
      { href: "/dashboard/inspector/control-center", label: "גנים", icon: UsersRound },
      { href: "/dashboard/inspector/reports", label: "דוחות", icon: BarChart3 },
      { href: "/dashboard/inspector/notifications", label: "התראות", icon: Bell }
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
  const todayLine = israelTodayDateLine();
  const isManagement = role === "manager" || role === "owner";
  const header = (
    <header className="role-app-header">
      <div className="role-app-brand">
        <Link className="role-app-logo" href={config.homeHref} aria-label="גן בטוח">
          <Image src="/assets/company-symbol.png" alt="" width={54} height={54} style={{ height: "auto" }} priority />
          <Image src="/assets/company-name.png" alt="גן בטוח" width={620} height={210} style={{ height: "auto" }} priority />
        </Link>
      </div>
      <div className="role-app-header-meta">
        <div className="role-app-title">
          <h1>{title ?? config.label}</h1>
          <p>{subtitle ?? config.subtitle}</p>
        </div>
        {isManagement ? <ManagementGardenContextSlot /> : null}
        <div className="role-app-live-date" aria-label="התאריך היום">
          <CalendarDays size={27} />
          <span><b>{todayLine.top}</b><small>{todayLine.bottom}</small></span>
        </div>
      </div>
      <div className="role-app-actions">
        {backHref ? (
          <Link className="role-app-icon-button" href={backHref} aria-label="חזרה">
            <ChevronLeft size={24} />
          </Link>
        ) : null}
        <Link className="role-app-avatar" href={config.settingsHref} aria-label="פתיחת הפרופיל בתוך המסך" data-live-panel="profile">
          {profile?.profile_image_url ? <img src={profile.profile_image_url} alt="" /> : <span>{firstLetter}</span>}
        </Link>
        <Link className="role-app-icon-button" href={config.notificationsHref} aria-label="התראות">
          <Bell size={23} />
        </Link>
        {actions}
        <LogoutButton compact />
      </div>
    </header>
  );
  const sidebar = (
    <SidebarNav
      className={isManagement ? "owner-command-sidebar" : undefined}
      title={<div className="role-app-sidebar-heading">
        <Link className="role-app-sidebar-brand" href={config.homeHref} aria-label="גן בטוח — ראשי">
          <Image src="/assets/company-symbol.png" alt="" width={72} height={72} />
          <span><b>גן בטוח</b><small>ילדים בטוחים · עתיד טוב יותר</small></span>
        </Link>
        <span className="role-app-sidebar-title"><b>{config.label}</b><span>{config.subtitle}</span></span>
      </div>}
      activeHref={resolvedActive}
      items={config.desktopNav ?? config.nav}
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

function ownerDesktopNavigation(): RoleAppNavItem[] {
  return [
    { href: "/dashboard/garden/operations", label: "ראשי", hint: "תמונת מצב יומית", icon: Home },
    { href: "/dashboard/garden/children", label: "ילדים וכיתות", hint: "ילדים, כיתות וקיבולת", icon: UsersRound },
    { href: "/dashboard/garden/attendance", label: "נוכחות ואיסוף", hint: "הגעה, יציאה ומורשי איסוף", icon: BookOpenCheck },
    { href: "/dashboard/garden/staff", label: "צוות", hint: "עובדים, משמרות ושעות", icon: UserRound },
    { href: "/dashboard/garden/messages", label: "תקשורת", hint: "הודעות, שידורים והתראות", icon: MessageCircle },
    { href: "/dashboard/garden/finance", label: "כספים", hint: "שכר לימוד ומנוי הגן", icon: WalletCards },
    { href: "/dashboard/garden/command-center", label: "תפעול", hint: "משימות, תלונות וביקורות", icon: ClipboardCheck },
    { href: "/dashboard/garden/cameras", label: "בטיחות ומצלמות", hint: "מוכנות, מצלמות ואירועים", icon: Camera },
    { href: "/dashboard/garden/documents", label: "מסמכים", hint: "חסר, לבדיקה ותוקף", icon: FileText },
    { href: "/dashboard/garden/reports", label: "דוחות", hint: "תפעול, כספים ופיקוח", icon: BarChart3 },
    { href: "/dashboard/garden/settings", label: "הגדרות", hint: "גן, הרשאות וחשבון", icon: Settings }
  ];
}

function parentDesktopNavigation(): RoleAppNavItem[] {
  return [
    { href: "/dashboard/parent", label: "ראשי", hint: "היום של הילדים", icon: Home },
    { href: "/dashboard/parent/family-home", label: "הילדים שלי", hint: "כרטיסים ועדכונים", icon: UsersRound },
    { href: "/dashboard/parent/discover-kindergartens", label: "הרשמה לגן", hint: "גילוי ובקשות הצטרפות", icon: BookOpenCheck },
    { href: "/dashboard/parent/attendance", label: "נוכחות", hint: "הגעה, יציאה והיסטוריה", icon: CalendarDays },
    { href: "/dashboard/parent/payments", label: "תשלומים", hint: "שכר לימוד בלבד", icon: WalletCards },
    { href: "/dashboard/parent/cameras", label: "מצלמות", hint: "צפייה מורשית ובטיחות", icon: Camera },
    { href: "/dashboard/parent/messages", label: "הודעות", hint: "שיחה מאובטחת עם הגן", icon: MessageCircle },
    { href: "/dashboard/parent/notifications", label: "התראות", hint: "עדכונים ופעולות", icon: Bell },
    { href: "/dashboard/parent/documents", label: "מסמכים", hint: "אישורים וקבצים", icon: FileText },
    { href: "/dashboard/parent/schedule", label: "יומן", hint: "אירועים ופעילות", icon: CalendarDays },
    { href: "/dashboard/parent/settings", label: "הגדרות", hint: "פרופיל, אבטחה והעדפות", icon: Settings }
  ];
}
