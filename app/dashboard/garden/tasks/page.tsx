import { DashboardShell } from "@/components/dashboard-shell";
import { TaskWorkbench } from "@/components/task-workbench";
import { TeacherAppFrame } from "@/components/teacher-app-ui";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { taskAssigneesFromEmployments, type TaskEmployment } from "@/lib/management/task-assignees";
import { createClient } from "@/lib/supabase/server";
import type { ComponentProps } from "react";

type TaskRows = ComponentProps<typeof TaskWorkbench>["tasks"];
type RawTask = TaskRows[number] & { assignee?: { full_name?: string | null } | null; creator?: { full_name?: string | null } | null };
type NamedProfile = { full_name?: string | null };
type ProfileWithImage = { profile_image_url?: string | null };

export default async function GardenTasksPage() {
  const { profile } = await requireOperationalRole(["manager", "owner"]);
  // The operational guard resolves the selected Garden and verifies can_manage_garden.
  const gardenId = profile.garden_id!;
  const supabase = await createClient();
  const [tasksResult, employmentResult, profilesResult] = await Promise.all([
    supabase.from("tasks" as never).select("id,garden_id,title,description,status,priority,due_at,created_at,updated_at,completed_at,assigned_to,created_by,source_entity_type,source_entity_id,assignee:assigned_to(full_name),creator:created_by(full_name)").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(120),
    supabase.from("staff_kindergarten_employments" as never).select("profile_id,start_date,end_date,staff(full_name,profile_id,approved_to_work,onboarding_status)" as never).eq("garden_id", gardenId).eq("status", "active").limit(500),
    supabase.from("profiles" as never).select("id,full_name").eq("id", profile.id)
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const assignees = [
    { id: profile.id, name: ((profilesResult.data?.[0] as unknown as NamedProfile | undefined)?.full_name) ?? profile.full_name ?? "מנהל/ת הגן" },
    ...taskAssigneesFromEmployments((employmentResult.data ?? []) as unknown as TaskEmployment[], today)
  ];
  const tasks: TaskRows = ((tasksResult.data ?? []) as unknown as RawTask[]).map((task) => ({ ...task, assignee_name: task.assignee?.full_name ?? null, creator_name: task.creator?.full_name ?? null }));

  return <DashboardShell role="manager" title="משימות" appHome>
    <TeacherAppFrame title="משימות הגן" subtitle="אחריות, יעד והתקדמות" avatarUrl={(profile as ProfileWithImage).profile_image_url ?? null} active="more">
      {tasksResult.error ? <p role="alert" className="work-feedback bad">המשימות אינן זמינות כרגע. נסו לרענן את העמוד.</p> : <>
        {employmentResult.error ? <p role="alert" className="work-feedback bad">רשימת אנשי הצוות אינה זמינה. אפשר לצפות במשימות, אך יש לרענן לפני שיוך חדש.</p> : null}
        <TaskWorkbench key={gardenId} tasks={tasks} gardenId={gardenId} assignees={assignees} canManage={!employmentResult.error} roleLabel="הנהלת הגן" />
      </>}
    </TeacherAppFrame>
  </DashboardShell>;
}
