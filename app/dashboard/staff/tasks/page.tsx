import { StaffAppFrame } from "@/components/staff-app-ui";
import { TaskWorkbench } from "@/components/task-workbench";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";
import type { ComponentProps } from "react";

type TaskRows = ComponentProps<typeof TaskWorkbench>["tasks"];

export default async function StaffTasksPage() {
  const { profile } = await requireOperationalRole(["staff"]);
  const { data } = await (await createClient()).from("tasks" as never)
    .select("*").eq("garden_id", profile.garden_id ?? "").eq("assigned_to", profile.id)
    .order("created_at", { ascending: false }).limit(120);
  return <StaffAppFrame active="more">
    <TaskWorkbench
      tasks={(data ?? []) as unknown as TaskRows}
      roleLabel="הצוות"
      limitedMessage="מוצגות רק משימות שהוקצו לך בגן הפעיל. משימות של עובדים אחרים אינן זמינות."
    />
  </StaffAppFrame>;
}
