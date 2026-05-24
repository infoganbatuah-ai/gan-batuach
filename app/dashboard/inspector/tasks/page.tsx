import { DashboardShell } from "@/components/dashboard-shell";
import { TaskWorkbench } from "@/components/task-workbench";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function InspectorTasksPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const { data } = await supabase.from("tasks" as any).select("*").or(`assigned_to.eq.${profile.id},assigned_role.eq.inspector`).order("created_at", { ascending: false }).limit(120);
  return <DashboardShell role="inspector" title="משימות פקח"><div className="dashboard-hero-card"><div><p className="eyebrow">Inspector Tasks</p><h1>משימות פיקוח, תלונות וליקויים.</h1><p>משימות שהוקצו לפקח או לכלל הפקחים עם דדליין, עדיפות והערות.</p></div><span className="pill good">מעקב</span></div><TaskWorkbench tasks={(data ?? []) as any[]} /></DashboardShell>;
}
