import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { ModuleListPage } from "@/components/module-list-page";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CalendarDays, CheckCircle2, Clock, LogIn, LogOut, UserX } from "lucide-react";
import {
  TeacherActionTile,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherFilterPills,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

export default async function GardenAttendancePage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [attendanceRes, childrenRes] = await Promise.all([
    supabase.from("attendance" as any).select("id, child_id, status, attendance_date, check_in_at, check_out_at, pickup_name, children(full_name), staff(full_name)").eq("garden_id", profile.garden_id ?? "").gte("attendance_date", today).order("created_at", { ascending: false }),
    supabase.from("children" as any).select("id, full_name").eq("garden_id", profile.garden_id ?? "").in("status", ["active", "approved"]).order("full_name")
  ]);
  const presentAttendance = (attendanceRes.data ?? []) as any[];
  const markedChildIds = new Set(presentAttendance.map((row) => row.child_id).filter(Boolean));
  const missingChildren = ((childrenRes.data ?? []) as any[]).filter((child) => !markedChildIds.has(child.id));
  const rows = params.filter === "missing"
    ? missingChildren.map((child) => ({ id: child.id, title: child.full_name, status: "not_updated", description: "עדיין לא סומן/ה היום" }))
    : presentAttendance.map((row: any) => ({ ...row, title: row.children?.full_name ?? row.staff?.full_name ?? "נוכחות", description: `${row.status} · כניסה ${row.check_in_at ?? "-"} · יציאה ${row.check_out_at ?? "-"}` }));
  const present = presentAttendance.filter((row) => row.status === "present" || row.status === "checked_in").length;
  const checkedOut = presentAttendance.filter((row) => row.status === "checked_out" || row.check_out_at).length;
  const late = presentAttendance.filter((row) => row.status === "late").length;

  return (
    <DashboardShell role="manager" title="נוכחות" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "מאיה"}`} subtitle="ניהול נוכחות יומי" avatarUrl={(profile as any).avatar_url ?? null} active="calendar">
        <TeacherPageTitle icon={CalendarDays} title="נוכחות גננת" subtitle="כניסה, יציאה ואיסוף ילדים במסך אחד" />
        <TeacherStatsGrid>
          <TeacherStatCard title="נוכחים" value={present} hint="היום" icon={CheckCircle2} tone="green" />
          <TeacherStatCard title="טרם סומנו" value={missingChildren.length} hint="דורש סימון" icon={UserX} tone={missingChildren.length ? "orange" : "green"} href="/dashboard/garden/attendance?filter=missing" />
          <TeacherStatCard title="צ׳ק-אאוט" value={checkedOut} hint="יצאו היום" icon={LogOut} tone="blue" />
          <TeacherStatCard title="איחורים" value={late} hint="מעקב" icon={Clock} tone={late ? "red" : "green"} />
        </TeacherStatsGrid>

        <TeacherFilterPills
          items={[
            { label: "היום", href: "/dashboard/garden/attendance", active: !params.filter },
            { label: "לא סומנו", href: "/dashboard/garden/attendance?filter=missing", active: params.filter === "missing" },
            { label: "כניסה", href: "/dashboard/garden/attendance" },
            { label: "יציאה", href: "/dashboard/garden/attendance" }
          ]}
        />
        <DashboardFilterChip label={params.filter === "missing" ? "ילדים שלא הגיעו / לא סומנו" : null} clearHref="/dashboard/garden/attendance" isEmpty={rows.length === 0} emptyTitle="אין כרגע ילדים ללא סימון נוכחות" emptyText="כל הילדים הפעילים קיבלו סימון נוכחות היום." />

        <section className="teacher-dashboard-grid">
          <TeacherSection title="סימוני נוכחות" action={<a href="/dashboard/garden/attendance?filter=missing">לא סומנו</a>}>
            {rows.length ? (
              <TeacherCompactList>
                {rows.slice(0, 8).map((row: any) => (
                  <TeacherCompactItem
                    key={row.id}
                    title={row.title}
                    subtitle={row.description}
                    tone={row.status === "not_updated" ? "orange" : row.status === "late" ? "red" : "green"}
                    meta={row.status === "not_updated" ? "חסר" : "סומן"}
                  />
                ))}
              </TeacherCompactList>
            ) : (
              <TeacherEmptyState title={params.filter === "missing" ? "אין ילדים ללא סימון" : "אין נוכחות להיום"} text={params.filter === "missing" ? "כל הילדים הפעילים כבר סומנו היום." : "סמנו נוכחות לילדים וצוות. כל שינוי נשמר עם מי עדכן ומתי."} />
            )}
          </TeacherSection>

          <TeacherSection title="זרימת היום" subtitle="מבוסס על מסך לוח היום">
            <TeacherCompactList>
              <TeacherCompactItem title="קבלת ילדים" subtitle="08:00" tone="green" meta="פעיל" />
              <TeacherCompactItem title="ארוחת בוקר" subtitle="09:00" tone="orange" meta="הבא" />
              <TeacherCompactItem title="פעילות יצירה" subtitle="10:30" tone="purple" meta="מתוכנן" />
              <TeacherCompactItem title="איסוף צהריים" subtitle="13:00" tone="blue" meta="מעקב" />
            </TeacherCompactList>
          </TeacherSection>

          <TeacherSection title="פעולה מהירה">
            <TeacherQuickActions title="סימון">
              <TeacherActionTile title="סמן כניסה" href="/dashboard/garden/attendance" icon={LogIn} tone="green" />
              <TeacherActionTile title="סמן יציאה" href="/dashboard/garden/attendance" icon={LogOut} tone="blue" />
            </TeacherQuickActions>
          </TeacherSection>
        </section>

        <details className="teacher-management-details">
          <summary>ניהול מלא</summary>
          <ModuleListPage title="נוכחות ילדים וצוות" eyebrow="Attendance" description="סטטוס יומי, איחורים, יציאות מוקדמות, איסוף ולוג שינוי." rows={rows} emptyTitle={params.filter === "missing" ? "אין כרגע ילדים ללא סימון נוכחות" : "אין נוכחות להיום"} emptyText={params.filter === "missing" ? "כל הילדים הפעילים כבר סומנו היום." : "סמנו נוכחות לילדים וצוות. כל שינוי נשמר עם מי עדכן ומתי."} />
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
