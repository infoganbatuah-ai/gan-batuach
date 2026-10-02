import { DashboardShell } from "@/components/dashboard-shell";
import { TeacherAppFrame } from "@/components/teacher-app-ui";
import { ComplaintWorkspace } from "@/components/complaint-workspace";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";
import type { ComponentProps } from "react";

type ComplaintRows = ComponentProps<typeof ComplaintWorkspace>["rows"];
type ProfileWithImage = { profile_image_url?: string | null };

export default async function GardenComplaintsPage() {
  const { profile } = await requireOperationalRole(["manager", "owner"]);
  const { data } = await (await createClient()).from("complaints" as never)
    .select("id,garden_id,child_id,subject,description,category,severity,status,created_at,acknowledged_at,resolved_at,closed_at,acknowledgement_due_at,response_due_at,resolution_due_at,resolution_public,routing_state,children(full_name),parents(full_name),assignee:assigned_to(full_name),gardens(name,city)")
    .eq("garden_id", profile.garden_id ?? "").order("created_at", { ascending: false }).limit(120);
  return <DashboardShell role="manager" title="תלונות ופניות" appHome>
    <TeacherAppFrame title="תלונות ופניות" subtitle="טיפול מסודר מול הפונה" avatarUrl={(profile as ProfileWithImage).profile_image_url ?? null} active="more">
      <ComplaintWorkspace rows={(data ?? []) as unknown as ComplaintRows} role="garden" scopeMessage="הנהלת הגן רואה רק תלונות של הגן הפעיל, ללא הערות פיקוח פנימיות שאינן מורשות." />
    </TeacherAppFrame>
  </DashboardShell>;
}
