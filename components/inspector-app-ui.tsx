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
import { RoleAppShell } from "@/components/role-app-shell";

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
  return (
    <RoleAppShell
      role="inspector"
      activeHref={activeHref}
      title={title ?? "מרכז פיקוח"}
      subtitle={subtitle ?? "גנים משויכים, ביקורות, ליקויים ודוחות"}
      profile={profile}
      backHref={backHref}
      actions={badge ? <span className="dashboard-header-badge">{badge}</span> : undefined}
      className="inspector-runtime-shell"
    >
      <div className="inspector-app-page dashboard-runtime-content">
        {children}
      </div>
    </RoleAppShell>
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
