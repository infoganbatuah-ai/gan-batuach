import Link from "next/link";
import Image from "next/image";
import type { ComponentType, ReactNode } from "react";
import {
  Baby,
  Bell,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronLeft,
  CreditCard,
  Home,
  MessageCircle,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import { RoleAppShell } from "@/components/role-app-shell";
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

type Tone = "blue" | "purple" | "green" | "orange" | "red" | "cyan" | "neutral";
type IconType = ComponentType<LucideProps>;

export function TeacherAppFrame({
  children,
  title,
  subtitle,
  avatarUrl,
  active = "home"
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  active?: "home" | "children" | "calendar" | "messages" | "more";
}) {
  const firstTitleWord = title.replace(/\[DEMO\]/g, "").trim();
  const profileName = firstTitleWord.replace(/^(?:בוקר טוב|שלום),\s*/u, "").trim() || "מנהלת הגן";
  const activeMap = {
    home: { href: "/dashboard/garden/operations", label: "דשבורד", icon: Home },
    children: { href: "/dashboard/garden/children", label: "ילדים", icon: UsersRound },
    calendar: { href: "/dashboard/garden/daily-journal", label: "יומן", icon: CalendarDays },
    messages: { href: "/dashboard/garden/messages", label: "הודעות", icon: MessageCircle },
    more: { href: "/dashboard/garden/command-center", label: "ניהול", icon: MoreHorizontal }
  }[active];
  return (
    <RoleAppShell
      role="manager"
      activeHref={activeMap.href}
      title={firstTitleWord}
      subtitle={subtitle?.replace(/\[DEMO\]/g, "")}
      profile={{ full_name: profileName, profile_image_url: avatarUrl }}
      className="teacher-runtime-shell"
    >
      <div className="dashboard-runtime-content">{children}</div>
    </RoleAppShell>
  );
}

export function TeacherPageTitle({
  icon: Icon,
  title,
  subtitle,
  action
}: {
  icon?: IconType;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <PremiumCard className="dashboard-page-intro" size="lg">
      <SectionHeader title={title} subtitle={subtitle} icon={Icon} action={action} />
    </PremiumCard>
  );
}

export function TeacherStatsGrid({ children }: { children: ReactNode }) {
  return <DashboardGrid className="dashboard-metrics-grid" columns={4}>{children}</DashboardGrid>;
}

export function TeacherStatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = "blue",
  href
}: {
  title: string;
  value: ReactNode;
  hint?: string;
  icon?: IconType;
  tone?: Tone;
  href?: string;
}) {
  const toneMap = { blue: "info", purple: "primary", green: "success", orange: "warning", red: "danger", cyan: "info", neutral: "muted" } as const;
  return <MetricCard label={title} value={value} hint={hint} icon={Icon} tone={toneMap[tone]} href={href} />;
}

export function TeacherQuickActions({ children, title = "פעולות מהירות" }: { children: ReactNode; title?: string }) {
  return (
    <PremiumCard className="dashboard-action-panel">
      <SectionHeader title={title} icon={Plus} action={<Link className="dashboard-text-link" href="/dashboard/garden/command-center">כל הפעולות</Link>} />
      <DashboardGrid columns={4} className="dashboard-actions-grid">{children}</DashboardGrid>
    </PremiumCard>
  );
}

export function TeacherActionTile({
  title,
  href,
  icon: Icon,
  tone = "blue"
}: {
  title: string;
  href: string;
  icon: IconType;
  tone?: Tone;
}) {
  const toneMap = { blue: "info", purple: "primary", green: "success", orange: "warning", red: "danger", cyan: "info", neutral: "muted" } as const;
  return <ActionCard title={title} href={href} icon={Icon} tone={toneMap[tone]} />;
}

export function TeacherSection({
  title,
  subtitle,
  action,
  children,
  className = ""
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <PremiumCard className={`dashboard-section-panel ${className}`}>
      <SectionHeader title={title} subtitle={subtitle} action={action} />
      {children}
    </PremiumCard>
  );
}

export function TeacherCompactList({ children }: { children: ReactNode }) {
  return <div className="dashboard-list-stack">{children}</div>;
}

export function TeacherCompactItem({
  title,
  subtitle,
  meta,
  tone = "blue",
  avatar,
  href
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  tone?: Tone;
  avatar?: string | null;
  href?: string;
}) {
  const toneMap = { blue: "info", purple: "primary", green: "success", orange: "warning", red: "danger", cyan: "info", neutral: "muted" } as const;
  const avatarNode = <span className="dashboard-list-avatar">{avatar ? <img src={avatar} alt="" /> : title.slice(0, 1)}</span>;
  const status = meta ? <StatusChip tone={toneMap[tone]}>{meta}</StatusChip> : undefined;
  return <ListRowCard title={title} subtitle={subtitle} avatar={avatarNode} status={status} href={href} actions={href ? undefined : null} />;
}

export function TeacherFilterPills({ items }: { items: Array<{ label: string; href: string; active?: boolean }> }) {
  return (
    <nav className="ganenet-filter-pills" aria-label="סינון">
      {items.map((item) => (
        <Link className={item.active ? "active" : ""} href={item.href} key={item.label}>{item.label}</Link>
      ))}
    </nav>
  );
}

export function TeacherAiInsight({ children, metric = "+92%" }: { children: ReactNode; metric?: string }) {
  return (
    <PremiumCard className="dashboard-readiness-card" tone="muted">
      <SectionHeader title="תובנות לבדיקה" subtitle="המלצה בלבד; אין החלטה אוטומטית." action={<StatusChip tone="muted">{metric}</StatusChip>} />
      <p>{children}</p>
      <Link className="dashboard-text-link" href="/dashboard/garden/insights">פתיחת התובנות</Link>
    </PremiumCard>
  );
}

