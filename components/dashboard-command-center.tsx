"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowUpDown, EyeOff, Grip, Pin, RotateCcw, Sparkles } from "lucide-react";
import { Avatar } from "@/components/avatar";
import type { UserRole } from "@/lib/roles";

type WidgetCard = {
  title: string;
  count: number;
  href: string;
  tone: "good" | "warn" | "bad";
};

type Summary = {
  commandCards: WidgetCard[];
  activity: WidgetCard[];
};

const roleName: Record<UserRole, string> = {
  admin: "אדמין",
  manager: "מנהלת גן",
  owner: "בעלים",
  inspector: "פקח",
  staff: "צוות",
  parent: "הורה"
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "בוקר טוב";
  if (hour < 17) return "צהריים טובים";
  if (hour < 21) return "ערב טוב";
  return "לילה טוב";
}

function storageKey(role: UserRole) {
  return `gan-batuach-dashboard-widgets-${role}`;
}

const dashboardHomeByRole: Record<UserRole, string> = {
  admin: "/dashboard/admin",
  manager: "/dashboard/garden",
  owner: "/dashboard/garden",
  inspector: "/dashboard/inspector",
  staff: "/dashboard/staff",
  parent: "/dashboard/parent"
};

export function DashboardCommandCenter({ role, title }: { role: UserRole; title: string }) {
  const pathname = usePathname();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [recentPages, setRecentPages] = useState<Array<{ href: string; title: string; at: string }>>([]);

  useEffect(() => {
    fetch("/api/dashboard/interaction-summary")
      .then((response) => response.json())
      .then((body) => setSummary(body.data as Summary))
      .catch(() => setSummary({ commandCards: [], activity: [] }));
  }, []);

  useEffect(() => {
    try {
      const settings = JSON.parse(localStorage.getItem(storageKey(role)) || "{}");
      setHidden(settings.hidden ?? []);
      setPinned(settings.pinned ?? []);
      const previous = JSON.parse(localStorage.getItem("gan-batuach-recent-pages") || "[]") as Array<{ href: string; title: string; at: string }>;
      const next = [{ href: pathname, title, at: new Date().toISOString() }, ...previous.filter((item) => item.href !== pathname)].slice(0, 6);
      setRecentPages(next);
      localStorage.setItem("gan-batuach-recent-pages", JSON.stringify(next));
    } catch {
      setRecentPages([]);
    }
  }, [pathname, role, title]);

  function persist(nextHidden = hidden, nextPinned = pinned) {
    setHidden(nextHidden);
    setPinned(nextPinned);
    localStorage.setItem(storageKey(role), JSON.stringify({ hidden: nextHidden, pinned: nextPinned }));
  }

  const visibleCommandCards = useMemo(() => {
    const cards = summary?.commandCards ?? [];
    return cards
      .filter((card) => !hidden.includes(card.title))
      .sort((a, b) => Number(pinned.includes(b.title)) - Number(pinned.includes(a.title)));
  }, [summary, hidden, pinned]);

  const topAction = visibleCommandCards[0];
  const isMainDashboard = pathname === dashboardHomeByRole[role];

  if (!isMainDashboard) {
    return (
      <details className="command-center-layer compact">
        <summary><Sparkles size={15} /> מה לעשות עכשיו / פעילות אחרונה</summary>
        <div className="command-card-list compact-list">
          {visibleCommandCards.slice(0, 3).map((card) => <Link className={`command-action-card ${card.tone}`} href={card.href} key={card.title}><strong>{card.count}</strong><span>{card.title}</span></Link>)}
        </div>
      </details>
    );
  }

  return (
    <section className="command-center-layer">
      <div className="animated-dashboard-hero">
        <div className="hero-logo-orbit"><Image src="/assets/company-symbol.png" alt="גן בטוח" width={54} height={54} /><i /><i /></div>
        <div>
          <p className="eyebrow">{greeting()} · {new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</p>
          <h2>{title}</h2>
          <p>{topAction ? `הפעולה הכי חשובה כרגע: ${topAction.title}` : "המערכת לא מזהה פעולה דחופה כרגע."}</p>
        </div>
        <Avatar name={roleName[role]} size="lg" />
      </div>
      <div className="command-center-grid">
        <article className="command-panel">
          <div className="command-panel-head"><div><span className="pill good"><Sparkles size={14} /> Command Center</span><h3>מה לעשות עכשיו?</h3></div><button className="icon-button" type="button" onClick={() => persist([], [])} aria-label="איפוס התאמה אישית"><RotateCcw size={16} /></button></div>
          {visibleCommandCards.length === 0 ? <div className="empty-mini">כל כרטיסי הפעולה מוסתרים. אפשר לאפס התאמה אישית.</div> : <div className="command-card-list">{visibleCommandCards.map((card) => <Link className={`command-action-card ${card.tone}`} href={card.href} key={card.title}>
            <strong>{card.count}</strong>
            <span>{card.title}</span>
            <div className="widget-controls" onClick={(event) => event.preventDefault()}>
              <button type="button" title="נעיצה" onClick={() => persist(hidden, pinned.includes(card.title) ? pinned.filter((item) => item !== card.title) : [card.title, ...pinned])}><Pin size={13} /></button>
              <button type="button" title="הסתרה" onClick={() => persist([...hidden, card.title], pinned)}><EyeOff size={13} /></button>
              <button type="button" title="סימון העדפה"><Grip size={13} /></button>
            </div>
          </Link>)}</div>}
        </article>
        <article className="command-panel">
          <div className="command-panel-head"><div><span className="pill warn"><Activity size={14} /> Live</span><h3>פעילות אחרונה</h3></div><ArrowUpDown size={16} /></div>
          <div className="live-widget-grid">{(summary?.activity ?? []).map((item) => <Link className={`live-widget ${item.tone}`} href={item.href} key={item.title}><span>{item.title}</span><strong>{item.count}</strong></Link>)}</div>
        </article>
        <article className="command-panel continue-panel">
          <div className="command-panel-head"><div><span className="pill">Continue</span><h3>המשך מאיפה שעצרת</h3></div></div>
          {recentPages.length === 0 ? <div className="empty-mini">העמודים האחרונים יופיעו כאן אחרי ניווט קצר במערכת.</div> : <div className="recent-page-list">{recentPages.slice(1, 5).map((page) => <Link href={page.href} key={`${page.href}-${page.at}`}><span>{page.title}</span><small>{new Date(page.at).toLocaleString("he-IL")}</small></Link>)}</div>}
        </article>
      </div>
    </section>
  );
}
