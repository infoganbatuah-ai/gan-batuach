import { DashboardShell } from "@/components/dashboard-shell";
import { DailyTaskJournal } from "@/components/daily-task-journal";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GardenDailyJournalPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [tasksRes, completionsRes] = await Promise.all([
    supabase.from("daily_operational_tasks" as any).select("*").eq("active", true).or(`garden_id.is.null,garden_id.eq.${profile.garden_id}`),
    supabase.from("daily_task_completions" as any).select("*").eq("completed_for_date", today).eq("garden_id", profile.garden_id ?? "")
  ]);
  return <DashboardShell role={profile.role} title="יומן תפעול"><div className="dashboard-hero-card"><div><p className="eyebrow">Daily Journal</p><h1>צ׳קליסט תפעול יומי לגן.</h1><p>מעקב ברור אחרי משימות חובה, אחוז השלמה והיסטוריית ביצוע.</p></div><span className="pill good">ניהול גן</span></div><DailyTaskJournal tasks={(tasksRes.data ?? []) as any[]} completions={(completionsRes.data ?? []) as any[]} gardenId={profile.garden_id} /></DashboardShell>;
}
