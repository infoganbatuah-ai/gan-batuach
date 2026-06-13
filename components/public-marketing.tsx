import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

type IconType = ComponentType<LucideProps>;

export function MarketingHero({
  eyebrow,
  title,
  subtitle,
  primaryHref = "/book-demo",
  primaryLabel = "קביעת הדגמה",
  secondaryHref = "/parents-demand",
  secondaryLabel = "להורים",
  tertiaryHref,
  tertiaryLabel,
  children
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  tertiaryHref?: string;
  tertiaryLabel?: string;
  children?: ReactNode;
}) {
  return (
    <section className="marketing-hero">
      <div className="marketing-hero-copy">
        <span className="marketing-badge">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <div className="actions hero-actions">
          <Link className="button primary large" href={primaryHref}>{primaryLabel}</Link>
          <Link className="button secondary large" href={secondaryHref}>{secondaryLabel}</Link>
          {tertiaryHref && tertiaryLabel ? <Link className="button secondary large" href={tertiaryHref}>{tertiaryLabel}</Link> : null}
        </div>
      </div>
      <div className="marketing-hero-panel">
        {children}
      </div>
    </section>
  );
}

export function MarketingMetric({ label, value, text }: { label: string; value: string; text: string }) {
  return (
    <article className="marketing-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{text}</small>
    </article>
  );
}

export function MarketingCard({ icon: Icon, title, text }: { icon?: IconType; title: string; text: string }) {
  return (
    <article className="marketing-card">
      {Icon ? <Icon size={24} /> : null}
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

export function ConversionBand({ title, text, href = "/book-demo", label = "קביעת הדגמה" }: { title: string; text: string; href?: string; label?: string }) {
  return (
    <section className="marketing-cta">
      <div>
        <span className="marketing-badge">Next step</span>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <Link className="button primary large" href={href}>{label}</Link>
    </section>
  );
}

export function MarketingSection({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="marketing-section">
      <div className="marketing-section-head">
        <span className="marketing-badge">{eyebrow}</span>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
