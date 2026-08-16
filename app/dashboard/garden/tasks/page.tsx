import { Bell, CheckCircle2, ClipboardCheck, Clock, ListChecks, Plus, ShieldAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { TaskWorkbench } from "@/components/task-workbench";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  TeacherActionTile,
  TeacherAiInsight,
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

export default async function GardenTasksPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const { data } = await supabase.from("tasks" as any).select("*").eq("garden_id", profile.garden_id ?? "").order("created_at", { ascending: false }).limit(120);
  const tasks = (data ?? []) as any[];
  const open = tasks.filter((task) => !["done", "completed", "closed"].includes(String(task.status)));
  const urgent = tasks.filter((task) => ["high", "urgent", "critical"].includes(String(task.priority)));
  const today = tasks.filter((task) => {
    if (!task.due_at) return false;
    return new Date(task.due_at).toDateString() === new Date().toDateString();
  });

  return (
    <DashboardShell role="manager" title="משימות" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="ניהול משימות הגן" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
        <TeacherPageTitle icon={ClipboardCheck} title="משימות להיום" subtitle="מעקב ביצוע, דדליין ועדיפות במקום אחד" action={<a className="button primary" href="#full-task-workbench"><Plus size={18} /> ניהול מלא</a>} />

        <TeacherStatsGrid>
          <TeacherStatCard title="פתוחות" value={open.length} hint="לטיפול" icon={ListChecks} tone={open.length ? "orange" : "green"} />
          <TeacherStatCard title="להיום" value={today.length} hint="דחוף להיום" icon={Clock} tone={today.length ? "purple" : "blue"} />
          <TeacherStatCard title="עדיפות גבוהה" value={urgent.length} hint="דורש תשומת לב" icon={ShieldAlert} tone={urgent.length ? "red" : "green"} />
          <TeacherStatCard title="הושלמו" value={tasks.length - open.length} hint="נסגרו" icon={CheckCircle2} tone="green" />
        </TeacherStatsGrid>

        <TeacherSection title="משימות פעילות" action={<a href="#full-task-workbench">לניהול המלא ›</a>}>
          {open.length ? (
            <TeacherCompactList>
              {open.slice(0, 6).map((task) => (
                <TeacherCompactItem
                  key={task.id}
                  title={task.title ?? task.action_title ?? "משימה"}
                  subtitle={`${task.due_at ? new Date(task.due_at).toLocaleDateString("he-IL") : "ללא תאריך"} · ${task.priority ?? "עדיפות רגילה"}`}
                  tone={["high", "urgent", "critical"].includes(String(task.priority)) ? "red" : "purple"}
                  meta={task.status ?? "פתוח"}
                />
              ))}
            </TeacherCompactList>
          ) : (
            <TeacherEmptyState title="אין משימות פתוחות" text="כל המשימות החשובות נסגרו. משימות חדשות יופיעו כאן." />
          )}
        </TeacherSection>

        <TeacherAiInsight metric={`${Math.max(0, tasks.length - open.length)}`}>
          המשימות מוצגות לפי עדיפות ותאריך. פעולות רגישות כמו פיקוח, מסמכים או תשלומים נשארות לניהול מלא ומבוקר.
        </TeacherAiInsight>

        <TeacherQuickActions title="פעולות משימות">
          <TeacherActionTile title="התראות" href="/dashboard/garden/notifications" icon={Bell} tone="orange" />
          <TeacherActionTile title="מסמכים" href="/dashboard/garden/documents" icon={ClipboardCheck} tone="purple" />
          <TeacherActionTile title="פיקוחים" href="/dashboard/garden/inspections" icon={ShieldAlert} tone="blue" />
          <TeacherActionTile title="דוחות" href="/dashboard/garden/reports" icon={ListChecks} tone="green" />
        </TeacherQuickActions>

        <details className="teacher-management-details" id="full-task-workbench">
          <summary>ניהול מלא של משימות</summary>
          <div className="teacher-embedded-module">
            <TaskWorkbench tasks={tasks} />
          </div>
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
