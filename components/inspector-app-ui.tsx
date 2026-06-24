import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  BarChart3,
  Bell,
  CalendarCheck,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  Home,
  MapPin,
  Settings,
  UserRound
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import {
  ActionCard,
  AppShell,
  BottomNav,
  DashboardGrid,
  EmptyState,
  ListRowCard,
  MetricCard,
  PremiumCard,
  ResponsivePage,
  SectionHeader,
  SidebarNav,
  StatusChip
} from "@/components/gan-batuach-design-system";

type Tone = "default" | "primary" | "success" | "warning" | "danger" | "info" | "muted";

type InspectorProfile = {
  full_name?: string | null;
  profile_image_url?: string | null;
};

const navItems = [
  { href: "/dashboard/inspector", label: "ראשי", icon: Home },
  { href: "/dashboard/inspector/inspections", label: "ביקורות", icon: ClipboardCheck },
  { href: "/dashboard/inspector/control-center", label: "גנים", icon: Home },
  { href: "/dashboard/inspector/reports", label: "דוחות", icon: BarChart3 },
  { href: "/dashboard/inspector/settings", label: "פרופיל", icon: UserRound }
];

export function InspectorAppFrame({
  profile,
  activeHref,
  children,
  title,
  subtitle,
  badge,
  backHref
}: {
  profile: InspectorProfile;
  activeHref: string;
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  backHref?: string;
}) {
  const firstName = String(profile.full_name ?? "מפקח/ת").split(" ").filter(Boolean)[0] ?? "מפקח/ת";
  const header = (
    <header className="inspector-app-header">
      <div className="inspector-header-actions">
        <Link className="inspector-avatar-wrap" href="/dashboard/inspector/settings" aria-label="פרופיל מפקח">
          <Avatar name={profile.full_name ?? firstName} src={profile.profile_image_url} size="lg" />
          <i />
        </Link>
        <Link className="inspector-icon-button" href="/dashboard/inspector/notifications" aria-label="התראות">
          <Bell size={24} />
          <i />
        </Link>
        {backHref ? (
          <Link className="inspector-icon-button" href={backHref} aria-label="חזרה">
            <ChevronLeft size={26} />
          </Link>
        ) : null}
      </div>
      <div className="inspector-brand-block">
        <div className="inspector-brand-logo">
          <Image src="/assets/company-symbol.png" alt="" width={82} height={82} priority />
          <Image src="/assets/company-name.png" alt="גן בטוח" width={210} height={76} priority />
        </div>
        {title ? (
          <div className="inspector-page-title">
            {badge ? <span>{badge}</span> : null}
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        ) : (
          <div className="inspector-page-title">
            <span>💜 יום פיקוח משמעותי</span>
            <h1>בוקר טוב, {firstName}</h1>
            <p>עובדים. שומרים. אכפתיים.</p>
          </div>
        )}
      </div>
    </header>
  );

  const sidebar = (
    <SidebarNav
      title="מרכז מפקח"
      activeHref={activeHref}
      items={[
        ...navItems,
        { href: "/dashboard/inspector/inspections/history", label: "היסטוריה", icon: CalendarCheck, hint: "ביקורות עבר" },
        { href: "/dashboard/inspector/violations", label: "ליקויים", icon: FileText, hint: "מעקב תיקונים" },
        { href: "/dashboard/inspector/notifications", label: "התראות", icon: Bell, hint: "אירועים ועדכונים" }
      ]}
    />
  );

  return (
    <AppShell
      className="inspector-app-shell"
      header={header}
      sidebar={sidebar}
      bottomNav={<BottomNav className="inspector-bottom-nav" activeHref={activeHref} items={navItems} />}
    >
      <ResponsivePage className="inspector-app-page" size="lg">
        {children}
      </ResponsivePage>
    </AppShell>
  );
}

export function InspectorHero({
  eyebrow,
  title,
  subtitle,
  action,
  artwork,
  meta
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  artwork?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <PremiumCard className="inspector-hero-card" size="lg">
      {artwork ? <div className="inspector-hero-art">{artwork}</div> : null}
      <div className="inspector-hero-copy">
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
        {meta ? <div className="inspector-hero-meta">{meta}</div> : null}
        {action ? <div className="inspector-hero-actions">{action}</div> : null}
      </div>
    </PremiumCard>
  );
}

export function InspectorMetricGrid({ children, columns = 4 }: { children: ReactNode; columns?: 3 | 4 | 5 }) {
  return <DashboardGrid className="inspector-metric-grid" columns={columns}>{children}</DashboardGrid>;
}

export function InspectorMetricCard({
  label,
  value,
  hint,
  icon,
  tone = "primary",
  href
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: any;
  tone?: Tone;
  href?: string;
}) {
  return <MetricCard label={label} value={value} hint={hint} icon={icon} tone={tone} href={href} />;
}

export function InspectorSection({
  title,
  subtitle,
  icon,
  action,
  children,
  className
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: any;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <PremiumCard className={`inspector-section-card ${className ?? ""}`}>
      <SectionHeader title={title} subtitle={subtitle} icon={icon} action={action} />
      {children}
    </PremiumCard>
  );
}

export function InspectorList({ children }: { children: ReactNode }) {
  return <div className="inspector-list">{children}</div>;
}

export function InspectorRow({
  title,
  subtitle,
  meta,
  status,
  href,
  avatar,
  actions
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  href?: string;
  avatar?: ReactNode;
  actions?: ReactNode;
}) {
  return <ListRowCard title={title} subtitle={subtitle} meta={meta} status={status} href={href} avatar={avatar} actions={actions} />;
}

export function InspectorActions({ children }: { children: ReactNode }) {
  return <DashboardGrid className="inspector-actions-grid" columns={4}>{children}</DashboardGrid>;
}

export function InspectorActionCard(props: Parameters<typeof ActionCard>[0]) {
  return <ActionCard {...props} />;
}

export function InspectorEmpty(props: Parameters<typeof EmptyState>[0]) {
  return <EmptyState {...props} />;
}

export function InspectorStatus({ tone = "default", children }: { tone?: Tone; children: ReactNode }) {
  return <StatusChip tone={tone}>{children}</StatusChip>;
}

export function InspectorScoreRing({ value, label = "ציון" }: { value: number | string; label?: ReactNode }) {
  const numeric = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <span className="inspector-score-ring" style={{ "--score": `${numeric * 3.6}deg` } as React.CSSProperties}>
      <b>{value}</b>
      <small>{label}</small>
    </span>
  );
}

export function InspectorGardenThumb({ src, name }: { src?: string | null; name: string }) {
  return (
    <span className="inspector-garden-thumb">
      {src ? <img src={src} alt={name} /> : <MapPin size={28} />}
    </span>
  );
}
