import { ClipboardCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { InspectionFormBuilder } from "@/components/inspection-form-builder";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { AdminDataError } from "@/components/admin-data-state";
import { InspectionSupervisionCenter } from "@/components/inspection-supervision-center";

async function readSource<T extends { data: unknown; error: unknown }>(load: () => PromiseLike<T>) {
  try {
    const response = await load();
    return { data: response.error ? null : response.data, error: response.error, available: !response.error };
  } catch (error) {
    return { data: null, error: error || new Error("Source unavailable"), available: false };
  }
}

export default async function InspectionFormsBuilderPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("inspection forms", async () => {
    const supabase = await createClient();
    const [forms, questions, inspectors, gardens, dueSoon, late, history] = await Promise.all([
      readSource(() => supabase.from("inspection_forms" as any).select("id, name, description, active, frequency_months").order("created_at", { ascending: false })),
      readSource(() => supabase.from("inspection_form_questions" as any).select("id, form_id, category, question_text, question_type, weight, critical, required, sort_order").order("sort_order", { ascending: true })),
      readSource(() => supabase.from("profiles" as any).select("id, full_name, role").eq("role", "inspector").eq("active", true)),
      readSource(() => supabase.from("gardens" as any).select("id, name, city").eq("status", "active")),
      readSource(() => supabase.from("required_inspections" as any).select("*, gardens(name,last_inspection_score), inspectors:inspector_id(full_name)").in("status", ["required", "open"]).gte("due_at", new Date().toISOString()).order("due_at").limit(50)),
      readSource(() => supabase.from("required_inspections" as any).select("*, gardens(name,last_inspection_score), inspectors:inspector_id(full_name)").in("status", ["required", "open", "late"]).lt("due_at", new Date().toISOString()).order("due_at").limit(50)),
      readSource(() => supabase.from("inspections" as any).select("id, garden_id, inspector_id, completed_at, status, weighted_score, signature_image, gardens(name), inspectors:inspector_id(full_name)").order("completed_at", { ascending: false }).limit(50))
    ]);
    [forms, questions, inspectors, gardens, dueSoon, late, history].forEach((res, index) => logSupabaseError("inspection forms " + index, res.error));
    return { availability: { forms: forms.available, questions: questions.available, inspectors: inspectors.available, gardens: gardens.available, dueSoon: dueSoon.available, late: late.available, history: history.available }, forms: forms.data ?? [], questions: questions.data ?? [], inspectors: inspectors.data ?? [], gardens: gardens.data ?? [], dueSoon: dueSoon.data ?? [], late: late.data ?? [], history: history.data ?? [], queryError: [forms, questions, inspectors, gardens, dueSoon, late, history].some((res) => res.error) ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { availability: { forms: false, questions: false, inspectors: false, gardens: false, dueSoon: false, late: false, history: false }, forms: [] as any[], questions: [] as any[], inspectors: [] as any[], gardens: [] as any[], dueSoon: [] as any[], late: [] as any[], history: [] as any[], queryError: null as string | null });

  const available = result.data.availability;
  const allAvailable = Object.values(available).every(Boolean);

  return (
    <DashboardShell role="admin" title="ניהול טפסי פיקוח">
      <div className="dashboard-hero-card">
        <div>
          <p className="eyebrow">Inspection Builder</p>
          <h1>בונה טפסי פיקוח ברור, דינמי ומוכן לשימוש פקחים.</h1>
          <p>ציון 1-10, כן/לא, טקסט, צילום, מסמך, משקל, שאלה קריטית, פרסום ושיוך לפיקוח חודשי.</p>
        </div>
        <span className={allAvailable ? "pill good" : "pill"}><ClipboardCheck size={15} /> מנוע ניקוד מחובר</span>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} /><InspectionSupervisionCenter dueSoonAvailable={available.dueSoon} lateAvailable={available.late} historyAvailable={available.history} dueSoon={result.data.dueSoon as any[]} late={result.data.late as any[]} history={result.data.history as any[]} /><InspectionFormBuilder formsAvailable={available.forms} questionsAvailable={available.questions} inspectorsAvailable={available.inspectors} gardensAvailable={available.gardens} forms={result.data.forms as any[]} questions={result.data.questions as any[]} inspectors={result.data.inspectors as any[]} gardens={result.data.gardens as any[]} />
    </DashboardShell>
  );
}
