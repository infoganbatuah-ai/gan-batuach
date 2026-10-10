import Link from "next/link";
import { useId } from "react";
import type {
  ComponentType,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";
import type { LucideProps } from "lucide-react";
import { AlertCircle, Check, CheckCircle2, ChevronLeft, Circle, Clock3, Upload } from "lucide-react";
import { GlobalStatePanel } from "@/components/global-state-system";
import { canonicalStatusLabel, canonicalStatusTone } from "@/lib/ui/canonical-status";

type IconType = ComponentType<LucideProps>;
type Tone = "default" | "primary" | "success" | "warning" | "danger" | "info" | "muted";
type CardSize = "sm" | "md" | "lg";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function SmartLink({
  href,
  className,
  children,
  ariaLabel
}: {
  href?: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  if (!href) return <div className={className}>{children}</div>;
  return (
    <Link className={className} href={href} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}

export function AppShell({
  children,
  header,
  bottomNav,
  sidebar,
  className,
  dir = "rtl"
}: {
  children: ReactNode;
  header?: ReactNode;
  bottomNav?: ReactNode;
  sidebar?: ReactNode;
  className?: string;
  dir?: "rtl" | "ltr";
}) {
  return (
    <div className={cx("gb-app-shell responsive-app-shell", className)} dir={dir}>
      {sidebar ? <aside className="gb-app-shell-sidebar">{sidebar}</aside> : null}
      <div className="gb-app-shell-main">
        {header}
        {children}
      </div>
      {bottomNav}
    </div>
  );
}

export function ResponsivePage({
  children,
  className,
  size = "lg"
}: {
  children: ReactNode;
  className?: string;
  size?: CardSize;
}) {
  return <main className={cx("gb-responsive-page responsive-app-page", `gb-responsive-page-${size}`, className)}>{children}</main>;
}

export function MobileAppShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("gb-mobile-app-shell", className)}>{children}</div>;
}

export function DesktopDashboardShell({
  children,
  sidebar,
  header,
  className
}: {
  children: ReactNode;
  sidebar?: ReactNode;
  header?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("gb-desktop-dashboard-shell", className)}>
      {sidebar ? <aside className="gb-desktop-sidebar-slot">{sidebar}</aside> : null}
      <section className="gb-desktop-dashboard-main">
        {header}
        {children}
      </section>
    </div>
  );
}

export function AppHeader({
  logo,
  title,
  subtitle,
  avatar,
  notification,
  date,
  action,
  centered = false,
  className
}: {
  logo?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  avatar?: ReactNode;
  notification?: ReactNode;
  date?: ReactNode;
  action?: ReactNode;
  centered?: boolean;
  className?: string;
}) {
  return (
    <header className={cx("gb-app-header", centered && "gb-app-header-centered", className)}>
      <div className="gb-app-header-brand">
        {logo ? <div className="gb-app-logo">{logo}</div> : null}
        <div>
          {title ? <h1>{title}</h1> : null}
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      <div className="gb-app-header-actions">
        {date ? <div className="gb-app-date-pill">{date}</div> : null}
        {notification}
        {avatar}
        {action}
      </div>
    </header>
  );
}

