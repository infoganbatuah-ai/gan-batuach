import { DashboardShell } from "@/components/dashboard-shell";
import { israelTodayDateKey } from "@/lib/domain/israel-date";
import { DailyTaskJournal } from "@/components/daily-task-journal";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CalendarDays, CheckCircle2, ClipboardCheck, Clock } from "lucide-react";
import {
  TeacherActionTile,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

export default async function GardenDailyJournalPage({ searchParams }: { searchParams?: Promise<{ workbench?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = searchParams ? await searchParams : {};
  const supabase = await createClient();
  const today = israelTodayDateKey();
  const [tasksRes, completionsRes] = await Promise.all([
    supabase.from("daily_operational_tasks" as any).select("*").eq("active", true).or(`garden_id.is.null,garden_id.eq.${profile.garden_id}`),
    supabase.from("daily_task_completions" as any).select("*").eq("completed_for_date", today).eq("garden_id", profile.garden_id ?? "")
  ]);
  const tasks = (tasksRes.data ?? []) as any[];
  const completions = (completionsRes.data ?? []) as any[];
  const completionPercent = tasks.length ? Math.round((completions.length / tasks.length) * 100) : 0;
  const completionIds = new Set(completions.map((item: any) => item.operational_task_id));
  const orderedTasks = [...tasks].sort((a: any, b: any) => {
    const categoryA = String(a.category ?? "");
    const categoryB = String(b.category ?? "");
    return categoryA.localeCompare(categoryB, "he") || String(a.title ?? "").localeCompare(String(b.title ?? ""), "he");
  });
  return (
    <DashboardShell role={profile.role} title="יומן תפעול" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="לוח יום פעילות גננת" avatarUrl={(profile as any).profile_image_url ?? null} active="calendar">
        <TeacherPageTitle icon={CalendarDays} title="לוח יום פעילות" subtitle="משימות, סדר יום ועדכוני גן" />
        <TeacherStatsGrid>
          <TeacherStatCard title="משימות היום" value={tasks.length} hint="לביצוע" icon={ClipboardCheck} tone="blue" />
          <TeacherStatCard title="הושלמו" value={completions.length} hint={`${completionPercent}%`} icon={CheckCircle2} tone="green" />
          <TeacherStatCard title="נותרו" value={Math.max(0, tasks.length - completions.length)} hint="מעקב" icon={Clock} tone={tasks.length - completions.length ? "orange" : "green"} />
          <TeacherStatCard title="שעה נוכחית" value={new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} hint="גן פעיל" icon={CalendarDays} tone="purple" />
        </TeacherStatsGrid>
        <TeacherSection title="סדר יום" subtitle="מבוסס על המשימות שהוגדרו לגן">
          {orderedTasks.length ? (
            <TeacherCompactList>
              {orderedTasks.slice(0, 7).map((task: any) => {
                const completed = completionIds.has(task.id);
                return (
                  <TeacherCompactItem
                    key={task.id}
                    title={task.title ?? "משימה"}
                    subtitle={task.description ?? task.category ?? "משימת תפעול"}
                    tone={completed ? "green" : task.required ? "orange" : "blue"}
                    meta={completed ? "הושלם" : task.required ? "חובה" : "רשות"}
                  />
                );
              })}
            </TeacherCompactList>
          ) : (
            <TeacherEmptyState
              title="עדיין לא הוגדר סדר יום"
              text="כשתוגדרנה משימות תפעול או פעילויות לגן, הן יוצגו כאן במקום נתוני דוגמה."
            />
          )}
        </TeacherSection>
        <TeacherQuickActions title="פעולות היום">
          <TeacherActionTile title="עדכון פעילות" href="/dashboard/garden/daily-journal?workbench=1#daily-journal-workbench" icon={ClipboardCheck} tone="purple" />
          <TeacherActionTile title="נוכחות" href="/dashboard/garden/attendance" icon={CheckCircle2} tone="green" />
        </TeacherQuickActions>
        <details id="daily-journal-workbench" className="teacher-management-details" open={params.workbench === "1"}>
          <summary>צ׳קליסט מלא</summary>
          <DailyTaskJournal tasks={tasks} completions={completions} gardenId={profile.garden_id} />
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
