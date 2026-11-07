import { StaffAppFrame } from "@/components/staff-app-ui";
import { TaskWorkbench } from "@/components/task-workbench";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";
import type { ComponentProps } from "react";

type TaskRows = ComponentProps<typeof TaskWorkbench>["tasks"];

export default async function StaffTasksPage() {
  const { profile, employment } = await requireOperationalRole(["staff"]);
  const gardenId = employment!.garden_id;
  const { data, error } = await (await createClient()).from("tasks" as never)
    .select("id,garden_id,title,description,status,priority,due_at,created_at,updated_at,completed_at,assigned_to,created_by,source_entity_type,source_entity_id").eq("garden_id", gardenId).eq("assigned_to", profile.id)
    .order("created_at", { ascending: false }).limit(120);
  return <StaffAppFrame active="more">
    {error ? <p role="alert" className="work-feedback bad">המשימות אינן זמינות כרגע. נסו לרענן את העמוד.</p> : <TaskWorkbench
      key={gardenId}
      tasks={(data ?? []) as unknown as TaskRows}
      assignees={[{ id: profile.id, name: profile.full_name?.trim() || "אני" }]}
      roleLabel="הצוות"
      limitedMessage="מוצגות רק משימות שהוקצו לך בגן הפעיל. משימות של עובדים אחרים אינן זמינות."
    />}
  </StaffAppFrame>;
}
