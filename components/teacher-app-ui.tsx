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
import { israelTodayDateLine } from "@/lib/domain/israel-date";

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
  const todayLine = israelTodayDateLine();
  const activeMap = {
    home: { href: "/dashboard/garden", label: "דשבורד", icon: Home },
    children: { href: "/dashboard/garden/children", label: "ילדים", icon: UsersRound },
    calendar: { href: "/dashboard/garden/daily-journal", label: "יומן", icon: CalendarDays },
    messages: { href: "/dashboard/garden/messages", label: "הודעות", icon: MessageCircle },
    more: { href: "/dashboard/garden/command-center", label: "ניהול", icon: MoreHorizontal }
  }[active];
  const ActiveIcon = activeMap.icon;

  return (
    <main className="ganenet-reference-phone ganenet-module-screen teacher-baseline-frame" dir="rtl">
      <header className="ganenet-reference-header">
        <div className="ganenet-logo-lockup" aria-label="גן בטוח">
          <Image src="/assets/company-name.png" alt="גן בטוח" width={300} height={96} priority />
          <Image src="/assets/company-symbol.png" alt="" width={92} height={92} priority />
        </div>

        <div className="ganenet-profile-actions">
          <a className="ganenet-avatar" href="/dashboard/garden/settings" aria-label="פרופיל">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <img src="/assets/teacher-avatar.svg" alt="" />}
          </a>
          <ChevronDown className="ganenet-profile-chevron" size={28} />
          <a className="ganenet-bell" href="/dashboard/garden/notifications" aria-label="התראות">
            <Bell size={34} />
            <i />
          </a>
        </div>

        <div className="ganenet-greeting">
          <div>
            <h1>{firstTitleWord} <span>🌸</span></h1>
            {subtitle ? <p>{subtitle.replace(/\[DEMO\]/g, "")} <ChevronLeft size={22} /></p> : null}
          </div>
        </div>
      </header>

      <div className="ganenet-date-pill">
        <CalendarDays size={32} />
        <span>{todayLine.top}<br />{todayLine.bottom}</span>
      </div>

      <div className="ganenet-module-content">{children}</div>

      <nav className="ganenet-bottom-nav" aria-label="ניווט גננת">
        <a href="/dashboard/garden/command-center"><span>•••</span><b>עוד</b></a>
        <a href="/dashboard/garden/messages"><Bell size={26} /><i>2</i><b>התראות</b></a>
        <a className="active" href={activeMap.href}><span><ActiveIcon size={38} /></span><b>{activeMap.label}</b></a>
        <a href="/dashboard/garden/daily-journal"><CalendarDays size={28} /><b>יומן</b></a>
        <a href="/dashboard/garden"><Home size={28} /><b>בית</b></a>
      </nav>
    </main>
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
    <section className="ganenet-card ganenet-module-title-card">
      <div className="ganenet-section-title">
        <h2>{title} {Icon ? <Icon size={30} /> : null}</h2>
        {action}
      </div>
      {subtitle ? <p>{subtitle}</p> : null}
    </section>
  );
}

export function TeacherStatsGrid({ children }: { children: ReactNode }) {
  return <section className="ganenet-attendance-summary-grid ganenet-module-stats-grid">{children}</section>;
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
  const content = (
    <>
      <span>{Icon ? <Icon size={30} /> : null}</span>
      <strong>{title}</strong>
      <b>{value}</b>
      {hint ? <small>{hint}</small> : null}
    </>
  );
  const className = `ganenet-attendance-stat ${tone === "red" ? "pink" : tone}`;
  if (href) return <Link className={className} href={href}>{content}</Link>;
  return <article className={className}>{content}</article>;
}

export function TeacherQuickActions({ children, title = "פעולות מהירות" }: { children: ReactNode; title?: string }) {
  return (
    <section className="ganenet-card ganenet-attendance-actions-panel">
      <div className="ganenet-section-title">
        <h2>{title} <span className="ganenet-section-icon"><Plus size={28} /></span></h2>
        <Link href="/dashboard/garden/command-center">צפו בכל הפעולות ›</Link>
      </div>
      <div className="ganenet-action-row">{children}</div>
    </section>
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
  return (
    <Link className={`ganenet-action ${tone === "red" ? "pink" : tone}`} href={href}>
      <span>{<Icon size={35} />}</span>
      <b>{title}</b>
    </Link>
  );
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
    <section className={`ganenet-card ganenet-module-panel ${className}`}>
      <div className="ganenet-section-title">
        <h2>{title}</h2>
        {action}
      </div>
      {subtitle ? <p className="ganenet-module-subtitle">{subtitle}</p> : null}
      {children}
    </section>
  );
}

export function TeacherCompactList({ children }: { children: ReactNode }) {
  return <div className="ganenet-module-list">{children}</div>;
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
  const content = (
    <>
      <span className={`ganenet-module-avatar ${tone === "red" ? "pink" : tone}`}>{avatar ? <img src={avatar} alt="" /> : title.slice(0, 1)}</span>
      <div>
        <b>{title}</b>
        {subtitle ? <small>{subtitle}</small> : null}
      </div>
      {meta ? <em>{meta}</em> : null}
    </>
  );
  if (href) return <Link className="ganenet-module-row" href={href}>{content}</Link>;
  return <article className="ganenet-module-row">{content}</article>;
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
    <section className="ganenet-card ganenet-ai">
      <div className="ganenet-bot"><span /></div>
      <div>
        <h2>תובנות AI ✨</h2>
        <p>{children}</p>
        <a href="/dashboard/garden/insights">לכל התובנות ›</a>
      </div>
      <strong>{metric}</strong>
    </section>
  );
}

export function TeacherEmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="ganenet-attendance-empty">
      <strong>{title}</strong>
      {text ? <p>{text}</p> : null}
      {action}
    </div>
  );
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
