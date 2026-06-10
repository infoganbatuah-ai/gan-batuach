import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

type Tone = "default" | "good" | "warn" | "bad";
type IconType = ComponentType<LucideProps>;

export function StatusBadge({ children, tone = "default" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`premium-status-badge ${tone}`}>{children}</span>;
}

export function PremiumDashboardHero({
  eyebrow,
  title,
  subtitle,
  badge,
  badgeTone = "default",
  actions,
  children
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  badgeTone?: Tone;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="premium-dashboard-hero">
      <div>
        <p className="premium-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
        {actions ? <div className="premium-hero-actions">{actions}</div> : null}
      </div>
      <div className="premium-hero-side">
        {badge ? <StatusBadge tone={badgeTone}>{badge}</StatusBadge> : null}
        {children}
      </div>
    </section>
  );
}

export function RoleMetricCard({ label, value, hint, tone = "default", href }: { label: string; value: ReactNode; hint?: string; tone?: Tone; href?: string }) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </>
  );
  if (href) return <Link className={`role-metric-card ${tone}`} href={href}>{content}</Link>;
  return <article className={`role-metric-card ${tone}`}>{content}</article>;
}

export function ActionCard({
  title,
  text,
  href,
  icon: Icon,
  tone = "default"
}: {
  title: string;
  text?: string;
  href: string;
  icon?: IconType;
  tone?: Tone;
}) {
  return (
    <Link className={`premium-action-card ${tone}`} href={href}>
      {Icon ? <Icon size={22} /> : null}
      <strong>{title}</strong>
      {text ? <span>{text}</span> : null}
    </Link>
  );
}

export function CleanSection({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="clean-section">
      <div className="clean-section-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="premium-empty-state">
      <strong>{title}</strong>
      {text ? <span>{text}</span> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="premium-page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function MobileCardList({ children }: { children: ReactNode }) {
  return <div className="mobile-card-list">{children}</div>;
}

export function ExecutiveDashboardFrame({
  alerts,
  metrics,
  activity
}: {
  alerts: ReactNode;
  metrics: ReactNode;
  activity: ReactNode;
}) {
  return (
    <div className="executive-dashboard-frame">
      <section className="executive-priority-strip" aria-label="מה דורש טיפול">{alerts}</section>
      <section className="executive-kpi-strip" aria-label="מדדים מרכזיים">{metrics}</section>
      <section className="executive-activity-strip" aria-label="פעילות אחרונה">{activity}</section>
    </div>
  );
}
