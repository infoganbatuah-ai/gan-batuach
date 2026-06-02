import { DashboardShell } from "@/components/dashboard-shell";
import { TaskWorkbench } from "@/components/task-workbench";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenTasksPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const { data } = await supabase.from("tasks" as any).select("*").eq("garden_id", profile.garden_id ?? "").order("created_at", { ascending: false }).limit(120);
  return <DashboardShell role="manager" title="משימות"><div className="dashboard-hero-card garden-hero-card"><div><p className="eyebrow">Tasks</p><h1>משימות הגן לביצוע ומעקב.</h1><p>משימות אדמין, פיקוח ותיקון ליקויים עם דדליין, עדיפות והוכחת ביצוע.</p></div><span className="pill good">מעקב ביצוע</span></div><TaskWorkbench tasks={(data ?? []) as any[]} /></DashboardShell>;
}
