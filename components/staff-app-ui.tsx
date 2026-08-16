import Image from "next/image";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { Bell, BriefcaseBusiness, CalendarDays, FileCheck2, Home, Menu, MessageCircle, Search, UserRound } from "lucide-react";
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
import { RoleAppShell } from "@/components/role-app-shell";

type Tone = "blue" | "purple" | "green" | "orange" | "red" | "neutral";
type IconType = ComponentType<LucideProps>;

export function StaffAppFrame({
  children,
  active = "home",
  avatarUrl,
  profileName,
  mode = "assigned"
}: {
  children: ReactNode;
  active?: "profile" | "shifts" | "home" | "messages" | "more" | "jobs" | "applications" | "documents";
  avatarUrl?: string | null;
  profileName?: string | null;
  mode?: "assigned" | "candidate";
}) {
  const activeHref = mode === "candidate"
    ? active === "jobs" ? "/dashboard/staff/job-market" : active === "applications" ? "/dashboard/staff/job-market#applications" : active === "documents" ? "/dashboard/staff/documents" : active === "profile" ? "/dashboard/staff/settings" : "/dashboard/staff"
    : active === "shifts" ? "/dashboard/staff/shifts" : active === "messages" ? "/dashboard/staff/messages" : active === "profile" ? "/dashboard/staff/settings" : active === "more" ? "/dashboard/staff/tasks" : "/dashboard/staff";
  return (
    <RoleAppShell
      role="staff"
      activeHref={activeHref}
      title={mode === "candidate" ? "מרכז מועמדות לצוות" : "דשבורד צוות"}
      subtitle={mode === "candidate" ? "פרופיל, מסמכים וחיפוש גן" : "משמרות, משימות ותקשורת"}
      profile={{ full_name: profileName ?? "צוות", profile_image_url: avatarUrl }}
      className="staff-runtime-shell"
    >
      <main className="staff-app-main dashboard-runtime-content">{children}</main>
    </RoleAppShell>
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

export function StaffBottomNav({ active, mode = "assigned" }: { active: "profile" | "shifts" | "home" | "messages" | "more" | "jobs" | "applications" | "documents"; mode?: "assigned" | "candidate" }) {
  const assignedItems = [
    { key: "profile", label: "פרופיל", href: "/dashboard/staff/settings", icon: UserRound },
    { key: "shifts", label: "משמרות", href: "/dashboard/staff/shifts", icon: CalendarDays },
    { key: "home", label: "ראשי", href: "/dashboard/staff", icon: Home },
    { key: "messages", label: "הודעות", href: "/dashboard/staff/messages", icon: MessageCircle },
    { key: "more", label: "עוד", href: "/dashboard/staff/tasks", icon: Menu }
  ] as const;
  const candidateItems = [
    { key: "profile", label: "פרופיל", href: "/dashboard/staff/settings", icon: UserRound },
    { key: "documents", label: "מסמכים", href: "/dashboard/staff/documents", icon: FileCheck2 },
    { key: "home", label: "ראשי", href: "/dashboard/staff", icon: Home },
    { key: "applications", label: "מועמדויות", href: "/dashboard/staff/job-market#applications", icon: BriefcaseBusiness },
    { key: "jobs", label: "חיפוש גנים", href: "/dashboard/staff/job-market", icon: Search }
  ] as const;
  const items = mode === "candidate" ? candidateItems : assignedItems;
  return (
    <BottomNav
      className="staff-bottom-nav-ref"
      activeHref={items.find((item) => item.key === active)?.href}
      items={items.map((item) => ({ href: item.href, label: item.label, icon: item.icon }))}
    />
  );
}
