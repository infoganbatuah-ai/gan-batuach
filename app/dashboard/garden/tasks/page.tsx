import { DashboardShell } from "@/components/dashboard-shell";
import { TaskWorkbench } from "@/components/task-workbench";
import { TeacherAppFrame } from "@/components/teacher-app-ui";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";
import type { ComponentProps } from "react";

type TaskRows = ComponentProps<typeof TaskWorkbench>["tasks"];
type RawTask = TaskRows[number] & { assignee?: { full_name?: string | null } | null; creator?: { full_name?: string | null } | null };
type StaffAssignee = { profile_id: string | null; full_name: string };
type NamedProfile = { full_name?: string | null };
type ProfileWithImage = { profile_image_url?: string | null };

export default async function GardenTasksPage() {
  const { profile } = await requireOperationalRole(["manager", "owner"]);
  const supabase = await createClient();
  const [tasksResult, staffResult, profilesResult] = await Promise.all([
    supabase.from("tasks" as never).select("*,assignee:assigned_to(full_name),creator:created_by(full_name)").eq("garden_id", profile.garden_id ?? "").order("created_at", { ascending: false }).limit(120),
    supabase.from("staff" as never).select("profile_id,full_name,approved_to_work,onboarding_status").eq("garden_id", profile.garden_id ?? "").eq("approved_to_work", true).eq("onboarding_status", "active"),
    supabase.from("profiles" as never).select("id,full_name").eq("id", profile.id)
  ]);
  const assignees = [
    { id: profile.id, name: ((profilesResult.data?.[0] as unknown as NamedProfile | undefined)?.full_name) ?? profile.full_name ?? "מנהל/ת הגן" },
    ...((staffResult.data ?? []) as unknown as StaffAssignee[]).filter((person) => person.profile_id).map((person) => ({ id: person.profile_id!, name: person.full_name }))
  ];
  const tasks: TaskRows = ((tasksResult.data ?? []) as unknown as RawTask[]).map((task) => ({ ...task, assignee_name: task.assignee?.full_name ?? null, creator_name: task.creator?.full_name ?? null }));

  return <DashboardShell role="manager" title="משימות" appHome>
    <TeacherAppFrame title="משימות הגן" subtitle="אחריות, יעד והתקדמות" avatarUrl={(profile as ProfileWithImage).profile_image_url ?? null} active="more">
      <TaskWorkbench tasks={tasks} gardenId={profile.garden_id ?? undefined} assignees={assignees} canManage roleLabel="הנהלת הגן" />
    </TeacherAppFrame>
  </DashboardShell>;
}
