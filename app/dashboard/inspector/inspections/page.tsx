import { DashboardShell } from "@/components/dashboard-shell";
import { InspectorInspectionWizard } from "@/components/inspector-inspection-wizard";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function InspectorInspectionsPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = createAdminClient();
  const { data: inspections } = await supabase
    .from("inspections")
    .select("id, garden_id, form_id, status, gardens(name, city)")
    .eq("inspector_id", profile.id)
    .neq("status", "done")
    .limit(20);
  const formIds = [...new Set((inspections ?? []).map((inspection: any) => inspection.form_id).filter(Boolean))];
  const { data: questions } = formIds.length ? await supabase.from("inspection_form_questions").select("id, form_id, category, question_text, question_type, weight, critical, required, sort_order").in("form_id", formIds).order("sort_order", { ascending: true }) : { data: [] };

  return (
    <DashboardShell role="inspector" title="ביקורת פקח">
      <div className="dashboard-hero-card"><div><p className="eyebrow">ביקורת מודרכת</p><h1>מילוי טופס פיקוח עם ציון, חריגים ו-GPS.</h1><p>הטופס מציג קטגוריות, התקדמות, ציון משוקלל וחריגים אדומים לפני שליחה.</p></div><span className="pill warn">GPS חובה</span></div>
      <InspectorInspectionWizard inspections={(inspections ?? []) as any[]} questions={(questions ?? []) as any[]} />
    </DashboardShell>
  );
}
