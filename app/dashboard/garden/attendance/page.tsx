import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ClipboardCheck,
  Clock3,
  Filter,
  Home,
  LogOut as LogOutIcon,
  MoreHorizontal,
  Search,
  Send,
  UsersRound,
  XCircle,
  Zap,
  type LucideIcon
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { GardenAttendanceActionButton } from "@/components/garden-attendance-action-button";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type AttendanceRow = {
  id: string;
  childId?: string;
  childName: string;
  group: string;
  status: "present" | "late" | "absent" | "not_updated" | "left_early";
  arrival: string;
  pickup: string;
  avatar: string;
};

const statusMeta = {
  present: { label: "נכח", tone: "success" as const, icon: CheckCircle2 },
  late: { label: "מאחר", tone: "warning" as const, icon: Clock3 },
  absent: { label: "נעדר", tone: "danger" as const, icon: XCircle },
  left_early: { label: "יצא", tone: "muted" as const, icon: LogOutIcon },
  not_updated: { label: "טרם סומן", tone: "muted" as const, icon: Clock3 }
};

function cleanDemoText(value?: string | null, fallback = "") {
  return (value ?? fallback).replace(/\[DEMO\]/g, "").replace(/\s+/g, " ").trim();
}

function toDisplayTime(value?: string | null) {
  if (!value) return "-";
  const timePart = value.includes("T") ? value.split("T")[1] : value;
  return timePart.slice(0, 5) || "-";
}

function normalizeAttendanceStatus(value?: string | null): AttendanceRow["status"] {
  const rawStatus = String(value ?? "");
  if (rawStatus === "late") return "late";
  if (rawStatus === "absent") return "absent";
  if (rawStatus === "left_early") return "left_early";
  if (rawStatus === "checked_out" || rawStatus === "present" || rawStatus === "checked_in") return "present";
  return "not_updated";
}

