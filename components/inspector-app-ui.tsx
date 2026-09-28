import Link from "next/link";
import type { ReactNode } from "react";
import {
  MapPin
} from "lucide-react";
import {
  ActionCard,
  DashboardGrid,
  EmptyState,
  ListRowCard,
  MetricCard,
  PremiumCard,
  SectionHeader,
  StatusChip
} from "@/components/gan-batuach-design-system";
import { RoleAppShell } from "@/components/role-app-shell";

type Tone = "default" | "primary" | "success" | "warning" | "danger" | "info" | "muted";

type InspectorProfile = {
  full_name?: string | null;
  profile_image_url?: string | null;
};

export function InspectorAppFrame({
  profile,
  activeHref,
  children,
  title,
  subtitle,
  badge = "מפקח אזורי",
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
  const firstName = String(profile.full_name ?? "מפקח").trim().split(/\s+/)[0] || "מפקח";

  return (
    <RoleAppShell
      role="inspector"
      activeHref={activeHref}
      title={title ?? `בוקר טוב, ${firstName}`}
      subtitle={subtitle ?? "יש לך יום ביקורות משמעותי"}
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
  meta,
  imageSrc,
  imageAlt = ""
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  artwork?: ReactNode;
  meta?: ReactNode;
  imageSrc?: string;
  imageAlt?: string;
}) {
  return (
    <PremiumCard className={`inspector-hero-card ${imageSrc ? "inspector-hero-card-image" : ""}`} size="lg">
      {imageSrc ? <div className="inspector-hero-photo"><img src={imageSrc} alt={imageAlt} /></div> : artwork ? <div className="inspector-hero-art">{artwork}</div> : null}
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

export function InspectorStatePanel({
  icon,
  eyebrow,
  title,
  text,
  tone = "primary",
  actions
}: {
  icon?: ReactNode;
  eyebrow: ReactNode;
  title: ReactNode;
  text: ReactNode;
  tone?: Tone;
  actions?: ReactNode;
}) {
  return (
    <PremiumCard className={`inspector-state-panel gb-tone-${tone}`} size="lg">
      {icon ? <span className="inspector-state-icon">{icon}</span> : null}
      <div><small>{eyebrow}</small><h2>{title}</h2><p>{text}</p>{actions ? <div className="inspector-state-actions">{actions}</div> : null}</div>
    </PremiumCard>
  );
}

export function InspectorTimeline({
  items
}: {
  items: Array<{ title: ReactNode; text?: ReactNode; date?: ReactNode; tone?: Tone }>;
}) {
  return (
    <ol className="inspector-timeline">
      {items.map((item, index) => (
        <li className={`gb-tone-${item.tone ?? "primary"}`} key={index}>
          <i aria-hidden="true" />
          <div><strong>{item.title}</strong>{item.text ? <span>{item.text}</span> : null}</div>
          {item.date ? <time>{item.date}</time> : null}
        </li>
      ))}
    </ol>
  );
}

export function InspectorGardenCard({
  name,
  city,
  address,
  image,
  score,
  status,
  nextInspection,
  href
}: {
  name: string;
  city?: ReactNode;
  address?: ReactNode;
  image?: string | null;
  score?: ReactNode;
  status?: ReactNode;
  nextInspection?: ReactNode;
  href: string;
}) {
  return (
    <Link className="inspector-portfolio-card" href={href}>
      <span className="inspector-portfolio-image">
        {image ? <img src={image} alt="" /> : <MapPin size={36} />}
        {status ? <span>{status}</span> : null}
      </span>
      <span className="inspector-portfolio-copy">
        <strong>{name}</strong>
        <small>{city}{city && address ? " · " : null}{address}</small>
        <em>{nextInspection ?? "טרם נקבעה ביקורת"}</em>
      </span>
      {score ? <span className="inspector-portfolio-score">{score}<small>ציון</small></span> : null}
    </Link>
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
