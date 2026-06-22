import { ClipboardList } from "lucide-react";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffMetricCard, StaffPageHero, StaffSection, StaffStats } from "@/components/staff-app-ui";
import { TaskWorkbench } from "@/components/task-workbench";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffTasksPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const { data } = await supabase.from("tasks" as any).select("*").eq("garden_id", profile.garden_id ?? "").or(`assigned_to.eq.${profile.id},assigned_role.eq.staff`).order("created_at", { ascending: false }).limit(120);
  const rows = (data ?? []) as any[];
  const overdue = rows.filter((task) => task.due_at && new Date(task.due_at).getTime() < Date.now()).length;
  const done = rows.filter((task) => task.status === "done" || task.status === "completed").length;
  return (
    <StaffAppFrame active="more">
      <StaffPageHero
        eyebrow="המשימות שלי"
        title="מה נשאר למשמרת?"
        text="משימות להיום, משימות באיחור ומה שכבר הושלם."
        icon={ClipboardList}
        badge={<StatusChip tone={overdue ? "danger" : "success"}>{overdue ? `${overdue} באיחור` : "אין איחורים"}</StatusChip>}
      />
      <StaffStats>
        <StaffMetricCard title="פתוחות" value={rows.length - done} icon={ClipboardList} tone="purple" />
        <StaffMetricCard title="באיחור" value={overdue} icon={ClipboardList} tone={overdue ? "red" : "green"} />
        <StaffMetricCard title="הושלמו" value={done} icon={ClipboardList} tone="green" />
      </StaffStats>
      <StaffSection title="ניהול משימות">
        <TaskWorkbench tasks={rows} />
      </StaffSection>
    </StaffAppFrame>
  );
}
