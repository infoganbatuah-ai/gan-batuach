import { DashboardShell } from "@/components/dashboard-shell";
import { TaskWorkbench } from "@/components/task-workbench";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffTasksPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const { data } = await supabase.from("tasks" as any).select("*").eq("garden_id", profile.garden_id ?? "").or(`assigned_to.eq.${profile.id},assigned_role.eq.staff`).order("created_at", { ascending: false }).limit(120);
  return <DashboardShell role="staff" title="משימות צוות"><div className="dashboard-hero-card staff-hero-card"><div><p className="eyebrow">Staff Tasks</p><h1>משימות שהוקצו לאיש צוות.</h1><p>צפייה, ביצוע, דחייה עם סיבה והוכחת השלמה.</p></div><span className="pill good">מחובר למשימות</span></div><TaskWorkbench tasks={(data ?? []) as any[]} /></DashboardShell>;
}
