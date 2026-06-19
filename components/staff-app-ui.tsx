import Image from "next/image";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { Bell, CalendarDays, Home, Menu, MessageCircle, UserRound } from "lucide-react";
import type { LucideProps } from "lucide-react";

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
    <div className="staff-app-frame" dir="rtl">
      <header className="staff-app-top">
        <div className="staff-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : <span>צ</span>}<i /></div>
        <div className="staff-brand">
          <Image src="/assets/company-symbol.png" alt="" width={96} height={96} />
          <Image src="/assets/company-name.png" alt="גן בטוח" width={260} height={82} />
          <p>עובדים. שומרים. אכפתיים.</p>
        </div>
        <button className="staff-bell" type="button" aria-label="התראות"><Bell size={28} /><span /></button>
      </header>
      <main className="staff-app-main">{children}</main>
      <StaffBottomNav active={active} />
    </div>
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
  const content = (
    <>
      <Icon size={32} />
      <strong>{value}</strong>
      <span>{title}</span>
      {hint ? <small>{hint}</small> : null}
    </>
  );
  if (href) return <Link className={`staff-metric-ref ${tone}`} href={href}>{content}</Link>;
  return <article className={`staff-metric-ref ${tone}`}>{content}</article>;
}

export function StaffSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="staff-section-ref">
      <div className="staff-section-head">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StaffTaskRow({ title, time, done }: { title: string; time: string; done?: boolean }) {
  return (
    <article className="staff-task-row">
      <span className={done ? "done" : ""} />
      <strong>{title}</strong>
      <time>{time}</time>
    </article>
  );
}

export function StaffMessageRow({ title, body, time }: { title: string; body: string; time: string }) {
  return (
    <article className="staff-message-row">
      <time>{time}</time>
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
    </article>
  );
}

export function StaffActionTile({ title, href, icon: Icon }: { title: string; href: string; icon: IconType }) {
  return (
    <Link className="staff-action-ref" href={href}>
      <Icon size={28} />
      <strong>{title}</strong>
    </Link>
  );
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
    <nav className="staff-bottom-nav-ref" aria-label="ניווט צוות">
      {items.map((item) => {
        const Icon = item.icon;
        return <Link className={active === item.key ? "active" : ""} href={item.href} key={item.key}><Icon size={25} /><span>{item.label}</span></Link>;
      })}
    </nav>
  );
}
