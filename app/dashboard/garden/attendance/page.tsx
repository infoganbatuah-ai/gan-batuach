import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Filter,
  Home,
  LogIn,
  LogOut,
  MoreHorizontal,
  Search,
  Send,
  UsersRound,
  XCircle
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  ActionCard,
  AppHeader,
  BottomNav,
  DashboardGrid,
  EmptyState,
  FormField,
  ListRowCard,
  MetricCard,
  PremiumCard,
  ResponsivePage,
  SearchFilterBar,
  SectionHeader,
  StatusChip
} from "@/components/gan-batuach-design-system";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type AttendanceRow = {
  id: string;
  childName: string;
  group: string;
  status: "present" | "late" | "absent" | "not_updated";
  arrival: string;
  pickup: string;
  avatar: string;
};

const statusMeta = {
  present: { label: "נכח", tone: "success" as const, icon: CheckCircle2 },
  late: { label: "מאחר", tone: "warning" as const, icon: Clock3 },
  absent: { label: "נעדר", tone: "danger" as const, icon: XCircle },
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
      .gte("attendance_date", today)
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
      childName,
      group: status === "not_updated" ? "טרם סומן/ה היום" : "נוכחות עודכנה",
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
          childName: name,
          group: status === "present" ? "נוכחות עודכנה" : "דורש מעקב",
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

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="נוכחות וצ׳ק אין" appHome>
      <ResponsivePage className="gb-teacher-module-page gb-teacher-attendance-page" size="lg">
        <section className="gb-teacher-app-surface" dir="rtl">
          <AppHeader
            className="gb-teacher-module-header"
            logo={(
              <div className="gb-teacher-module-brand" aria-label="גן בטוח">
                <Image src="/assets/company-name.png" alt="גן בטוח" width={262} height={84} priority />
                <Image src="/assets/company-symbol.png" alt="" width={70} height={70} priority />
              </div>
            )}
            title={<>נוכחות וצ׳ק אין <UsersRound size={34} /></>}
            subtitle={`ניהול נוכחות הילדים ב${gardenName} · בוקר טוב, ${teacherFirstName}`}
            notification={(
              <Link className="gb-teacher-round-button" href="/dashboard/garden/notifications" aria-label="התראות">
                <Bell size={26} />
                <i />
              </Link>
            )}
            avatar={(
              <Link className="gb-teacher-avatar" href="/dashboard/profile" aria-label="פרופיל">
                <img src={avatarUrl} alt="" />
                <i />
              </Link>
            )}
            action={<ChevronDown className="gb-teacher-profile-chevron" size={24} />}
            date={(
              <>
                <CalendarDays size={26} />
                <span>יום ראשון, כ״ה אייר תשפ״ה<br />25 במאי 2025</span>
              </>
            )}
          />

          <PremiumCard className="gb-teacher-attendance-summary" size="lg">
            <DashboardGrid columns={4} className="gb-teacher-attendance-stats">
              <MetricCard label="סה״כ ילדים" value={totalChildren} hint="בגן היום" icon={UsersRound} tone="primary" />
              <MetricCard label="נוכחים" value={present} hint="ילדים" icon={CheckCircle2} tone="success" />
              <MetricCard label="נעדרים" value={absent} hint="דורש בדיקה" icon={XCircle} tone="danger" />
              <MetricCard label="מאחרים" value={late} hint="מעקב הגעה" icon={Clock3} tone="warning" />
            </DashboardGrid>
          </PremiumCard>

          <PremiumCard className="gb-teacher-attendance-board" size="lg">
            <SectionHeader
              title="רשימת נוכחות"
              subtitle="סימון כניסה, יציאה ואיסוף ילדים"
              icon={ClipboardCheck}
              action={<Link href="/dashboard/garden/attendance?filter=missing">טרם סומנו</Link>}
            />

            <SearchFilterBar
              className="gb-teacher-attendance-filters"
              search={<FormField label="חיפוש ילד/ה" icon={Search} placeholder="חיפוש לפי שם ילד או הורה" />}
              filters={(
                <>
                  <FormField label="סטטוס" as="select" icon={Filter} defaultValue={params.filter ?? "all"}>
                    <option value="all">כל הסטטוסים</option>
                    <option value="missing">טרם סומנו</option>
                    <option value="present">נוכחים</option>
                  </FormField>
                  <FormField label="קבוצה" as="select" icon={UsersRound} defaultValue="all">
                    <option value="all">כל הקבוצות</option>
                    <option value="flowers">קבוצת פרחים</option>
                    <option value="purple">קבוצת סגול</option>
                  </FormField>
                </>
              )}
            />

            <div className="gb-teacher-attendance-list">
              {displayRows.length ? displayRows.map((row) => {
                const meta = statusMeta[row.status];
                const StatusIcon = meta.icon;
                return (
                  <ListRowCard
                    key={row.id}
                    className="gb-teacher-attendance-row"
                    avatar={<span className="gb-teacher-child-avatar">{row.avatar}</span>}
                    title={row.childName}
                    subtitle={row.group}
                    meta={`שעת הגעה: ${row.arrival} · איסוף: ${row.pickup}`}
                    status={<StatusChip tone={meta.tone} icon={StatusIcon}>{meta.label}</StatusChip>}
                    actions={(
                      <div className="gb-teacher-row-actions">
                        <Link href="/dashboard/garden/attendance" className="gb-teacher-row-action">
                          {row.status === "present" ? <LogOut size={18} /> : <LogIn size={18} />}
                          {row.status === "present" ? "צ׳ק אאוט" : "צ׳ק אין"}
                        </Link>
                        <button type="button" aria-label="פעולות נוספות"><MoreHorizontal size={20} /></button>
                      </div>
                    )}
                  />
                );
              }) : (
                <EmptyState
                  icon={UsersRound}
                  title={params.filter === "missing" ? "אין ילדים שממתינים לסימון" : "אין ילדים להצגה"}
                  text={children.length ? "אין תוצאות בסינון הנוכחי. אפשר לשנות סינון או לחזור לכל הילדים." : "עדיין לא נמצאו ילדים פעילים בגן. לאחר הוספת ילדים, הנוכחות היומית תופיע כאן."}
                  action={<Link className="gb-teacher-row-action" href="/dashboard/garden/children">ניהול ילדים</Link>}
                />
              )}
            </div>
          </PremiumCard>

          <PremiumCard className="gb-teacher-attendance-actions-card" size="lg">
            <SectionHeader title="פעולות מהירות" icon={ClipboardCheck} />
            <DashboardGrid columns={3} className="gb-teacher-attendance-actions">
              <ActionCard title="שליחת הודעה להורים" text="עדכון מהיר למשפחות" icon={Send} href="/dashboard/garden/messages" tone="primary" />
              <Link className="gb-teacher-count-action" href="/dashboard/garden/attendance">
                <ClipboardCheck size={42} />
                <b>ספירת נוכחות</b>
                <small>{presentPct}% עודכנו</small>
              </Link>
              <ActionCard title="דוח נוכחות יומי" text="ייצוא וסיכום היום" icon={BarChart3} href="/dashboard/garden/reports" tone="info" />
            </DashboardGrid>
          </PremiumCard>

          <BottomNav
            className="gb-teacher-module-bottom-nav"
            activeHref="/dashboard/garden/attendance"
            items={[
              { href: "/dashboard/garden", label: "בית", icon: Home },
              { href: "/dashboard/garden/daily-journal", label: "יומן", icon: CalendarDays },
              { href: "/dashboard/garden/attendance", label: "דשבורד", icon: Home },
              { href: "/dashboard/garden/notifications", label: "התראות", icon: Bell, badge: "2" },
              { href: "/dashboard/garden/command-center", label: "עוד", icon: MoreHorizontal }
            ]}
          />
        </section>
      </ResponsivePage>
    </DashboardShell>
  );
}
