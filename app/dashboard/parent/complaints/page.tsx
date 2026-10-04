import { DashboardShell } from "@/components/dashboard-shell";
import { ParentAppFrame } from "@/components/parent-app-ui";
import { ComplaintWorkspace } from "@/components/complaint-workspace";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createClient } from "@/lib/supabase/server";
import type { ComponentProps } from "react";

type ComplaintRows = ComponentProps<typeof ComplaintWorkspace>["rows"];
type ComplaintContexts = NonNullable<ComponentProps<typeof ComplaintWorkspace>["contexts"]>;
type ProfileWithImage = { profile_image_url?: string | null };

export default async function ParentComplaintsPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as Parameters<typeof getParentFamilyContext>[0], profile);
  const childContexts = family.enrollments
    .filter((enrollment) => enrollment.status === "active" && enrollment.child_id && (enrollment.garden_id ?? enrollment.kindergarten_id))
    .map((enrollment) => ({
      gardenId: enrollment.garden_id ?? enrollment.kindergarten_id,
      childId: enrollment.child_id,
      label: `${enrollment.full_name} · ${family.gardens.find((garden) => garden.id === (enrollment.garden_id ?? enrollment.kindergarten_id))?.name ?? "גן"}`
    }));
  const gardenContexts = family.links.filter((link) => link.status === "active" && (link.garden_id ?? link.kindergarten_id))
    .map((link) => ({ gardenId: link.garden_id ?? link.kindergarten_id, childId: null,
      label: `${family.gardens.find((garden) => garden.id === (link.garden_id ?? link.kindergarten_id))?.name ?? "גן"} · פנייה כללית` }));
  const contexts = [...childContexts, ...gardenContexts];
  const { data } = await supabase.from("complaints" as never)
    .select("id,garden_id,child_id,subject,description,category,severity,status,created_at,acknowledged_at,response_due_at,resolution_due_at,resolution_public,resolved_at,closed_at,gardens(name,city),children(full_name)")
    .eq("reporter_user_id", profile.id).order("created_at", { ascending: false }).limit(100);
  return <DashboardShell role="parent" title="תלונות ופניות" appHome>
    <ParentAppFrame active="more" profileName={profile.full_name} avatarUrl={(profile as ProfileWithImage).profile_image_url ?? null}>
      <ComplaintWorkspace rows={(data ?? []) as unknown as ComplaintRows} role="parent" contexts={contexts as ComplaintContexts} title="הפניות שלי" scopeMessage="מוצגות רק תלונות שהוגשו מהחשבון שלך ובהקשר הילד או הגן המקושר." />
    </ParentAppFrame>
  </DashboardShell>;
}
