import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  Camera,
  ChevronLeft,
  CircleUserRound,
  CreditCard,
  Eye,
  KeyRound,
  Languages,
  LockKeyhole,
  PlugZap,
  Settings,
  ShieldCheck,
  Smartphone,
  UsersRound
} from "lucide-react";
import type { UserRole } from "@/lib/roles";

type SettingsRole = Extract<UserRole, "admin" | "inspector" | "manager" | "owner" | "staff" | "parent">;

type SettingsArea = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  roles?: SettingsRole[];
};

const profileRoutes: Record<SettingsRole, string> = {
  admin: "/dashboard/admin/settings",
  inspector: "/dashboard/inspector/settings",
  manager: "/dashboard/garden/settings",
  owner: "/dashboard/garden/settings",
  staff: "/dashboard/staff/settings",
  parent: "/dashboard/parent/settings"
};

const notificationRoutes: Record<SettingsRole, string> = {
  admin: "/dashboard/admin/notifications",
  inspector: "/dashboard/inspector/notifications",
  manager: "/dashboard/garden/notifications",
  owner: "/dashboard/garden/notifications",
  staff: "/dashboard/staff/notifications",
  parent: "/dashboard/parent/notifications"
};

function areasFor(role: SettingsRole): SettingsArea[] {
  const areas: SettingsArea[] = [
    { label: "פרופיל אישי", description: "שם, תמונה ופרטי קשר", href: profileRoutes[role], icon: CircleUserRound },
    { label: "אבטחה", description: "MFA, Passkey, מכשירים וסשנים", href: "/dashboard/security-settings", icon: LockKeyhole },
    { label: "התראות", description: "ערוצים, קטגוריות ושעות שקט", href: notificationRoutes[role], icon: Bell },
    { label: "הגן שלי", description: "פרופיל, שעות ומבנה הגן", href: "/dashboard/garden/settings#garden-profile", icon: Building2, roles: ["manager", "owner"] },
    { label: "משתמשים והרשאות", description: "תפקיד, גן, כיתה והיקף גישה", href: role === "admin" ? "/dashboard/admin/users" : "/dashboard/garden/staff", icon: UsersRound, roles: ["admin", "manager", "owner"] },
    { label: "הרשאות מצלמה", description: "מדיניות צפייה לפי תפקיד ואזור", href: role === "admin" ? "/dashboard/admin/camera-permissions" : role === "parent" ? "/dashboard/parent/cameras" : role === "staff" ? "/dashboard/staff/cameras" : role === "inspector" ? "/dashboard/inspector/cameras" : "/dashboard/garden/cameras", icon: Camera },
    { label: "מנוי ותשלומים", description: "תוכנית הגן ומוכנות חיוב", href: role === "admin" ? "/dashboard/admin/subscriptions" : "/dashboard/garden/subscription", icon: CreditCard, roles: ["admin", "manager", "owner"] },
    { label: "אינטגרציות", description: "מוכנות ספקים ושירותים", href: role === "admin" ? "/dashboard/admin/provider-production" : role === "manager" || role === "owner" ? "/dashboard/garden/cameras" : profileRoutes[role] + "#integrations", icon: PlugZap },
    { label: "שפה, אזור זמן ונגישות", description: "העדפות תצוגה מקומיות", href: notificationRoutes[role] + "#preferences", icon: Languages },
    { label: "פרטיות", description: "מצב גישה ומידע מורשה", href: profileRoutes[role] + "#privacy", icon: Eye }
  ];
  return areas.filter((area) => !area.roles || area.roles.includes(role));
}

export function SettingsPlatformHeader({ title = "הגדרות", description, role, eyebrow = "SETTINGS & ACCOUNT" }: { title?: string; description: string; role: SettingsRole; eyebrow?: string }) {
  return <section className="ux18-settings-header" aria-labelledby="settings-page-title">
    <div><span>{eyebrow}</span><h2 id="settings-page-title">{title}</h2><p>{description}</p></div>
    <div className="ux18-settings-shield"><ShieldCheck aria-hidden="true" /><span><b>הגנה לפי תפקיד</b><small>{role === "admin" ? "הרשאת פלטפורמה" : "גישה אישית ומוגבלת"}</small></span></div>
  </section>;
}