export function TeacherEmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return <EmptyState title={title} text={text} action={action} />;
}

function LegacyTeacherPageTitle({
  icon: Icon,
  title,
  subtitle,
  action
}: {
  icon?: IconType;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <section className="teacher-page-title">
      <div>
        {Icon ? <Icon size={34} /> : null}
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </section>
  );
}

function LegacyTeacherStatsGrid({ children }: { children: ReactNode }) {
  return <section className="teacher-stats-grid">{children}</section>;
}

function LegacyTeacherStatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = "blue",
  href
}: {
  title: string;
  value: ReactNode;
  hint?: string;
  icon?: IconType;
  tone?: Tone;
  href?: string;
}) {
  const content = (
    <>
      <span className="teacher-stat-icon">{Icon ? <Icon size={26} /> : null}</span>
      <small>{title}</small>
      <strong>{value}</strong>
      {hint ? <em>{hint}</em> : null}
    </>
  );
  if (href) return <Link className={`teacher-stat-card ${tone}`} href={href}>{content}</Link>;
  return <article className={`teacher-stat-card ${tone}`}>{content}</article>;
}

function LegacyTeacherQuickActions({ children, title = "פעולות מהירות" }: { children: ReactNode; title?: string }) {
  return (
    <section className="teacher-section-card teacher-quick-actions-card">
      <div className="teacher-section-head">
        <h3>{title}</h3>
        <Link href="/dashboard/garden/command-center">צפו בכל הפעולות</Link>
      </div>
      <div className="teacher-action-grid">{children}</div>
    </section>
  );
}

function LegacyTeacherActionTile({
  title,
  href,
  icon: Icon,
  tone = "blue"
}: {
  title: string;
  href: string;
  icon: IconType;
  tone?: Tone;
}) {
  return (
    <Link className={`teacher-action-tile ${tone}`} href={href}>
      <span>{<Icon size={30} />}</span>
      <strong>{title}</strong>
    </Link>
  );
}

function LegacyTeacherSection({
  title,
  subtitle,
  action,
  children,
  className = ""
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`teacher-section-card ${className}`}>
      <div className="teacher-section-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function LegacyTeacherCompactList({ children }: { children: ReactNode }) {
  return <div className="teacher-compact-list">{children}</div>;
}

function LegacyTeacherCompactItem({
  title,
  subtitle,
  meta,
  tone = "blue",
  avatar,
  href
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  tone?: Tone;
  avatar?: string | null;
  href?: string;
}) {
  const content = (
    <>
      <span className={`teacher-mini-avatar ${tone}`}>{avatar ? <img src={avatar} alt="" /> : title.slice(0, 1)}</span>
      <span>
        <strong>{title}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
      {meta ? <em>{meta}</em> : null}
    </>
  );
  if (href) return <Link className="teacher-compact-item" href={href}>{content}</Link>;
  return <article className="teacher-compact-item">{content}</article>;
}

function LegacyTeacherFilterPills({ items }: { items: Array<{ label: string; href: string; active?: boolean }> }) {
  return (
    <nav className="teacher-filter-pills" aria-label="סינון">
      {items.map((item) => (
        <Link className={item.active ? "active" : ""} href={item.href} key={item.label}>{item.label}</Link>
      ))}
    </nav>
  );
}

function LegacyTeacherAiInsight({ children, metric = "+92%" }: { children: ReactNode; metric?: string }) {
  return (
    <section className="teacher-ai-card">
      <div className="teacher-ai-bot" aria-hidden="true">
        <span />
      </div>
      <div>
        <h3>המלצת AI</h3>
        <p>{children}</p>
      </div>
      <strong>{metric}</strong>
    </section>
  );
}

function LegacyTeacherEmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="teacher-empty-state">
      <strong>{title}</strong>
      {text ? <span>{text}</span> : null}
      {action}
    </div>
  );
}

export function TeacherBottomNav({ active }: { active: "home" | "children" | "calendar" | "messages" | "more" }) {
  const items = [
    { key: "calendar", label: "יומן", href: "/dashboard/garden/daily-journal", icon: CalendarDays },
    { key: "children", label: "ילדים", href: "/dashboard/garden/children", icon: UsersRound },
    { key: "home", label: "דאשבורד", href: "/dashboard/garden", icon: Home },
    { key: "messages", label: "הודעות", href: "/dashboard/garden/messages", icon: MessageCircle },
    { key: "more", label: "עוד", href: "/dashboard/garden/command-center", icon: MoreHorizontal }
  ] as const;
  return (
    <nav className="teacher-bottom-nav" aria-label="ניווט גננת">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link className={active === item.key ? "active" : ""} href={item.href} key={item.key}>
            <Icon size={24} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export const teacherDefaultActions = [
  { title: "שליחת הודעה", href: "/dashboard/garden/messages", icon: MessageCircle, tone: "orange" as const },
  { title: "תיעוד פעילות", href: "/dashboard/garden/daily-journal", icon: Camera, tone: "red" as const },
  { title: "רשימת נוכחות", href: "/dashboard/garden/attendance", icon: ShieldCheck, tone: "cyan" as const },
  { title: "הוספת ילד", href: "/dashboard/garden/children", icon: Plus, tone: "purple" as const },
  { title: "לוח זמנים", href: "/dashboard/garden/daily-journal", icon: CalendarDays, tone: "blue" as const }
];

export const teacherFinanceActions = [
  { title: "כספים", href: "/dashboard/garden/finance", icon: CreditCard, tone: "green" as const },
  { title: "ילדים", href: "/dashboard/garden/children", icon: Baby, tone: "purple" as const }
];
