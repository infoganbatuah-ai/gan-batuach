import Image from "next/image";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { Bell, CalendarDays, Home, Menu, MessageCircle, UserRound } from "lucide-react";
import type { LucideProps } from "lucide-react";
import {
  ActionCard,
  AppHeader,
  AppShell,
  BottomNav,
  DashboardGrid,
  EmptyState,
  ListRowCard,
  MetricCard,
  SectionHeader
} from "@/components/gan-batuach-design-system";

type Tone = "blue" | "purple" | "green" | "orange" | "red" | "neutral";
type IconType = ComponentType<LucideProps>;

export function StaffAppFrame({
  children,
  active = "home",
  avatarUrl
}: {
  children: ReactNode;
  active?: "profile" | "shifts" | "home" | "messages" | "more";
  avatarUrl?: string | null;
}) {
  return (
    <AppShell
      className="staff-app-frame staff-gb-frame"
      header={
        <AppHeader
          className="staff-gb-header"
          logo={
            <div className="staff-brand">
              <Image src="/assets/company-symbol.png" alt="" width={80} height={80} />
              <Image src="/assets/company-name.png" alt="גן בטוח" width={220} height={70} />
            </div>
          }
          title="צוות גן"
          subtitle="עובדים. שומרים. אכפתיים."
          notification={<button className="staff-bell" type="button" aria-label="התראות"><Bell size={26} /><span /></button>}
          avatar={<div className="staff-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : <span>צ</span>}<i /></div>}
        />
      }
      bottomNav={<StaffBottomNav active={active} />}
    >
      <main className="staff-app-main">{children}</main>
    </AppShell>
  );
}

export function StaffShiftHero({ name, subtitle, children }: { name: string; subtitle: string; children?: ReactNode }) {
  return (
    <section className="staff-reference-hero">
      <div>
        <h1>בוקר טוב, {name}</h1>
        <p>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export function StaffInfoPill({ title, value, icon: Icon }: { title: string; value: string; icon: IconType }) {
  return (
    <article className="staff-info-pill">
      <Icon size={28} />
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function StaffShiftCard({ status, hours, children }: { status: string; hours: string; children?: ReactNode }) {
  return (
    <section className="staff-shift-card-ref">
      <div className="staff-calendar-art" aria-hidden="true" />
      <div>
        <h2>המשמרת שלי</h2>
        <strong>{hours}</strong>
        <p><span /> {status}</p>
      </div>
      {children}
    </section>
  );
}

export function StaffMetricCard({ title, value, hint, icon: Icon, tone = "purple", href }: { title: string; value: ReactNode; hint?: string; icon: IconType; tone?: Tone; href?: string }) {
  const map = { blue: "info", purple: "primary", green: "success", orange: "warning", red: "danger", neutral: "muted" } as const;
  return <MetricCard href={href} label={title} value={value} hint={hint} icon={Icon} tone={map[tone]} />;
}

export function StaffSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="staff-section-ref gb-staff-section">
      <SectionHeader title={title} action={action} />
      {children}
    </section>
  );
}

export function StaffPageHero({
  eyebrow,
  title,
  text,
  badge,
  icon: Icon
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  text?: ReactNode;
  badge?: ReactNode;
  icon?: IconType;
}) {
  return (
    <section className="staff-page-hero-ref">
      <div>
        {eyebrow ? <p className="gb-section-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {text ? <p>{text}</p> : null}
      </div>
      <div className="staff-page-hero-side">
        {Icon ? <span><Icon size={28} /></span> : null}
        {badge}
      </div>
    </section>
  );
}

export function StaffStats({ children }: { children: ReactNode }) {
  return <DashboardGrid columns={3} min="150px" className="staff-stats-grid-ref">{children}</DashboardGrid>;
}

export function StaffEmpty({ title, text, icon }: { title: ReactNode; text?: ReactNode; icon?: IconType }) {
  return <EmptyState title={title} text={text} icon={icon} />;
}

export function StaffCard({ children, href }: { children: ReactNode; href?: string }) {
  return <ListRowCard title={children} href={href} actions={null} className="staff-data-row-ref" />;
}

export function StaffTaskRow({ title, time, done }: { title: string; time: string; done?: boolean }) {
  return (
    <ListRowCard
      className="staff-task-row"
      title={title}
      subtitle={done ? "הושלם" : "ממתין לטיפול"}
      meta={time}
      status={<span className={done ? "done" : ""} />}
      actions={null}
    />
  );
}

export function StaffMessageRow({ title, body, time }: { title: string; body: string; time: string }) {
  return (
    <ListRowCard className="staff-message-row" title={title} subtitle={body} meta={time} actions={null} />
  );
}

export function StaffActionTile({ title, href, icon: Icon }: { title: string; href: string; icon: IconType }) {
  return <ActionCard title={title} href={href} icon={Icon} />;
}

export function StaffBottomNav({ active }: { active: "profile" | "shifts" | "home" | "messages" | "more" }) {
  const items = [
    { key: "profile", label: "פרופיל", href: "/dashboard/staff/settings", icon: UserRound },
    { key: "shifts", label: "משמרות", href: "/dashboard/staff/shifts", icon: CalendarDays },
    { key: "home", label: "ראשי", href: "/dashboard/staff", icon: Home },
    { key: "messages", label: "הודעות", href: "/dashboard/staff/messages", icon: MessageCircle },
    { key: "more", label: "עוד", href: "/dashboard/staff/tasks", icon: Menu }
  ] as const;
  return (
    <BottomNav
      className="staff-bottom-nav-ref"
      activeHref={items.find((item) => item.key === active)?.href}
      items={items.map((item) => ({ href: item.href, label: item.label, icon: item.icon }))}
    />
  );
}