export default async function GardenAttendancePage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const gardenId = profile.garden_id ?? "";

  const [attendanceRes, childrenRes, gardenRes] = await Promise.all([
    supabase
      .from("attendance" as any)
      .select("id, child_id, status, attendance_date, check_in_at, check_out_at, pickup_name, children(full_name), staff(full_name)")
      .eq("garden_id", gardenId)
      .eq("attendance_date", today)
      .order("created_at", { ascending: false }),
    supabase
      .from("children" as any)
      .select("id, full_name, status")
      .eq("garden_id", gardenId)
      .in("status", ["active", "approved"])
      .order("full_name"),
    supabase
      .from("gardens" as any)
      .select("name")
      .eq("id", gardenId)
      .maybeSingle()
  ]);

  const attendance = (attendanceRes.data ?? []) as any[];
  const children = (childrenRes.data ?? []) as any[];
  const attendanceByChildId = new Map(attendance.filter((row) => row.child_id).map((row) => [row.child_id, row]));
  const childRows: AttendanceRow[] = children.map((child, index) => {
    const attendanceRow = attendanceByChildId.get(child.id);
    const status = normalizeAttendanceStatus(attendanceRow?.status);
    const childName = child.full_name ?? "ילד/ה";
    return {
      id: child.id ?? `child-${index}`,
      childId: child.id,
      childName,
      group: status === "not_updated" ? "טרם סומן/ה היום" : status === "left_early" ? "יציאה עודכנה" : "נוכחות עודכנה",
      status,
      arrival: toDisplayTime(attendanceRow?.check_in_at),
      pickup: attendanceRow?.pickup_name ?? "טרם נקבע",
      avatar: childName.slice(0, 1) || `${index + 1}`
    };
  });
  const orphanAttendanceRows: AttendanceRow[] = children.length
    ? []
    : attendance.map((row, index) => {
        const status = normalizeAttendanceStatus(row.status);
        const name = row.children?.full_name ?? row.staff?.full_name ?? "נוכחות";
        return {
          id: row.id ?? `attendance-${index}`,
          childId: row.child_id ?? undefined,
          childName: name,
          group: status === "present" ? "נוכחות עודכנה" : status === "left_early" ? "יציאה עודכנה" : "דורש מעקב",
          status,
          arrival: toDisplayTime(row.check_in_at),
          pickup: row.pickup_name ?? "לא נקבע",
          avatar: name.slice(0, 1) || `${index + 1}`
        };
      });
  const allRows = childRows.length ? childRows : orphanAttendanceRows;
  const displayRows = allRows.filter((row) => {
    if (params.filter === "missing") return row.status === "not_updated";
    if (params.filter === "present") return row.status === "present";
    return true;
  });
  const totalChildren = children.length || allRows.length;
  const present = allRows.filter((row) => row.status === "present").length;
  const absent = allRows.filter((row) => row.status === "absent").length;
  const late = allRows.filter((row) => row.status === "late").length;
  const presentPct = Math.min(100, Math.round((present / Math.max(totalChildren, 1)) * 100));
  const cleanProfileName = cleanDemoText(profile.full_name, "מנהלת");
  const teacherFirstName = cleanProfileName.split(" ").filter(Boolean)[0] || "מנהלת";
  const gardenName = cleanDemoText((gardenRes.data as any)?.name, "הגן") || "הגן";
  const avatarUrl = typeof (profile as any).avatar_url === "string" && (profile as any).avatar_url.trim()
    ? (profile as any).avatar_url
    : "/assets/teacher-avatar.svg";
  const activeNavHref = "/dashboard/garden/attendance";
  const summaryStats: Array<{ label: string; value: number; hint: string; icon: LucideIcon; tone: string }> = [
    { label: "סה״כ ילדים", value: totalChildren, hint: "בגן היום", icon: UsersRound, tone: "purple" },
    { label: "נוכחים", value: present, hint: "ילדים", icon: CheckCircle2, tone: "green" },
    { label: "נעדרים", value: absent, hint: "דורש בדיקה", icon: XCircle, tone: "pink" },
    { label: "מאחרים", value: late, hint: "מעקב הגעה", icon: Clock3, tone: "orange" }
  ];
  const navItems = [
    { href: "/dashboard/garden/command-center", label: "עוד", icon: MoreHorizontal },
    { href: "/dashboard/garden/notifications", label: "התראות", icon: Bell, badge: "2" },
    { href: activeNavHref, label: "נוכחות", icon: Home },
    { href: "/dashboard/garden/daily-journal", label: "יומן", icon: CalendarDays },
    { href: "/dashboard/garden", label: "בית", icon: Home }
  ];

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="נוכחות וצ׳ק אין" appHome>
      <main className="ganenet-reference-phone ganenet-module-screen ganenet-attendance-screen" dir="rtl">
        <header className="ganenet-reference-header">
          <div className="ganenet-logo-lockup" aria-label="גן בטוח">
            <Image src="/assets/company-name.png" alt="גן בטוח" width={300} height={96} priority />
            <Image src="/assets/company-symbol.png" alt="" width={92} height={92} priority />
          </div>

          <div className="ganenet-profile-actions">
            <a className="ganenet-avatar" href="/dashboard/garden/settings" aria-label="פרופיל">
              <img src={avatarUrl} alt="" />
            </a>
            <ChevronDown className="ganenet-profile-chevron" size={28} />
            <a className="ganenet-bell" href="/dashboard/garden/notifications" aria-label="התראות">
              <Bell size={34} />
              <i />
            </a>
          </div>

          <div className="ganenet-greeting">
            <div>
              <h1>נוכחות וצ׳ק אין <span>👥</span></h1>
              <p>ניהול נוכחות הילדים ב{gardenName} <ChevronLeft size={22} /></p>
            </div>
          </div>
        </header>

        <div className="ganenet-date-pill">
          <CalendarDays size={32} />
          <span>יום ראשון, כ״ה אייר תשפ״ה<br />25 במאי 2025</span>
        </div>

        <section className="ganenet-attendance-summary-grid">
          {summaryStats.map(({ label, value, hint, icon: Icon, tone }) => (
            <article className={`ganenet-attendance-stat ${tone}`} key={label}>
              <span><Icon size={30} /></span>
              <strong>{label}</strong>
              <b>{value}</b>
              <small>{hint}</small>
            </article>
          ))}
        </section>

        <section className="ganenet-card ganenet-attendance-panel">
          <div className="ganenet-section-title">
            <h2>רשימת נוכחות <ClipboardCheck size={30} /></h2>
            <a href="/dashboard/garden/attendance?filter=missing">טרם סומנו ›</a>
          </div>

          <form className="ganenet-attendance-filterbar" action="/dashboard/garden/attendance">
            <label>
              <Search size={23} />
              <input name="q" placeholder="חיפוש ילד או הורה" />
            </label>
            <label>
              <Filter size={22} />
              <select name="filter" defaultValue={params.filter ?? "all"}>
                <option value="all">כל הסטטוסים</option>
                <option value="missing">טרם סומנו</option>
                <option value="present">נוכחים</option>
              </select>
            </label>
            <label>
              <UsersRound size={22} />
              <select name="group" defaultValue="all">
                <option value="all">כל הקבוצות</option>
                <option value="flowers">קבוצת פרחים</option>
                <option value="purple">קבוצת סגול</option>
              </select>
            </label>
          </form>

          <div className="ganenet-attendance-list">
            {displayRows.length ? displayRows.map((row) => {
              const meta = statusMeta[row.status];
              const StatusIcon = meta.icon;
              return (
                <article className="ganenet-attendance-row" key={row.id}>
                  <span className="ganenet-attendance-avatar">{row.avatar}</span>
                  <div>
                    <b>{row.childName}</b>
                    <small>{row.group}</small>
                  </div>
                  <em className={`ganenet-attendance-chip ${row.status}`}>
                    <StatusIcon size={17} />
                    {meta.label}
                  </em>
                  <p>הגעה: <strong>{row.arrival}</strong><br />איסוף: <strong>{row.pickup}</strong></p>
                  <GardenAttendanceActionButton
                    childId={row.childId ?? row.id}
                    currentStatus={row.status}
                    disabled={!row.childId}
                  />
                  {row.childId ? (
                    <Link href={`/dashboard/garden/children/${row.childId}`} aria-label="כרטיס ילד"><MoreHorizontal size={22} /></Link>
                  ) : (
                    <span className="ganenet-attendance-more-disabled" aria-label="אין כרטיס ילד"><MoreHorizontal size={22} /></span>
                  )}
                </article>
              );
            }) : (
              <div className="ganenet-attendance-empty">
                <UsersRound size={54} />
                <b>{params.filter === "missing" ? "אין ילדים שממתינים לסימון" : "אין ילדים להצגה"}</b>
                <p>{children.length ? "אין תוצאות בסינון הנוכחי. אפשר לשנות סינון או לחזור לכל הילדים." : "עדיין לא נמצאו ילדים פעילים בגן. לאחר הוספת ילדים, הנוכחות היומית תופיע כאן."}</p>
                <Link href="/dashboard/garden/children">ניהול ילדים</Link>
              </div>
            )}
          </div>
        </section>

        <section className="ganenet-card ganenet-attendance-actions-panel">
          <div className="ganenet-section-title">
            <h2>פעולות מהירות <span className="ganenet-section-icon"><Zap size={28} /></span></h2>
          </div>
          <div className="ganenet-action-row">
            <a className="ganenet-action purple" href="/dashboard/garden/messages?compose=1#message-workbench">
              <span><Send size={35} /></span>
              <b>הודעה להורים</b>
            </a>
            <a className="ganenet-action blue" href="/dashboard/garden/attendance">
              <span><ClipboardCheck size={35} /></span>
              <b>ספירת נוכחות</b>
              <small>{presentPct}% עודכנו</small>
            </a>
            <a className="ganenet-action purple" href="/dashboard/garden/reports?manage=1#reports-workbench">
              <span><BarChart3 size={35} /></span>
              <b>דוח נוכחות יומי</b>
            </a>
          </div>
        </section>

        <nav className="ganenet-bottom-nav" aria-label="ניווט גננת">
          {navItems.map(({ href, label, icon: Icon, badge }) => (
            <a className={href === activeNavHref ? "active" : undefined} href={href} key={href}>
              <span><Icon size={href === activeNavHref ? 38 : 28} /></span>
              {badge ? <i>{badge}</i> : null}
              <b>{label}</b>
            </a>
          ))}
        </nav>
      </main>
    </DashboardShell>
  );
}
