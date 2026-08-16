import { ClipboardList } from "lucide-react";
import { israelTodayDateKey } from "@/lib/domain/israel-date";
import { DailyTaskJournal } from "@/components/daily-task-journal";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffPageHero, StaffSection } from "@/components/staff-app-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffDailyJournalPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const today = israelTodayDateKey();
  const [tasksRes, completionsRes] = await Promise.all([
    supabase.from("daily_operational_tasks" as any).select("*").eq("active", true).contains("role_scope", ["staff"]),
    supabase.from("daily_task_completions" as any).select("*").eq("completed_for_date", today).eq("completed_by", profile.id)
  ]);
  return (
    <StaffAppFrame active="more">
      <StaffPageHero eyebrow="יומן צוות" title="משימות תפעול לצוות" text="סימון משימות, היסטוריה והתקדמות יומית." icon={ClipboardList} badge={<StatusChip tone="success">צוות</StatusChip>} />
      <StaffSection title="משימות תפעול">
        <DailyTaskJournal tasks={(tasksRes.data ?? []) as any[]} completions={(completionsRes.data ?? []) as any[]} gardenId={profile.garden_id} />
      </StaffSection>
    </StaffAppFrame>
  );
}
