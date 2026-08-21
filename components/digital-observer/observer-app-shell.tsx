import Link from "next/link";
import type { ReactNode } from "react";
import {
  Bell,
  Building2,
  Camera,
  CircleHelp,
  CreditCard,
  Eye,
  FileVideo2,
  Home,
  Menu,
  Radar,
  Settings,
  ShieldCheck,
  UsersRound,
  X
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import type { ObserverMode } from "@/lib/domain/digital-observer/runtime";

type ObserverShellProfile = {
  full_name?: string | null;
  email?: string | null;
  profile_image_url?: string | null;
  role?: string | null;
};

const homeNav = [
  { href: "/digital-observer/dashboard", label: "בית", icon: Home },
  { href: "/digital-observer/cameras", label: "צפייה חיה", icon: Camera },
  { href: "/digital-observer/alerts", label: "אירועים", icon: Bell },
  { href: "/digital-observer/rules", label: "התצפיתן שלי", icon: Radar },
  { href: "/digital-observer/recordings", label: "הקלטות", icon: FileVideo2 },
  { href: "/digital-observer/people", label: "אנשים מוכרים", icon: UsersRound },
  { href: "/digital-observer/billing", label: "מנוי וחיוב", icon: CreditCard },
  { href: "/digital-observer/settings", label: "הגדרות", icon: Settings }
] as const;

const businessNav = [
  { href: "/digital-observer/dashboard", label: "סקירת העסק", icon: Home },
  { href: "/digital-observer/sites", label: "אתרים", icon: Building2 },
  { href: "/digital-observer/cameras", label: "מצלמות", icon: Camera },
  { href: "/digital-observer/alerts", label: "אירועים פתוחים", icon: Bell },
  { href: "/digital-observer/recordings", label: "קליפים", icon: FileVideo2 },
  { href: "/digital-observer/rules", label: "כללי ניטור", icon: Radar },
  { href: "/digital-observer/people", label: "צוות והרשאות", icon: UsersRound },
  { href: "/digital-observer/billing", label: "מנוי וחיוב", icon: CreditCard },
  { href: "/digital-observer/settings", label: "הגדרות", icon: Settings }
] as const;

const adminNav = [
  { href: "/digital-observer/admin", label: "מרכז בקרה", icon: ShieldCheck },
  { href: "/digital-observer/admin/access", label: "לקוחות ואתרים", icon: UsersRound },
  { href: "/digital-observer/admin/operations", label: "מנוע ותפעול", icon: Radar },
  { href: "/digital-observer/admin/billing", label: "מנויים וחיוב", icon: CreditCard },
  { href: "/digital-observer/admin/packages", label: "חבילות", icon: Settings }
] as const;

export function ObserverMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "do-mark compact" : "do-mark"} aria-hidden="true">
      <ShieldCheck />
      <Eye />
    </span>
  );
}

export function ObserverAppShell({
  profile,
  mode,
  activeHref,
  title,
  statusLabel,
  children,
  actions
}: {
  profile?: ObserverShellProfile | null;
  mode: ObserverMode | "admin";
  activeHref: string;
  title: string;
  statusLabel?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const baseNav = mode === "admin" ? adminNav : mode === "home" ? homeNav : businessNav;
  const nav = mode !== "admin" && profile?.role === "admin"
    ? [...baseNav, { href: "/digital-observer/admin", label: "ניהול מערכת", icon: ShieldCheck }]
    : [...baseNav];
  const displayName = cleanSyntheticLabel(profile?.full_name, mode === "home" ? "הבית שלי" : mode === "admin" ? "מנהל התצפיתן" : "העסק שלי");
  const initial = displayName.trim().slice(0, 1) || "צ";
  const mobileNav = mode === "admin"
    ? adminNav
    : [nav[0], nav.find((item) => item.href === "/digital-observer/cameras")!, nav.find((item) => item.href === "/digital-observer/rules")!, nav.find((item) => item.href === "/digital-observer/alerts")!, nav.find((item) => item.href === "/digital-observer/settings")!];

  return (
    <div className={`do-shell do-mode-${mode}`} data-observer-mode={mode} dir="rtl">
      <aside className="do-sidebar">
        <Link className="do-sidebar-brand" href={mode === "admin" ? "/digital-observer/admin" : "/digital-observer/dashboard"}>
          <ObserverMark />
          <span><b>תצפיתן דיגיטלי</b><small>{mode === "home" ? "הבית שלך, בשליטה מלאה" : mode === "admin" ? "מרכז בקרה עצמאי" : "בקרה חכמה לעסק"}</small></span>
        </Link>
        <nav aria-label="ניווט התצפיתן הדיגיטלי">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = activeHref === item.href || (item.href !== "/digital-observer/dashboard" && activeHref.startsWith(item.href));
            return <Link className={active ? "active" : ""} href={item.href} key={item.href}><Icon /><span>{item.label}</span></Link>;
          })}
        </nav>
        <Link className="do-sidebar-help" href="/digital-observer/trust"><CircleHelp /><span>עזרה, פרטיות ואמון</span></Link>
      </aside>

      <div className="do-workspace">
        <header className="do-topbar">
          <div className="do-mobile-brand">
            <details className="do-mobile-menu">
              <summary aria-label="פתיחת תפריט"><Menu className="do-menu-open-icon" /><X className="do-menu-close-icon" /></summary>
              <div className="do-mobile-menu-sheet">
                <header>
                  <ObserverMark />
                  <span><b>תצפיתן דיגיטלי</b><small>{mode === "home" ? "הבית שלי" : mode === "admin" ? "מרכז הבקרה" : "העסק שלי"}</small></span>
                </header>
                <nav aria-label="כל מסכי התצפיתן">
                  {nav.map((item) => {
                    const Icon = item.icon;
                    const active = activeHref === item.href || (item.href !== "/digital-observer/dashboard" && activeHref.startsWith(item.href));
                    return <Link className={active ? "active" : ""} href={item.href} key={item.href}><Icon /><span>{item.label}</span></Link>;
                  })}
                </nav>
                <footer>
                  <Link href="/digital-observer/trust"><CircleHelp /><span>עזרה, פרטיות ואמון</span></Link>
                  <LogoutButton className="do-mobile-logout" redirectTo="/digital-observer/login" />
                </footer>
              </div>
            </details>
          </div>
          <div className="do-page-title"><h1>{title}</h1>{statusLabel ? <span className="do-live-dot">{statusLabel}</span> : null}</div>
          <div className="do-top-actions">
            {actions}
            <Link className="do-icon-button" href={mode === "admin" ? "/digital-observer/admin/operations#queues" : "/digital-observer/alerts"} aria-label="התראות"><Bell /></Link>
            <Link className="do-avatar" href={mode === "admin" ? "/digital-observer/admin/access" : "/digital-observer/settings"} aria-label="פרופיל והגדרות">
              {profile?.profile_image_url ? <img src={profile.profile_image_url} alt="" /> : <span>{initial}</span>}
            </Link>
            <LogoutButton compact redirectTo="/digital-observer/login" />
          </div>
        </header>
        <main className="do-content">{children}</main>
      </div>

      <nav className="do-bottom-nav" aria-label="ניווט תחתון">
        {mobileNav.map((item) => {
          const Icon = item.icon ?? Menu;
          const active = activeHref === item.href || (item.href !== "/digital-observer/dashboard" && activeHref.startsWith(item.href));
          return <Link className={active ? "active" : ""} href={item.href} key={item.href}><Icon /><span>{item.label}</span></Link>;
        })}
      </nav>
    </div>
  );
}
