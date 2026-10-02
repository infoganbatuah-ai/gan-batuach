import { CorrectiveActionWorkspace } from "@/components/corrective-action-workspace";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";
import { InspectorAppFrame } from "@/components/inspector-app-ui";
import type { ComponentProps } from "react";

type CorrectiveRows = ComponentProps<typeof CorrectiveActionWorkspace>["rows"];
type CorrectiveEventRow = { violation_id: string; id?: string; action: string; from_status?: string | null; to_status?: string | null; note?: string | null; created_at?: string | null };
type InspectorPhoto = { profile_photo_url?: string | null };
type ProfileWithImage = { profile_image_url?: string | null };

export default async function InspectorCorrectiveActionsPage() {
  const { profile } = await requireOperationalRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, gardensRes] = await Promise.all([
    supabase.from("inspectors").select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("gardens").select("id").eq("inspector_id", profile.id)
  ]);
  const gardenIds = ((gardensRes.data ?? []) as { id: string }[]).map((row) => row.id);
  const violationsRes = gardenIds.length ? await supabase.from("violations")
    .select("id,garden_id,title,description,category,severity,score,status,correction_due_at,correction_note,review_note,submitted_at,approved_at,correction_files,created_at,gardens(name,city)")
    .in("garden_id", gardenIds).order("updated_at", { ascending: false }).limit(100) : { data: [] };
  const rows = (violationsRes.data ?? []) as unknown as CorrectiveRows;
  const eventsRes = rows.length ? await supabase.from("corrective_action_events" as never)
    .select("id,violation_id,action,from_status,to_status,note,created_at").in("violation_id", rows.map((row) => row.id)).order("created_at") : { data: [] };
  const events = (eventsRes.data ?? []) as unknown as CorrectiveEventRow[];
  const enriched = rows.map((row) => ({ ...row, events: events.filter((event) => event.violation_id === row.id) }));
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as unknown as InspectorPhoto | null)?.profile_photo_url ?? (profile as ProfileWithImage).profile_image_url };
  return <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/corrective-actions" title="מעקב תיקונים" subtitle="ראיות, החלטות והיסטוריית טיפול" badge="פעולות תיקון">
    <CorrectiveActionWorkspace rows={enriched} role="inspector" scopeMessage="מוצגות רק פעולות בגנים המשויכים אליך. האימות נשמר כאירוע ואינו משנה את ציון הביקורת המקורי." />
  </InspectorAppFrame>;
}
