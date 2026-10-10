import { ComplaintWorkspace } from "@/components/complaint-workspace";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";
import { InspectorAppFrame } from "@/components/inspector-app-ui";
import type { ComponentProps } from "react";

type ComplaintRows = ComponentProps<typeof ComplaintWorkspace>["rows"];
type InspectorPhoto = { profile_photo_url?: string | null };
type ProfileWithImage = { profile_image_url?: string | null };

export default async function InspectorComplaintsPage() {
  const { profile } = await requireOperationalRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, gardensRes] = await Promise.all([
    supabase.from("inspectors").select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("gardens").select("id").eq("inspector_id", profile.id)
  ]);
  const gardenIds = ((gardensRes.data ?? []) as { id: string }[]).map((garden) => garden.id);
  const complaintsRes = gardenIds.length
    ? await supabase.from("complaints").select("id,garden_id,subject,description,category,severity,status,created_at,acknowledged_at,resolved_at,closed_at,acknowledgement_due_at,response_due_at,resolution_due_at,resolution_public,routing_state,gardens(name,city)").in("garden_id", gardenIds).eq("assigned_inspector_id", profile.id).order("created_at", { ascending: false }).limit(100)
    : { data: [] };
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as unknown as InspectorPhoto | null)?.profile_photo_url ?? (profile as ProfileWithImage).profile_image_url };
  return <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/complaints" title="תלונות ופניות" subtitle="גישה רק לתלונות בתחום השיוך" badge="תלונות">
    <ComplaintWorkspace rows={(complaintsRes.data ?? []) as unknown as ComplaintRows} role="inspector" scopeMessage="מוצגות רק תלונות ששויכו אליך בגנים פעילים. תוכן שאינו נדרש לפיקוח אינו נחשף." />
  </InspectorAppFrame>;
}
