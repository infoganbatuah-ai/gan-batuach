import { DashboardShell } from "@/components/dashboard-shell";
import { DailyTaskJournal } from "@/components/daily-task-journal";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CalendarDays, CheckCircle2, ClipboardCheck, Clock } from "lucide-react";
import {
  TeacherActionTile,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

export default async function GardenDailyJournalPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [tasksRes, completionsRes] = await Promise.all([
    supabase.from("daily_operational_tasks" as any).select("*").eq("active", true).or(`garden_id.is.null,garden_id.eq.${profile.garden_id}`),
    supabase.from("daily_task_completions" as any).select("*").eq("completed_for_date", today).eq("garden_id", profile.garden_id ?? "")
  ]);
  const tasks = (tasksRes.data ?? []) as any[];
  const completions = (completionsRes.data ?? []) as any[];
  const completionPercent = tasks.length ? Math.round((completions.length / tasks.length) * 100) : 0;
  return (
    <DashboardShell role={profile.role} title="יומן תפעול" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.split(" ")[0] ?? "מאיה"}`} subtitle="לוח יום פעילות גננת" avatarUrl={(profile as any).avatar_url ?? null} active="calendar">
        <TeacherPageTitle icon={CalendarDays} title="לוח יום פעילות" subtitle="משימות, סדר יום ועדכוני גן" />
        <TeacherStatsGrid>
          <TeacherStatCard title="משימות היום" value={tasks.length} hint="לביצוע" icon={ClipboardCheck} tone="blue" />
          <TeacherStatCard title="הושלמו" value={completions.length} hint={`${completionPercent}%`} icon={CheckCircle2} tone="green" />
          <TeacherStatCard title="נותרו" value={Math.max(0, tasks.length - completions.length)} hint="מעקב" icon={Clock} tone={tasks.length - completions.length ? "orange" : "green"} />
          <TeacherStatCard title="שעה נוכחית" value={new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} hint="גן פעיל" icon={CalendarDays} tone="purple" />
        </TeacherStatsGrid>
        <TeacherSection title="סדר יום">
          <TeacherCompactList>
            {[
              ["08:00", "קבלת ילדים", "green"],
              ["09:00", "ארוחת בוקר", "orange"],
              ["10:00", "פעילות למידה", "purple"],
              ["11:30", "חצר ומשחק חופשי", "green"],
              ["12:15", "ארוחת צהריים", "orange"],
              ["13:00", "שעת סיפור", "blue"]
            ].map(([time, title, tone]) => <TeacherCompactItem key={time} title={title} subtitle={time} tone={tone as any} meta="•" />)}
          </TeacherCompactList>
        </TeacherSection>
        <TeacherQuickActions title="פעולות היום">
          <TeacherActionTile title="עדכון פעילות" href="/dashboard/garden/daily-journal" icon={ClipboardCheck} tone="purple" />
          <TeacherActionTile title="נוכחות" href="/dashboard/garden/attendance" icon={CheckCircle2} tone="green" />
        </TeacherQuickActions>
        <details className="teacher-management-details">
          <summary>צ׳קליסט מלא</summary>
          <DailyTaskJournal tasks={tasks} completions={completions} gardenId={profile.garden_id} />
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
