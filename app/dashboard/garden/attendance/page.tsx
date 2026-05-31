import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { ModuleListPage } from "@/components/module-list-page";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
  return <DashboardShell role="manager" title="נוכחות"><DashboardFilterChip label={params.filter === "missing" ? "ילדים שלא הגיעו / לא סומנו" : null} clearHref="/dashboard/garden/attendance" isEmpty={rows.length === 0} emptyTitle="אין כרגע ילדים ללא סימון נוכחות" emptyText="כל הילדים הפעילים קיבלו סימון נוכחות היום." /><ModuleListPage title="נוכחות ילדים וצוות" eyebrow="Attendance" description="סטטוס יומי, איחורים, יציאות מוקדמות, איסוף ולוג שינוי." rows={rows} emptyTitle={params.filter === "missing" ? "אין כרגע ילדים ללא סימון נוכחות" : "אין נוכחות להיום"} emptyText={params.filter === "missing" ? "כל הילדים הפעילים כבר סומנו היום." : "סמנו נוכחות לילדים וצוות. כל שינוי נשמר עם מי עדכן ומתי."} /></DashboardShell>;
}
