import { DashboardShell } from "@/components/dashboard-shell";
import { TaskWorkbench } from "@/components/task-workbench";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function InspectorTasksPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const gardensRes = await supabase.from("gardens" as any).select("id").eq("inspector_id", profile.id);
  const gardenIds = (gardensRes.data ?? []).map((garden: any) => garden.id);
  const { data } = await supabase.from("tasks" as any).select("*").or(`assigned_to.eq.${profile.id},assigned_role.eq.inspector`).order("created_at", { ascending: false }).limit(120);
  const scopedTasks = ((data ?? []) as any[]).filter((task) => task.assigned_to === profile.id || !task.garden_id || gardenIds.includes(task.garden_id));
  return <DashboardShell role="inspector" title="משימות פקח"><div className="dashboard-hero-card"><div><p className="eyebrow">Inspector Tasks</p><h1>משימות פיקוח, תלונות וליקויים.</h1><p>משימות שהוקצו לפקח או לכלל הפקחים בגנים המשויכים בלבד.</p></div><span className="pill good">מעקב</span></div><TaskWorkbench tasks={scopedTasks} /></DashboardShell>;
}
