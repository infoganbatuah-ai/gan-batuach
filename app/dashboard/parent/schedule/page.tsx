import { DashboardShell } from "@/components/dashboard-shell";
import { ModuleListPage } from "@/components/module-list-page";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createClient } from "@/lib/supabase/server";

export default async function ParentSchedulePage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const family = await getParentFamilyContext(supabase as any, profile);
  const { data } = family.gardenIds.length
    ? await supabase.from("schedule_items" as any).select("id, title, description, starts_at, ends_at, visible_to_parents, created_at").in("garden_id", family.gardenIds).eq("visible_to_parents", true).order("starts_at", { ascending: true }).limit(80)
    : { data: [] };
  const rows = (data ?? []).map((item: any) => ({ ...item, status: item.starts_at ? new Date(item.starts_at).toLocaleDateString("he-IL") : "לו״ז", description: item.description ?? "פעילות / תפריט / אירוע" }));
  return <DashboardShell role="parent" title="לו״ז ותפריט"><ModuleListPage title="לו״ז, תפריט ופעילויות" eyebrow="Schedule" description="סדר יום, אוכל, פעילויות, חגים, ימי הולדת ותוכנית חינוכית שהגן פרסם להורים." rows={rows} emptyTitle="אין לו״ז מפורסם כרגע" emptyText="כאשר הגן יפרסם פעילות, תפריט או אירוע להורים, הם יופיעו כאן." /></DashboardShell>;
}
