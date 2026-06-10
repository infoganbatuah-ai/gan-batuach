import { DashboardShell } from "@/components/dashboard-shell";
import { TaskWorkbench } from "@/components/task-workbench";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffTasksPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const { data } = await supabase.from("tasks" as any).select("*").eq("garden_id", profile.garden_id ?? "").or(`assigned_to.eq.${profile.id},assigned_role.eq.staff`).order("created_at", { ascending: false }).limit(120);
  const rows = (data ?? []) as any[];
  const overdue = rows.filter((task) => task.due_at && new Date(task.due_at).getTime() < Date.now()).length;
  const done = rows.filter((task) => task.status === "done" || task.status === "completed").length;
  return <DashboardShell role="staff" title="משימות צוות"><div className="parent-page-head staff-page-head"><div><p className="eyebrow">המשימות שלי</p><h1>מה נשאר למשמרת?</h1><p>משימות להיום, משימות באיחור ומה שכבר הושלם.</p></div><span className={overdue ? "pill bad" : "pill good"}>{overdue ? `${overdue} באיחור` : "אין איחורים"}</span></div><section className="staff-task-summary"><span>פתוחות <b>{rows.length - done}</b></span><span>באיחור <b>{overdue}</b></span><span>הושלמו <b>{done}</b></span></section><TaskWorkbench tasks={rows} /></DashboardShell>;
}
