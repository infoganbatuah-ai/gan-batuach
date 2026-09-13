import { DashboardShell } from "@/components/dashboard-shell";
import { ParentAppFrame, ParentHero, ParentSection } from "@/components/parent-app-ui";
import { ParentComplaintCenter } from "@/components/parent-complaint-center";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createClient } from "@/lib/supabase/server";

export default async function ParentComplaintsPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as any, profile);
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
  const { data } = await supabase.from("complaints" as any)
    .select("id,garden_id,child_id,subject,category,status,created_at,acknowledged_at,resolution_public,closed_at")
    .eq("reporter_user_id", profile.id).order("created_at", { ascending: false }).limit(100);
  return (
    <DashboardShell role="parent" title="תלונות ופניות" appHome>
      <ParentAppFrame active="more" profileName={profile.full_name} avatarUrl={(profile as any).profile_image_url ?? null}>
        <ParentHero title="פניות הורים" subtitle="פנייה מסודרת ומעקב ברור מול הגן" />
        <ParentSection title="מרכז פניות" subtitle="אפשר לשלוח פנייה, לראות שהתקבלה ולעקוב אם היא בבדיקה, טופלה או נסגרה." action={<span className="pill warn">מעקב טיפול</span>}>
          <ParentComplaintCenter contexts={contexts} rows={(data ?? []) as any[]} />
        </ParentSection>
      </ParentAppFrame>
    </DashboardShell>
  );
}