export function BottomNav({
  items,
  activeHref,
  className
}: {
  items: Array<{ href: string; label: string; icon?: IconType; badge?: ReactNode }>;
  activeHref?: string;
  className?: string;
}) {
  return (
    <nav className={cx("gb-bottom-nav", className)} aria-label="ניווט ראשי">
      {items.map((item) => {
        const Icon = item.icon;
        const active = activeHref === item.href;
        return (
          <Link className={cx("gb-bottom-nav-item", active && "active")} href={item.href} key={item.href}>
            <span className="gb-bottom-nav-icon">
              {Icon ? <Icon size={24} /> : null}
              {item.badge ? <i>{item.badge}</i> : null}
            </span>
            <b>{item.label}</b>
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarNav({
  items,
  activeHref,
  title,
  className
}: {
  items: Array<{ href: string; label: string; icon?: IconType; hint?: string; badge?: ReactNode }>;
  activeHref?: string;
  title?: ReactNode;
  className?: string;
}) {
  return (
    <nav className={cx("gb-sidebar-nav", className)} aria-label="ניווט צד">
      {title ? <div className="gb-sidebar-title">{title}</div> : null}
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link className={cx("gb-sidebar-nav-item", activeHref === item.href && "active")} href={item.href} key={item.href}>
            {Icon ? <Icon size={22} /> : null}
            <span>
              <b>{item.label}</b>
              {item.hint ? <small>{item.hint}</small> : null}
            </span>
            {item.badge ? <em>{item.badge}</em> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function PremiumCard({
  children,
  className,
  tone = "default",
  href,
  size = "md"
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
  href?: string;
  size?: CardSize;
}) {
  return (
    <SmartLink href={href} className={cx("gb-premium-card", `gb-tone-${tone}`, `gb-card-${size}`, className)}>
      {children}
    </SmartLink>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  href,
  trend
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: IconType;
  tone?: Tone;
  href?: string;
  trend?: ReactNode;
}) {
  return (
    <PremiumCard href={href} className="gb-metric-card" tone={tone}>
      {Icon ? <span className="gb-metric-icon"><Icon size={28} /></span> : null}
      <strong>{label}</strong>
      <b>{value}</b>
      {hint ? <small>{hint}</small> : null}
      {trend ? <em>{trend}</em> : null}
    </PremiumCard>
  );
}

export function StatusChip({
  children,
  tone = "default",
  icon: Icon
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: IconType;
}) {
  const normalizedTone = tone === "default" && typeof children === "string" ? canonicalStatusTone(children) : tone;
  const visibleLabel = typeof children === "string" ? canonicalStatusLabel(children) : children;
  const ToneIcon = Icon ?? (normalizedTone === "success" ? CheckCircle2 : normalizedTone === "danger" ? AlertCircle : normalizedTone === "warning" ? Clock3 : Circle);
  return (
    <span className={cx("gb-status-chip", `gb-tone-${normalizedTone}`)} role="status">
      <ToneIcon size={16} aria-hidden="true" />
      {visibleLabel}
    </span>
  );
}

export function ActionCard({
  title,
  text,
  icon: Icon,
  href,
  tone = "primary"
}: {
  title: ReactNode;
  text?: ReactNode;
  icon?: IconType;
  href?: string;
  tone?: Tone;
}) {
  return (
    <SmartLink href={href} className={cx("gb-action-card", `gb-tone-${tone}`)}>
      {Icon ? <span><Icon size={30} /></span> : null}
      <b>{title}</b>
      {text ? <small>{text}</small> : null}
    </SmartLink>
  );
}

export function FormField({
  label,
  hint,
  error,
  icon: Icon,
  as = "input",
  className,
  ...props
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  icon?: IconType;
  as?: "input" | "textarea" | "select";
  className?: string;
} & (InputHTMLAttributes<HTMLInputElement> | TextareaHTMLAttributes<HTMLTextAreaElement> | SelectHTMLAttributes<HTMLSelectElement>)) {
  const generatedId = useId();
  const controlId = String(props.id ?? generatedId);
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;
  const controlClass = cx("gb-form-control", Icon && "has-icon");
  return (
    <label className={cx("gb-form-field", Boolean(error) && "has-error", className)} htmlFor={controlId}>
      <span>{label}</span>
      <div className="gb-form-control-wrap">
        {Icon ? <Icon size={20} /> : null}
        {as === "textarea" ? (
          <textarea className={controlClass} {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)} id={controlId} aria-invalid={Boolean(error)} aria-describedby={describedBy} />
        ) : as === "select" ? (
          <select className={controlClass} {...(props as SelectHTMLAttributes<HTMLSelectElement>)} id={controlId} aria-invalid={Boolean(error)} aria-describedby={describedBy} />
        ) : (
          <input className={controlClass} {...(props as InputHTMLAttributes<HTMLInputElement>)} id={controlId} aria-invalid={Boolean(error)} aria-describedby={describedBy} />
        )}
      </div>
      {hint ? <small id={hintId}>{hint}</small> : null}
      {error ? <em id={errorId} role="alert">{error}</em> : null}
    </label>
  );
}

export function SearchFilterBar({
  search,
  filters,
  action,
  children,
  className
}: {
  search?: ReactNode;
  filters?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("gb-search-filter-bar", className)}>
      {search ? <div className="gb-search-slot">{search}</div> : null}
      {filters || children ? <div className="gb-filter-slot">{filters ?? children}</div> : null}
      {action ? <div className="gb-filter-action">{action}</div> : null}
    </section>
  );
}

export function ListRowCard({
  title,
  subtitle,
  meta,
  avatar,
  actions,
  status,
  href,
  className
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  avatar?: ReactNode;
  actions?: ReactNode;
  status?: ReactNode;
  href?: string;
  className?: string;
}) {
  return (
    <SmartLink href={href} className={cx("gb-list-row-card", className)}>
      {avatar ? <div className="gb-list-avatar">{avatar}</div> : null}
      <div className="gb-list-main">
        <b>{title}</b>
        {subtitle ? <span>{subtitle}</span> : null}
        {meta ? <small>{meta}</small> : null}
      </div>
      {status ? <div className="gb-list-status">{status}</div> : null}
      {actions ? <div className="gb-list-actions">{actions}</div> : <ChevronLeft size={22} />}
    </SmartLink>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  action,
  centered = false
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: IconType;
  action?: ReactNode;
  centered?: boolean;
}) {
  return (
    <header className={cx("gb-section-header", centered && "centered")}>
      <div>
        {Icon ? <span><Icon size={22} /></span> : null}
        <div>
          {eyebrow ? <small className="gb-section-eyebrow">{eyebrow}</small> : null}
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </header>
  );
}

export function ProgressStepper({
  steps,
  current
}: {
  steps: Array<{ label: string; description?: string }>;
  current: number;
}) {
  return (
    <ol className="gb-progress-stepper">
      {steps.map((step, index) => {
        const complete = index < current;
        const active = index === current;
        return (
          <li className={cx(complete && "complete", active && "active")} key={step.label}>
            <span>{complete ? <Check size={18} /> : index + 1}</span>
            <b>{step.label}</b>
            {step.description ? <small>{step.description}</small> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function DashboardGrid({
  children,
  columns = 3,
  min,
  className
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4 | 5;
  min?: string;
  className?: string;
}) {
  return <div className={cx("gb-dashboard-grid", `gb-grid-${columns}`, className)} style={min ? ({ "--gb-grid-min": min } as CSSProperties) : undefined}>{children}</div>;
}

export function UploadBox({
  title,
  text,
  accept,
  name,
  disabled
}: {
  title: ReactNode;
  text?: ReactNode;
  accept?: string;
  name?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cx("gb-upload-box", disabled && "disabled")}>
      <Upload size={34} />
      <b>{title}</b>
      {text ? <span>{text}</span> : null}
      <input type="file" accept={accept} name={name} disabled={disabled} />
    </label>
  );
}

export function PaymentMethodCard({
  title,
  subtitle,
  icon,
  selected = false,
  disabled = false
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={cx("gb-payment-method-card", selected && "selected", disabled && "disabled")}>
      {icon ? <span>{icon}</span> : null}
      <div>
        <b>{title}</b>
        {subtitle ? <small>{subtitle}</small> : null}
      </div>
      <i />
    </div>
  );
}

export function CameraPreviewCard({
  title,
  subtitle,
  image,
  status,
  action,
  live = false
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  image?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  live?: boolean;
}) {
  return (
    <article className="gb-camera-preview-card">
      <div className="gb-camera-media">
        {image}
        {live ? <span>LIVE</span> : null}
      </div>
      <div className="gb-camera-copy">
        {status}
        <b>{title}</b>
        {subtitle ? <p>{subtitle}</p> : null}
        {action}
      </div>
    </article>
  );
}

export function ReportCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "primary",
  chart,
  href
}: {
  title: ReactNode;
  value?: ReactNode;
  subtitle?: ReactNode;
  icon?: IconType;
  tone?: Tone;
  chart?: ReactNode;
  href?: string;
}) {
  return (
    <PremiumCard href={href} className="gb-report-card" tone={tone}>
      {Icon ? <span className="gb-report-icon"><Icon size={24} /></span> : null}
      <b>{title}</b>
      {value ? <strong>{value}</strong> : null}
      {subtitle ? <small>{subtitle}</small> : null}
      {chart ? <div className="gb-report-chart">{chart}</div> : null}
    </PremiumCard>
  );
}

export function EmptyState({
  title,
  text,
  icon: Icon,
  action
}: {
  title: ReactNode;
  text?: ReactNode;
  icon?: IconType;
  action?: ReactNode;
}) {
  return <GlobalStatePanel kind="empty" title={title} description={text} icon={Icon} action={action} compact className="gb-empty-state" />;
}
