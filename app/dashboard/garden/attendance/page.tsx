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
  MessageCircle,
  MoreHorizontal,
  Search,
  Send,
  UserRoundCheck,
  UsersRound,
  XCircle
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  ActionCard,
  BottomNav,
  FormField,
  PremiumCard,
  ResponsivePage,
  SearchFilterBar,
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

const fallbackRows: AttendanceRow[] = [
  { id: "demo-1", childName: "אורי לוי", group: "קבוצת פרחים", status: "present", arrival: "07:45", pickup: "מאיה לוי", avatar: "א" },
  { id: "demo-2", childName: "יעל כהן", group: "קבוצת פרחים", status: "late", arrival: "08:22", pickup: "רונית כהן", avatar: "י" },
  { id: "demo-3", childName: "נועה שחר", group: "קבוצת סגול", status: "present", arrival: "07:58", pickup: "דניאל שחר", avatar: "נ" },
  { id: "demo-4", childName: "איתן ברק", group: "קבוצת סגול", status: "absent", arrival: "-", pickup: "לא נקבע", avatar: "א" },
  { id: "demo-5", childName: "מיקה רוזן", group: "קבוצת פרחים", status: "present", arrival: "08:05", pickup: "ליאת רוזן", avatar: "מ" }
];

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
  const markedChildIds = new Set(attendance.map((row) => row.child_id).filter(Boolean));
  const missingChildren = children.filter((child) => !markedChildIds.has(child.id));
  const realRows: AttendanceRow[] = params.filter === "missing"
    ? missingChildren.map((child, index) => ({
        id: child.id,
        childName: child.full_name ?? "ילד/ה",
        group: "טרם סומן/ה היום",
        status: "not_updated",
        arrival: "-",
        pickup: "טרם נקבע",
        avatar: (child.full_name ?? "י").slice(0, 1) || `${index + 1}`
      }))
    : attendance.map((row, index) => {
        const rawStatus = String(row.status ?? "");
        const status: AttendanceRow["status"] = rawStatus === "late"
          ? "late"
          : rawStatus === "absent"
            ? "absent"
            : rawStatus === "checked_out" || rawStatus === "present" || rawStatus === "checked_in"
              ? "present"
              : "not_updated";
        const name = row.children?.full_name ?? row.staff?.full_name ?? "נוכחות";
        return {
          id: row.id ?? `row-${index}`,
          childName: name,
          group: status === "present" ? "נוכחות עודכנה" : "דורש מעקב",
          status,
          arrival: toDisplayTime(row.check_in_at),
          pickup: row.pickup_name ?? "לא נקבע",
          avatar: name.slice(0, 1) || `${index + 1}`
        };
      });

  const displayRows = realRows.length ? realRows : fallbackRows;
  const totalChildren = children.length || 24;
  const present = realRows.length ? realRows.filter((row) => row.status === "present").length : 19;
  const absent = realRows.length ? realRows.filter((row) => row.status === "absent" || row.status === "not_updated").length : 3;
  const late = realRows.length ? realRows.filter((row) => row.status === "late").length : 2;
  const presentPct = Math.min(100, Math.round((present / Math.max(totalChildren, 1)) * 100));
  const cleanProfileName = cleanDemoText(profile.full_name, "רונית");
  const teacherFirstName = cleanProfileName.split(" ").filter(Boolean)[0] || "רונית";
  const gardenName = cleanDemoText((gardenRes.data as any)?.name, "גן הפרחים") || "גן הפרחים";
  const avatarUrl = typeof (profile as any).avatar_url === "string" && (profile as any).avatar_url.trim()
    ? (profile as any).avatar_url
    : "/assets/teacher-avatar.svg";

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="נוכחות וצ׳ק אין" appHome>
      <ResponsivePage className="gb-teacher-module-page gb-teacher-attendance-page" size="lg">
        <section className="gb-teacher-app-surface" dir="rtl">
          <header className="gb-teacher-module-header">
            <div className="gb-teacher-module-brand" aria-label="גן בטוח">
              <Image src="/assets/company-name.png" alt="גן בטוח" width={262} height={84} priority />
              <Image src="/assets/company-symbol.png" alt="" width={70} height={70} priority />
            </div>

            <div className="gb-teacher-module-profile">
              <Link className="gb-teacher-round-button" href="/dashboard/garden/notifications" aria-label="התראות">
                <Bell size={26} />
                <i />
              </Link>
              <Link className="gb-teacher-avatar" href="/dashboard/profile" aria-label="פרופיל">
                <img src={avatarUrl} alt="" />
                <i />
              </Link>
              <ChevronDown size={24} />
            </div>

            <div className="gb-teacher-module-greeting">
              <h1>נוכחות וצ׳ק אין <UsersRound size={34} /></h1>
              <p>ניהול נוכחות הילדים ב{gardenName} · בוקר טוב, {teacherFirstName}</p>
            </div>

            <div className="gb-teacher-date-pill">
              <CalendarDays size={26} />
              <span>יום ראשון, כ״ה אייר תשפ״ה<br />25 במאי 2025</span>
            </div>
          </header>

          <PremiumCard className="gb-teacher-attendance-stats" size="lg">
            <div>
              <span className="gb-teacher-stat-icon success"><CheckCircle2 size={30} /></span>
              <b>{present}</b>
              <strong>נוכחים</strong>
              <small>ילדים</small>
            </div>
            <div>
              <span className="gb-teacher-stat-icon danger"><XCircle size={30} /></span>
              <b>{absent}</b>
              <strong>נעדרים</strong>
              <small>דורש בדיקה</small>
            </div>
            <div>
              <span className="gb-teacher-stat-icon warning"><Clock3 size={30} /></span>
              <b>{late}</b>
              <strong>מאחרים</strong>
              <small>מעקב הגעה</small>
            </div>
            <div>
              <span className="gb-teacher-stat-icon primary"><UsersRound size={30} /></span>
              <b>{totalChildren}</b>
              <strong>סה״כ ילדים</strong>
              <small>בגן היום</small>
            </div>
          </PremiumCard>

          <PremiumCard className="gb-teacher-attendance-board" size="lg">
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

            <div className="gb-teacher-attendance-table-head" aria-hidden="true">
              <span>ילד/ה</span>
              <span>סטטוס</span>
              <span>שעת הגעה</span>
              <span>איסוף ע״י</span>
              <span>פעולה</span>
            </div>

            <div className="gb-teacher-attendance-list">
              {displayRows.map((row) => {
                const meta = statusMeta[row.status];
                const StatusIcon = meta.icon;
                return (
                  <article className="gb-teacher-attendance-row" key={row.id}>
                    <div className="gb-teacher-child-cell">
                      <span className="gb-teacher-child-avatar">{row.avatar}</span>
                      <div>
                        <b>{row.childName}</b>
                        <small>{row.group}</small>
                      </div>
                    </div>
                    <StatusChip tone={meta.tone} icon={StatusIcon}>{meta.label}</StatusChip>
                    <time>{row.arrival}</time>
                    <strong>{row.pickup}</strong>
                    <div className="gb-teacher-row-actions">
                      <Link href="/dashboard/garden/attendance" className="gb-teacher-row-action">
                        {row.status === "present" ? <LogOut size={18} /> : <LogIn size={18} />}
                        {row.status === "present" ? "צ׳ק אאוט" : "צ׳ק אין"}
                      </Link>
                      <button type="button" aria-label="פעולות נוספות"><MoreHorizontal size={20} /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          </PremiumCard>

          <section className="gb-teacher-attendance-actions">
            <ActionCard title="שליחת הודעה להורים" text="עדכון מהיר למשפחות" icon={Send} href="/dashboard/garden/messages" tone="primary" />
            <Link className="gb-teacher-count-action" href="/dashboard/garden/attendance">
              <ClipboardCheck size={42} />
              <b>ספירת נוכחות</b>
              <small>{presentPct}% עודכנו</small>
            </Link>
            <ActionCard title="דוח נוכחות יומי" text="ייצוא וסיכום היום" icon={BarChart3} href="/dashboard/garden/reports" tone="info" />
          </section>

          <BottomNav
            className="gb-teacher-module-bottom-nav"
            activeHref="/dashboard/garden"
            items={[
              { href: "/dashboard/garden", label: "בית", icon: Home },
              { href: "/dashboard/garden/daily-journal", label: "יומן", icon: CalendarDays },
              { href: "/dashboard/garden", label: "דשבורד", icon: Home },
              { href: "/dashboard/garden/notifications", label: "התראות", icon: Bell, badge: "2" },
              { href: "/dashboard/garden/command-center", label: "עוד", icon: MoreHorizontal }
            ]}
          />
        </section>
      </ResponsivePage>
    </DashboardShell>
  );
}