export function SettingsPlatformNavigation({ role, activeHref }: { role: SettingsRole; activeHref: string }) {
  const areas = areasFor(role);
  return <nav className="ux18-settings-navigation" aria-label="קטגוריות הגדרות">
    <div className="ux18-settings-navigation-title"><Settings aria-hidden="true" /><span><b>הגדרות</b><small>חשבון, גישה והעדפות</small></span></div>
    <div className="ux18-settings-navigation-list">
      {areas.map((area) => {
        const Icon = area.icon;
        const active = area.href.split("#")[0] === activeHref;
        return <Link key={`${area.label}-${area.href}`} href={area.href} aria-current={active ? "page" : undefined} className={active ? "is-active" : undefined}>
          <Icon aria-hidden="true" /><span><b>{area.label}</b><small>{area.description}</small></span><ChevronLeft aria-hidden="true" />
        </Link>;
      })}
    </div>
  </nav>;
}

export function SettingsPlatformLayout({ navigation, children }: { navigation: React.ReactNode; children: React.ReactNode }) {
  return <div className="ux18-settings-layout"><aside>{navigation}</aside><div className="ux18-settings-content">{children}</div></div>;
}

export function SettingsSection({ id, title, description, icon: Icon, action, children }: { id?: string; title: string; description?: string; icon: LucideIcon; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="ux18-settings-section" id={id} aria-labelledby={id ? `${id}-title` : undefined}>
    <header><span className="ux18-settings-section-icon"><Icon aria-hidden="true" /></span><div><h3 id={id ? `${id}-title` : undefined}>{title}</h3>{description ? <p>{description}</p> : null}</div>{action ? <div className="ux18-settings-section-action">{action}</div> : null}</header>
    <div className="ux18-settings-section-body">{children}</div>
  </section>;
}

export function SettingsStatusGrid({ children }: { children: React.ReactNode }) {
  return <div className="ux18-settings-status-grid">{children}</div>;
}

export function SettingsStatusCard({ label, value, detail, icon: Icon, tone = "blue", href }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: "blue" | "green" | "orange" | "purple" | "red"; href?: string }) {
  const content = <><span className={`ux18-settings-status-icon ${tone}`}><Icon aria-hidden="true" /></span><span><small>{label}</small><b>{value}</b><em>{detail}</em></span>{href ? <ChevronLeft aria-hidden="true" /> : null}</>;
  return href ? <Link className="ux18-settings-status-card" href={href}>{content}</Link> : <article className="ux18-settings-status-card">{content}</article>;
}

export function AccountVerificationSummary({ email, emailVerified, phone, phoneVerified, securityHref = "/dashboard/security-settings" }: { email?: string | null; emailVerified: boolean; phone?: string | null; phoneVerified: boolean; securityHref?: string }) {
  return <div className="ux18-verification-grid">
    <article><span className={emailVerified ? "good" : "warn"}><ShieldCheck aria-hidden="true" /></span><div><b>דוא״ל</b><small dir="ltr">{email ?? "לא הוגדר"}</small><em>{emailVerified ? "מאומת · החשבון כשיר להפעלה רגילה" : "ממתין לאימות"}</em></div></article>
    <article><span className={phoneVerified ? "good" : "neutral"}><Smartphone aria-hidden="true" /></span><div><b>טלפון</b><small dir="ltr">{phone ?? "לא הוגדר"}</small><em>{phoneVerified ? "מאומת" : "לא מאומת · אימות טלפון אינו חובה"}</em></div></article>
    <Link href={securityHref}><span className="blue"><KeyRound aria-hidden="true" /></span><div><b>אבטחת חשבון</b><small>סיסמה, MFA, Passkey וסשנים</small><em>פתיחת מרכז האבטחה</em></div><ChevronLeft aria-hidden="true" /></Link>
  </div>;
}

export function SettingsLinkList({ items }: { items: Array<{ title: string; detail: string; href: string; status?: string; icon: LucideIcon }> }) {
  return <div className="ux18-settings-link-list">{items.map((item) => { const Icon = item.icon; return <Link href={item.href} key={`${item.href}-${item.title}`}><Icon aria-hidden="true" /><span><b>{item.title}</b><small>{item.detail}</small></span>{item.status ? <em>{item.status}</em> : null}<ChevronLeft aria-hidden="true" /></Link>; })}</div>;
}
