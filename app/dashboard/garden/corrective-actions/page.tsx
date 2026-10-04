import { CorrectiveActionWorkspace } from "@/components/corrective-action-workspace";
import { DashboardShell } from "@/components/dashboard-shell";
import { TeacherAppFrame } from "@/components/teacher-app-ui";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";
import type { ComponentProps } from "react";

type CorrectiveRows = ComponentProps<typeof CorrectiveActionWorkspace>["rows"];
type CorrectiveEventRow = { violation_id: string; id?: string; action: string; from_status?: string | null; to_status?: string | null; note?: string | null; created_at?: string | null };
type ProfileWithImage = { profile_image_url?: string | null };

export default async function GardenCorrectiveActionsPage() {
  const { profile } = await requireOperationalRole(["manager", "owner"]);
  const supabase = await createClient();
  const { data } = await supabase.from("violations" as never)
    .select("id,title,description,category,severity,score,status,correction_due_at,correction_note,review_note,correction_files,created_at,submitted_at,approved_at,gardens(name,city)")
    .eq("garden_id", profile.garden_id).order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as unknown as CorrectiveRows;
  const eventsRes = rows.length ? await supabase.from("corrective_action_events" as never)
    .select("id,violation_id,action,from_status,to_status,note,created_at").in("violation_id", rows.map((row) => row.id)).order("created_at") : { data: [] };
  const events = (eventsRes.data ?? []) as unknown as CorrectiveEventRow[];
  const enriched = rows.map((row) => ({ ...row, events: events.filter((event) => event.violation_id === row.id) }));
  return <DashboardShell role="manager" title="פעולות תיקון" appHome>
    <TeacherAppFrame title="פעולות תיקון" subtitle="ממצא, תגובה וראיה" avatarUrl={(profile as ProfileWithImage).profile_image_url ?? null} active="more">
      <CorrectiveActionWorkspace rows={enriched} role="garden" scopeMessage="מוצגות רק פעולות תיקון של הגן הפעיל. הראיות נשמרות פרטיות ונפתחות בגישה חתומה." />
    </TeacherAppFrame>
  </DashboardShell>;
}
