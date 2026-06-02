import { DashboardShell } from "@/components/dashboard-shell";
import { DailyTaskJournal } from "@/components/daily-task-journal";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffDailyJournalPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [tasksRes, completionsRes] = await Promise.all([
    supabase.from("daily_operational_tasks" as any).select("*").eq("active", true).contains("role_scope", ["staff"]),
    supabase.from("daily_task_completions" as any).select("*").eq("completed_for_date", today).eq("completed_by", profile.id)
  ]);
  return <DashboardShell role="staff" title="יומן צוות"><div className="dashboard-hero-card"><div><p className="eyebrow">Staff Journal</p><h1>משימות תפעול לצוות.</h1><p>סימון משימות, היסטוריה והתקדמות יומית.</p></div><span className="pill good">צוות</span></div><DailyTaskJournal tasks={(tasksRes.data ?? []) as any[]} completions={(completionsRes.data ?? []) as any[]} gardenId={profile.garden_id} /></DashboardShell>;
}
