import { israelTodayDateKey } from "@/lib/domain/israel-date";
import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Filter,
  LogOut as LogOutIcon,
  MoreHorizontal,
  Search,
  Send,
  UsersRound,
  XCircle,
  type LucideIcon
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { GardenAttendanceActionButton } from "@/components/garden-attendance-action-button";
import {
  TeacherActionTile,
  TeacherAppFrame,
  TeacherEmptyState,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";
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
  const today = israelTodayDateKey();
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
  const gardenName = cleanDemoText((gardenRes.data as any)?.name, "הגן") || "הגן";
  const avatarUrl = typeof (profile as any).profile_image_url === "string" && (profile as any).profile_image_url.trim()
    ? (profile as any).profile_image_url
    : "/assets/teacher-avatar.svg";
  const summaryStats: Array<{ label: string; value: number; hint: string; icon: LucideIcon; tone: string }> = [
    { label: "סה״כ ילדים", value: totalChildren, hint: "בגן היום", icon: UsersRound, tone: "purple" },
    { label: "נוכחים", value: present, hint: "ילדים", icon: CheckCircle2, tone: "green" },
    { label: "נעדרים", value: absent, hint: "דורש בדיקה", icon: XCircle, tone: "pink" },
    { label: "מאחרים", value: late, hint: "מעקב הגעה", icon: Clock3, tone: "orange" }
  ];
  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="נוכחות וצ׳ק אין" appHome>
      <TeacherAppFrame
        title={`נוכחות וצ׳ק אין`}
        subtitle={`ניהול נוכחות הילדים ב${gardenName}`}
        avatarUrl={avatarUrl}
        active="children"
      >
        <TeacherStatsGrid>
          {summaryStats.map(({ label, value, hint, icon, tone }) => (
            <TeacherStatCard
              key={label}
              title={label}
              value={value}
              hint={hint}
              icon={icon}
              tone={tone === "green" ? "green" : tone === "pink" ? "red" : tone === "orange" ? "orange" : "purple"}
            />
          ))}
        </TeacherStatsGrid>

        <TeacherSection
          title="רשימת נוכחות"
          subtitle={`${presentPct}% מרשומות היום עודכנו`}
          action={<Link className="dashboard-text-link" href="/dashboard/garden/attendance?filter=missing">טרם סומנו</Link>}
        >
          <form className="attendance-live-filterbar" action="/dashboard/garden/attendance">
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

          <div className="attendance-live-list">
            {displayRows.length ? displayRows.map((row) => {
              const meta = statusMeta[row.status];
              const StatusIcon = meta.icon;
              return (
                <article className="attendance-live-row" key={row.id}>
                  <span className="attendance-live-avatar">{row.avatar}</span>
                  <div className="attendance-live-person">
                    <b>{row.childName}</b>
                    <small>{row.group}</small>
                  </div>
                  <em className={`attendance-live-chip ${row.status}`}>
                    <StatusIcon size={17} />
                    {meta.label}
                  </em>
                  <p className="attendance-live-times">הגעה <strong>{row.arrival}</strong><span>איסוף <strong>{row.pickup}</strong></span></p>
                  <div className="attendance-live-actions">
                    <GardenAttendanceActionButton childId={row.childId ?? row.id} currentStatus={row.status} disabled={!row.childId} />
                    {row.childId ? (
                      <Link className="role-app-icon-button" href={`/dashboard/garden/children/${row.childId}`} aria-label={`כרטיס הילד ${row.childName}`}><MoreHorizontal size={22} /></Link>
                    ) : null}
                  </div>
                </article>
              );
            }) : (
              <TeacherEmptyState
                title={params.filter === "missing" ? "אין ילדים שממתינים לסימון" : "אין ילדים להצגה"}
                text={children.length ? "אין תוצאות בסינון הנוכחי. אפשר לשנות סינון או לחזור לכל הילדים." : "לא נמצאו ילדים פעילים בגן. לאחר הוספת ילדים, הנוכחות היומית תופיע כאן."}
                action={<Link className="button secondary" href="/dashboard/garden/children">ניהול ילדים</Link>}
              />
            )}
          </div>
        </TeacherSection>

        <TeacherQuickActions>
          <TeacherActionTile title="הודעה להורים" href="/dashboard/garden/messages?compose=1#message-workbench" icon={Send} tone="purple" />
          <TeacherActionTile title="ספירת נוכחות" href="/dashboard/garden/attendance" icon={ClipboardCheck} tone="blue" />
          <TeacherActionTile title="דוח נוכחות יומי" href="/dashboard/garden/reports?manage=1#reports-workbench" icon={BarChart3} tone="purple" />
        </TeacherQuickActions>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
