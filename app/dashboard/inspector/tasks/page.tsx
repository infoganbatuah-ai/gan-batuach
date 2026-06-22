import { CheckSquare, ClipboardCheck } from "lucide-react";
import { TaskWorkbench } from "@/components/task-workbench";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InspectorAppFrame, InspectorHero, InspectorMetricCard, InspectorMetricGrid, InspectorSection } from "@/components/inspector-app-ui";

export default async function InspectorTasksPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, gardensRes, tasksRes] = await Promise.all([
    supabase.from("inspectors" as any).select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("gardens" as any).select("id").eq("inspector_id", profile.id),
    supabase.from("tasks" as any).select("*").or(`assigned_to.eq.${profile.id},assigned_role.eq.inspector`).order("created_at", { ascending: false }).limit(120)
  ]);
  const gardenIds = (gardensRes.data ?? []).map((garden: any) => garden.id);
  const scopedTasks = ((tasksRes.data ?? []) as any[]).filter((task) => task.assigned_to === profile.id || !task.garden_id || gardenIds.includes(task.garden_id));
  const urgent = scopedTasks.filter((task) => ["high", "urgent", "critical"].includes(String(task.priority))).length;
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as any)?.profile_photo_url ?? profile.profile_image_url };

  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/settings" title="משימות פקח" subtitle="פיקוח, תלונות וליקויים" badge="משימות">
      <InspectorHero eyebrow="עבודת המשך" title="כל המשימות שהוקצו לך" subtitle="משימות שהוקצו לפקח או לכלל הפקחים בגנים המשויכים בלבד." artwork={<CheckSquare />} />
      <InspectorMetricGrid columns={3}>
        <InspectorMetricCard label="משימות" value={scopedTasks.length} hint="פתוחות" icon={CheckSquare} />
        <InspectorMetricCard label="דחופות" value={urgent} hint="עדיפות גבוהה" icon={ClipboardCheck} tone={urgent ? "warning" : "success"} />
        <InspectorMetricCard label="גנים" value={gardenIds.length} hint="טווח הרשאה" icon={ClipboardCheck} />
      </InspectorMetricGrid>
      <InspectorSection title="לוח משימות" subtitle="הקומפוננטה הקיימת נשמרה כדי לא לשבור עדכון סטטוסים" icon={CheckSquare}>
        <TaskWorkbench tasks={scopedTasks} />
      </InspectorSection>
    </InspectorAppFrame>
  );
}
