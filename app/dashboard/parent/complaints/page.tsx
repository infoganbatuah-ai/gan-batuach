import { DashboardShell } from "@/components/dashboard-shell";
import { ParentComplaintCenter } from "@/components/parent-complaint-center";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ParentComplaintsPage() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const parentRes = await supabase.from("parents" as any).select("id").eq("profile_id", profile.id).maybeSingle();
  const parentId = (parentRes.data as any)?.id;
  const { data } = parentId ? await supabase.from("complaints" as any).select("*").eq("parent_id", parentId).order("created_at", { ascending: false }) : { data: [] };
  return <DashboardShell role="parent" title="תלונות ופניות"><div className="dashboard-hero-card parent-hero-card"><div><p className="eyebrow">Reports</p><h1>פנייה מסודרת לגן, לפקח או לאדמין.</h1><p>בחרו קטגוריה וחומרה. פניות חמורות מוצגות גם במרכז האדמין.</p></div><span className="pill warn">SLA</span></div><ParentComplaintCenter gardenId={profile.garden_id ?? ""} parentId={parentId} rows={(data ?? []) as any[]} /></DashboardShell>;
}
