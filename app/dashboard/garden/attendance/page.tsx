import { DashboardShell } from "@/components/dashboard-shell";
import { ModuleListPage } from "@/components/module-list-page";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenAttendancePage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from("attendance" as any).select("id, status, attendance_date, check_in_at, check_out_at, pickup_name, children(full_name), staff(full_name)").eq("garden_id", profile.garden_id ?? "").gte("attendance_date", today).order("created_at", { ascending: false });
  const rows = (data ?? []).map((row: any) => ({ ...row, title: row.children?.full_name ?? row.staff?.full_name ?? "נוכחות", description: `${row.status} · כניסה ${row.check_in_at ?? "-"} · יציאה ${row.check_out_at ?? "-"}` }));
  return <DashboardShell role="manager" title="נוכחות"><ModuleListPage title="נוכחות ילדים וצוות" eyebrow="Attendance" description="סטטוס יומי, איחורים, יציאות מוקדמות, איסוף ולוג שינוי." rows={rows} emptyTitle="אין נוכחות להיום" emptyText="סמנו נוכחות לילדים וצוות. כל שינוי נשמר עם מי עדכן ומתי." /></DashboardShell>;
}
