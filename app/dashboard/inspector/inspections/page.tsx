import { DashboardShell } from "@/components/dashboard-shell";
import { InspectorInspectionWizard } from "@/components/inspector-inspection-wizard";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function InspectorInspectionsPage({ searchParams }: { searchParams?: Promise<{ required?: string }> }) {
  const params: { required?: string } = searchParams ? await searchParams.catch(() => ({})) : {};
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const { data: inspections } = await supabase
    .from("inspections")
    .select("id, garden_id, form_id, status, gardens(name, city)")
    .eq("inspector_id", profile.id)
    .neq("status", "done")
    .limit(20);
  const formIds = [...new Set((inspections ?? []).map((inspection: any) => inspection.form_id).filter(Boolean))];
  const [{ data: questions }, requiredRes] = await Promise.all([
    formIds.length ? supabase.from("inspection_form_questions").select("id, form_id, category, question_text, question_type, weight, critical, required, sort_order").in("form_id", formIds).order("sort_order", { ascending: true }) : Promise.resolve({ data: [] }),
    params.required ? supabase.from("required_inspections" as any).select("id, inspection_id").eq("id", params.required).eq("inspector_id", profile.id).maybeSingle() : Promise.resolve({ data: null })
  ]);
  const initialInspectionId = (requiredRes.data as any)?.inspection_id ?? "";

  return (
    <DashboardShell role="inspector" title="ביקורת פקח">
      <div className="parent-page-head inspector-page-head"><div><p className="eyebrow">טופס פיקוח בשטח</p><h1>סעיפים, תמונות, הערות, ניקוד וחתימה.</h1><p>הטופס מיועד לעבודה בשטח: התקדמות לפי סעיפים, אימות מיקום, משך ביקורת וחתימה בסיום.</p></div><span className="pill warn">GPS וחתימה</span></div>
      <InspectorInspectionWizard inspections={(inspections ?? []) as any[]} questions={(questions ?? []) as any[]} initialInspectionId={initialInspectionId} />
    </DashboardShell>
  );
}
