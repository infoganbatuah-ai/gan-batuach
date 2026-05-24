import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { AdminTaskEngine } from "@/components/admin-task-engine";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function AdminListPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("משימות", async () => {
    const supabase = await createClient();
    const [tasksRes, usersRes, gardensRes] = await Promise.all([
      supabase.from("tasks" as any).select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles" as any).select("id, full_name, role, garden_id, active").eq("active", true).limit(300),
      supabase.from("gardens" as any).select("id, name, city").order("name")
    ]);
    logSupabaseError("משימות", tasksRes.error ?? usersRes.error ?? gardensRes.error);
    return { tasks: (tasksRes.data ?? []) as any[], users: (usersRes.data ?? []) as any[], gardens: (gardensRes.data ?? []) as any[], queryError: tasksRes.error || usersRes.error || gardensRes.error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { tasks: [] as any[], users: [] as any[], gardens: [] as any[], queryError: null as string | null });
  return <DashboardShell role="admin" title="משימות"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Task Engine</p><h1>יצירת משימות ומעקב ביצוע.</h1><p>משימות חד פעמיות או חוזרות, לפי משתמש, גן, תפקיד או קבוצה, עם עדיפות ודדליין.</p></div><span className="pill good">Production UI</span></div><AdminDataError message={result.error ?? result.data.queryError} /><AdminTaskEngine tasks={result.data.tasks} users={result.data.users} gardens={result.data.gardens} /></DashboardShell>;
}
