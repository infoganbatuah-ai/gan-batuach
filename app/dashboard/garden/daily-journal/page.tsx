import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
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

type JournalTask = { id: string; title?: string | null; category?: string | null; description?: string | null; required?: boolean | null };
type JournalCompletion = { operational_task_id?: string | null };
type JournalProps = Parameters<typeof DailyTaskJournal>[0];
async function journalQuery(label: string, query: () => PromiseLike<{ data: unknown; error: unknown }>) {
  try {
    const result = await query();
    logSupabaseError(label, result.error);
    return result.error ? { data: null, error: true } : { data: result.data, error: false };
  } catch {
    logSupabaseError(label, true);
    return { data: null, error: true };
  }
}

export default async function GardenDailyJournalPage({ searchParams }: { searchParams?: Promise<{ workbench?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = searchParams ? await searchParams : {};
  if (!profile.garden_id) {
    return <DashboardShell role={profile.role} title="יומן תפעול" appHome><AdminDataError message="לא ניתן לטעון יומן ללא שיוך לגן" /></DashboardShell>;
  }
  const today = israelTodayDateKey();
  const result = await safeAdminData("garden daily journal", async () => {
    const supabase = await createClient();
    const [tasksRes, completionsRes] = await Promise.all([
      journalQuery("garden daily journal tasks", () => supabase.from("daily_operational_tasks" as any).select("*").eq("active", true).or(`garden_id.is.null,garden_id.eq.${profile.garden_id}`)),
      journalQuery("garden daily journal completions", () => supabase.from("daily_task_completions" as any).select("*").eq("completed_for_date", today).eq("garden_id", profile.garden_id ?? ""))
    ]);
    const available = [!tasksRes.error, !completionsRes.error];
    return { tasks: (tasksRes.data ?? []) as JournalTask[], completions: (completionsRes.data ?? []) as JournalCompletion[], available, queryError: available.some((value) => !value) ? "חלק מנתוני היומן לא נטענו" : null };
  }, { tasks: [] as JournalTask[], completions: [] as JournalCompletion[], available: [false, false], queryError: null as string | null });
  const { tasks, completions, available } = result.data;
  const bothAvailable = available[0] && available[1];
  const completionPercent = bothAvailable ? tasks.length ? Math.round((completions.length / tasks.length) * 100) : 0 : null;
  const completionIds = new Set(completions.map((item) => item.operational_task_id));
  const orderedTasks = [...tasks].sort((a, b) => {
    const categoryA = String(a.category ?? "");
    const categoryB = String(b.category ?? "");
    return categoryA.localeCompare(categoryB, "he") || String(a.title ?? "").localeCompare(String(b.title ?? ""), "he");
  });
  return (
    <DashboardShell role={profile.role} title="יומן תפעול" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="לוח יום פעילות גננת" avatarUrl={(profile as any).profile_image_url ?? null} active="calendar">
        <TeacherPageTitle icon={CalendarDays} title="לוח יום פעילות" subtitle="משימות, סדר יום ועדכוני גן" />
        <AdminDataError message={result.error ?? result.data.queryError} />
        <TeacherStatsGrid>
          <TeacherStatCard title="משימות היום" value={available[0] ? tasks.length : "לא זמין"} hint="לביצוע" icon={ClipboardCheck} tone={available[0] ? "blue" : "neutral"} />
          <TeacherStatCard title="הושלמו" value={available[1] ? completions.length : "לא זמין"} hint={completionPercent === null ? "אחוז ההשלמה לא זמין" : `${completionPercent}%`} icon={CheckCircle2} tone={available[1] ? "green" : "neutral"} />
          <TeacherStatCard title="נותרו" value={bothAvailable ? Math.max(0, tasks.length - completions.length) : "לא זמין"} hint="מעקב" icon={Clock} tone={!bothAvailable ? "neutral" : tasks.length - completions.length ? "orange" : "green"} />
          <TeacherStatCard title="שעה נוכחית" value={new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} hint="שעת התצוגה" icon={CalendarDays} tone="purple" />
        </TeacherStatsGrid>
        <TeacherSection title="סדר יום" subtitle="מבוסס על המשימות שהוגדרו לגן">
          {!available[0] ? <TeacherEmptyState title="סדר היום לא זמין" text="לא ניתן לטעון את המשימות כרגע." /> : orderedTasks.length ? (
            <TeacherCompactList>
              {orderedTasks.slice(0, 7).map((task) => {
                const completed = completionIds.has(task.id);
                return (
                  <TeacherCompactItem
                    key={task.id}
                    title={task.title ?? "משימה"}
                    subtitle={task.description ?? task.category ?? "משימת תפעול"}
                    tone={!available[1] ? "neutral" : completed ? "green" : task.required ? "orange" : "blue"}
                    meta={!available[1] ? "סטטוס לא זמין" : completed ? "הושלם" : task.required ? "חובה" : "רשות"}
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
          {bothAvailable ? <DailyTaskJournal tasks={tasks as JournalProps["tasks"]} completions={completions as JournalProps["completions"]} gardenId={profile.garden_id} /> : <TeacherEmptyState title="היומן המלא לא זמין" text="נדרשים נתוני משימות והשלמות מלאים לפני ניהול ועדכון." />}
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
