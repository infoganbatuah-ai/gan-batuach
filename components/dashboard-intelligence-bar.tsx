"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Pin, Sparkles, Star, SunMedium } from "lucide-react";
import type { UserRole } from "@/lib/roles";

type Favorite = {
  href: string;
  label: string;
  type: "גן" | "דוח" | "פנייה" | "פיקוח" | "מצלמה" | "עמוד";
};

const roleActions: Record<UserRole, Array<{ label: string; href: string }>> = {
  admin: [
    { label: "בדיקת פיקוחים באיחור", href: "/dashboard/admin/inspections/late" },
    { label: "מסמכים חסרים", href: "/dashboard/admin/documents" },
    { label: "בריאות ניווט", href: "/dashboard/admin/navigation-health" }
  ],
  manager: [
    { label: "עדכון נוכחות", href: "/dashboard/garden/attendance" },
    { label: "יומן ילד", href: "/dashboard/garden/child-journal" },
    { label: "מסמכי צוות", href: "/dashboard/garden/staff" }
  ],
  owner: [
    { label: "סטטוס פיקוח", href: "/dashboard/garden/inspections" },
    { label: "מסמכי גן", href: "/dashboard/garden/documents" },
    { label: "צוות וציות", href: "/dashboard/garden/staff" }
  ],
  inspector: [
    { label: "פיקוחים קרובים", href: "/dashboard/inspector/inspections/due" },
    { label: "ליקויים", href: "/dashboard/inspector/violations" },
    { label: "אירועי AI", href: "/dashboard/inspector/ai-events" }
  ],
  staff: [
    { label: "משימות היום", href: "/dashboard/staff/tasks" },
    { label: "יומן ילד", href: "/dashboard/staff/child-journal" },
    { label: "מסמכים שלי", href: "/dashboard/staff/documents" }
  ],
  parent: [
    { label: "יומן יומי", href: "/dashboard/parent/daily-journal" },
    { label: "הודעות", href: "/dashboard/parent/messages" },
    { label: "מסמכים", href: "/dashboard/parent/documents" }
  ]
};

const dashboardHomeByRole: Record<UserRole, string> = {
  admin: "/dashboard/admin",
  manager: "/dashboard/garden",
  owner: "/dashboard/garden",
  inspector: "/dashboard/inspector",
  staff: "/dashboard/staff",
  parent: "/dashboard/parent"
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return "בוקר טוב";
  if (hour < 17) return "צהריים טובים";
  if (hour < 21) return "ערב טוב";
  return "לילה טוב";
}

function favoriteType(pathname: string): Favorite["type"] {
  if (pathname.includes("gardens")) return "גן";
  if (pathname.includes("report")) return "דוח";
  if (pathname.includes("complaints") || pathname.includes("reports")) return "פנייה";
  if (pathname.includes("inspection")) return "פיקוח";
  if (pathname.includes("camera")) return "מצלמה";
  return "עמוד";
}

export function DashboardIntelligenceBar({ role, title }: { role: UserRole; title: string }) {
  const pathname = usePathname();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setFavorites(JSON.parse(localStorage.getItem("gan-batuach-favorites") || "[]"));
    } catch {
      setFavorites([]);
    }
  }, []);

  function save(next: Favorite[]) {
    const normalized = next.slice(0, 8);
    setFavorites(normalized);
    localStorage.setItem("gan-batuach-favorites", JSON.stringify(normalized));
  }

  const currentPinned = useMemo(() => favorites.some((item) => item.href === pathname), [favorites, pathname]);
  const isMainDashboard = pathname === dashboardHomeByRole[role];

  function togglePin() {
    if (!mounted) return;
    if (currentPinned) {
      save(favorites.filter((item) => item.href !== pathname));
    } else {
      save([{ href: pathname, label: title, type: favoriteType(pathname) }, ...favorites]);
    }
  }

  if (!isMainDashboard) {
    return (
      <details className="dashboard-intelligence-bar compact">
        <summary><Sparkles size={15} /> כלים חכמים וקיצורים</summary>
        <div className="pending-actions-strip">
          {roleActions[role].slice(0, 3).map((action) => <Link href={action.href} key={action.href}>{action.label}</Link>)}
        </div>
      </details>
    );
  }

  return (
    <section className="dashboard-intelligence-bar">
      <div className="greeting-card">
        <SunMedium />
        <div>
          <strong>{greeting()}</strong>
          <span>{new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })} · {title}</span>
        </div>
      </div>
      <div className="today-summary-card">
        <Sparkles />
        <div>
          <strong>מה חשוב עכשיו?</strong>
          <span>{roleActions[role].slice(0, 2).map((item) => item.label).join(" · ")}</span>
        </div>
      </div>
      <div className="pending-actions-strip">
        {roleActions[role].map((action) => <Link href={action.href} key={action.href}>{action.label}</Link>)}
      </div>
      <button className={currentPinned ? "pin-current active" : "pin-current"} type="button" onClick={togglePin}>
        <Pin size={15} />
        {currentPinned ? "נעוץ" : "נעץ עמוד"}
      </button>
      <div className="favorites-rail">
        <Star size={15} />
        {favorites.length === 0 ? <span>אין מועדפים עדיין</span> : favorites.slice(0, 4).map((item) => <Link href={item.href} key={item.href}><b>{item.type}</b>{item.label}</Link>)}
      </div>
    </section>
  );
}
