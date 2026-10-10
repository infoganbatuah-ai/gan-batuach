import { TaskWorkbench } from "@/components/task-workbench";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";
import { InspectorAppFrame } from "@/components/inspector-app-ui";
import type { ComponentProps } from "react";

type TaskRows = ComponentProps<typeof TaskWorkbench>["tasks"];
type InspectorPhoto = { profile_photo_url?: string | null };
type GardenId = { id: string };
type ProfileWithImage = { profile_image_url?: string | null };

export default async function InspectorTasksPage() {
  const { profile } = await requireOperationalRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, gardensRes, tasksRes] = await Promise.all([
    supabase.from("inspectors" as never).select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("gardens" as never).select("id").eq("inspector_id", profile.id),
    supabase.from("tasks" as never).select("*").or(`assigned_to.eq.${profile.id},assigned_role.eq.inspector`).order("created_at", { ascending: false }).limit(120)
  ]);
  const gardenIds = ((gardensRes.data ?? []) as unknown as GardenId[]).map((garden) => garden.id);
  const scopedTasks = ((tasksRes.data ?? []) as unknown as TaskRows).filter((task) => task.garden_id && gardenIds.includes(task.garden_id));
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as unknown as InspectorPhoto | null)?.profile_photo_url ?? (profile as ProfileWithImage).profile_image_url };
  return <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/tasks" title="משימות פקח" subtitle="פיקוח, תלונות וליקויים" badge="משימות">
    <TaskWorkbench tasks={scopedTasks} roleLabel="הפיקוח" limitedMessage="מוצגות רק משימות בגנים המשויכים אליך ובהקשר הפיקוח המורשה." />
  </InspectorAppFrame>;
}
