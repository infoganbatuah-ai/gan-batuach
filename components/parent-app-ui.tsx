import Image from "next/image";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { Bell, CalendarDays, Camera, FileText, Home, Menu, MessageCircle, ShieldCheck, WalletCards } from "lucide-react";
import type { LucideProps } from "lucide-react";

type Tone = "blue" | "purple" | "green" | "orange" | "red" | "neutral";
type IconType = ComponentType<LucideProps>;

export function ParentAppFrame({
  children,
  active = "home",
  avatarUrl
}: {
  children: ReactNode;
  active?: "home" | "dashboard" | "calendar" | "alerts" | "more";
  avatarUrl?: string | null;
}) {
  const today = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return (
    <div className="parent-app-frame" dir="rtl">
      <header className="parent-app-topbar">
        <div className="parent-brand-lockup">
          <Image src="/assets/company-name.png" alt="גן בטוח" width={230} height={72} />
          <Image src="/assets/company-symbol.png" alt="" width={72} height={72} />
        </div>
        <div className="parent-date-pill">
          <CalendarDays size={26} />
          <span>{today}</span>
        </div>
        <Link className="parent-icon-button" href="/dashboard/parent/notifications" aria-label="התראות">
          <Bell size={26} />
          <span />
        </Link>
        <Link className="parent-avatar" href="/dashboard/parent/settings" aria-label="פרופיל הורה">{avatarUrl ? <img src={avatarUrl} alt="" /> : <span>ה</span>}</Link>
      </header>
      <main className="parent-app-main">{children}</main>
      <ParentBottomNav active={active} />
    </div>
  );
}

export function ParentHero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="parent-hero">
      <div className="parent-hero-bg" aria-hidden="true" />
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </section>
  );
}

export function ParentChildCard({
  name,
  meta,
  image,
  status = "הכל תקין",
  secondary = "נוכחת"
}: {
  name: string;
  meta?: string;
  image?: string | null;
  status?: string;
  secondary?: string;
}) {
  return (
    <section className="parent-child-card">
      <span className="parent-child-back">‹</span>
      <div className="parent-child-photo">
        {image ? <img src={image} alt="" /> : <span>{name.slice(0, 1)}</span>}
        <i><Camera size={22} /></i>
      </div>
      <div>
        <h2>{name}</h2>
        {meta ? <p>{meta}</p> : null}
        <div className="parent-child-badges">
          <span className="green"><ShieldCheck size={18} /> {status}</span>
          <span className="blue"><ShieldCheck size={18} /> {secondary}</span>
        </div>
      </div>
    </section>
  );
}

export function ParentMetricCard({ title, value, hint, icon: Icon, tone = "purple", href }: { title: string; value: ReactNode; hint?: string; icon: IconType; tone?: Tone; href?: string }) {
  const content = (
    <>
      <span className={`parent-metric-icon ${tone}`}><Icon size={30} /></span>
      <strong>{value}</strong>
      <b>{title}</b>
      {hint ? <small>{hint}</small> : null}
    </>
  );
  if (href) return <Link className="parent-metric-card" href={href}>{content}</Link>;
  return <article className="parent-metric-card">{content}</article>;
}

export function ParentSection({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`parent-section-card ${className}`}>
      <div className="parent-section-head">
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

export function ParentActionTile({ title, href, icon: Icon, tone = "purple" }: { title: string; href: string; icon: IconType; tone?: Tone }) {
  return (
    <Link className={`parent-action-tile ${tone}`} href={href}>
      <Icon size={30} />
      <span>{title}</span>
    </Link>
  );
}

export function ParentListRow({ title, subtitle, time, icon: Icon, tone = "purple" }: { title: string; subtitle?: string; time?: string; icon: IconType; tone?: Tone }) {
  return (
    <article className="parent-list-row">
      {time ? <time>{time}</time> : null}
      <span className={`parent-row-icon ${tone}`}><Icon size={23} /></span>
      <div>
        <strong>{title}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </div>
    </article>
  );
}

export function ParentEmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="parent-empty-state">
      <strong>{title}</strong>
      {text ? <span>{text}</span> : null}
      {action}
    </div>
  );
}

export function ParentBottomNav({ active }: { active: "home" | "dashboard" | "calendar" | "alerts" | "more" }) {
  const items = [
    { key: "more", label: "עוד", href: "/dashboard/parent/settings", icon: Menu },
    { key: "alerts", label: "התראות", href: "/dashboard/parent/notifications", icon: Bell },
    { key: "dashboard", label: "דשבורד", href: "/dashboard/parent", icon: Home },
    { key: "calendar", label: "יומן", href: "/dashboard/parent/schedule", icon: CalendarDays },
    { key: "home", label: "בית", href: "/dashboard/parent/family-home", icon: Home }
  ] as const;
  return (
    <nav className="parent-bottom-nav" aria-label="ניווט הורים">
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

export const parentDefaultActions = [
  { title: "מצלמות", href: "/dashboard/parent/cameras", icon: Camera, tone: "purple" as const },
  { title: "הודעות", href: "/dashboard/parent/messages", icon: MessageCircle, tone: "blue" as const },
  { title: "תשלומים", href: "/dashboard/parent/payments", icon: WalletCards, tone: "green" as const },
  { title: "דוחות", href: "/dashboard/parent/inspections", icon: FileText, tone: "orange" as const },
  { title: "פעילות יומית", href: "/dashboard/parent/daily-journal", icon: CalendarDays, tone: "purple" as const }
];
