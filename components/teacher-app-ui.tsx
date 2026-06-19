import Link from "next/link";
import Image from "next/image";
import type { ComponentType, ReactNode } from "react";
import {
  Baby,
  Bell,
  CalendarDays,
  Camera,
  CreditCard,
  Home,
  MessageCircle,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import type { LucideProps } from "lucide-react";

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
  return (
    <div className="teacher-app-frame" dir="rtl">
      <div className="teacher-app-logo" aria-label="גן בטוח">
        <Image src="/assets/company-name.png" alt="גן בטוח" width={260} height={82} />
        <Image src="/assets/company-symbol.png" alt="" width={82} height={82} />
      </div>
      <header className="teacher-app-header">
        <button className="teacher-icon-button" type="button" aria-label="התראות">
          <Bell size={24} />
          <span />
        </button>
        <div className="teacher-app-greeting">
          <div className="teacher-avatar">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>מ</span>}
            <i />
          </div>
          <div>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        </div>
      </header>
      <div className="teacher-app-date-pill">
        <CalendarDays size={28} />
        <span>יום ראשון, כ״ה אייר תשפ״ה<br />25 במאי 2025</span>
      </div>
      <main className="teacher-app-main">{children}</main>
      <TeacherBottomNav active={active} />
    </div>
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

export function TeacherStatsGrid({ children }: { children: ReactNode }) {
  return <section className="teacher-stats-grid">{children}</section>;
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
      <span className="teacher-stat-icon">{Icon ? <Icon size={26} /> : null}</span>
      <small>{title}</small>
      <strong>{value}</strong>
      {hint ? <em>{hint}</em> : null}
    </>
  );
  if (href) return <Link className={`teacher-stat-card ${tone}`} href={href}>{content}</Link>;
  return <article className={`teacher-stat-card ${tone}`}>{content}</article>;
}

export function TeacherQuickActions({ children, title = "פעולות מהירות" }: { children: ReactNode; title?: string }) {
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
    <Link className={`teacher-action-tile ${tone}`} href={href}>
      <span>{<Icon size={30} />}</span>
      <strong>{title}</strong>
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

export function TeacherCompactList({ children }: { children: ReactNode }) {
  return <div className="teacher-compact-list">{children}</div>;
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

export function TeacherFilterPills({ items }: { items: Array<{ label: string; href: string; active?: boolean }> }) {
  return (
    <nav className="teacher-filter-pills" aria-label="סינון">
      {items.map((item) => (
        <Link className={item.active ? "active" : ""} href={item.href} key={item.label}>{item.label}</Link>
      ))}
    </nav>
  );
}

export function TeacherAiInsight({ children, metric = "+92%" }: { children: ReactNode; metric?: string }) {
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

export function TeacherEmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
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
