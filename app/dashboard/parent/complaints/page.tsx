import { DashboardShell } from "@/components/dashboard-shell";
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
  return <DashboardShell role="parent" title="תלונות ופניות"><div className="dashboard-hero-card parent-hero-card"><div><p className="eyebrow">Reports</p><h1>פנייה מסודרת לגן, לפקח או לאדמין.</h1><p>בחרו קטגוריה וחומרה. פניות חמורות מוצגות גם במרכז האדמין.</p></div><span className="pill warn">SLA</span></div><ParentComplaintCenter gardenId={gardenId} parentId={parentId} rows={(data ?? []) as any[]} /></DashboardShell>;
}
