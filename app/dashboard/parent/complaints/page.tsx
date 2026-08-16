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
  const parentId = family.parentIds[0];
  const gardenId = family.gardenIds[0] ?? profile.garden_id ?? "";
  const { data } = family.parentIds.length ? await supabase.from("complaints" as any).select("*").in("parent_id", family.parentIds).order("created_at", { ascending: false }) : { data: [] };
  return (
    <DashboardShell role="parent" title="תלונות ופניות" appHome>
      <ParentAppFrame active="more" profileName={profile.full_name} avatarUrl={(profile as any).profile_image_url ?? null}>
        <ParentHero title="פניות הורים" subtitle="פנייה מסודרת ומעקב ברור מול הגן" />
        <ParentSection title="מרכז פניות" subtitle="אפשר לשלוח פנייה, לראות שהתקבלה ולעקוב אם היא בבדיקה, טופלה או נסגרה." action={<span className="pill warn">מעקב טיפול</span>}>
          <ParentComplaintCenter gardenId={gardenId} parentId={parentId} rows={(data ?? []) as any[]} />
        </ParentSection>
      </ParentAppFrame>
    </DashboardShell>
  );
}
