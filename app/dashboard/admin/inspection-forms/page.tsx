import { ClipboardCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { InspectionFormBuilder } from "@/components/inspection-form-builder";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { AdminDataError } from "@/components/admin-data-state";

export default async function InspectionFormsBuilderPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("inspection forms", async () => {
    const supabase = await createClient();
    const [forms, questions, inspectors, gardens] = await Promise.all([
      supabase.from("inspection_forms" as any).select("id, name, description, active, frequency_months").order("created_at", { ascending: false }),
      supabase.from("inspection_form_questions" as any).select("id, form_id, category, question_text, question_type, weight, critical, required, sort_order").order("sort_order", { ascending: true }),
      supabase.from("profiles" as any).select("id, full_name, role").eq("role", "inspector").eq("active", true),
      supabase.from("gardens" as any).select("id, name, city").eq("status", "active")
    ]);
    [forms, questions, inspectors, gardens].forEach((res, index) => logSupabaseError("inspection forms " + index, res.error));
    return { forms: forms.data ?? [], questions: questions.data ?? [], inspectors: inspectors.data ?? [], gardens: gardens.data ?? [], queryError: [forms, questions, inspectors, gardens].some((res) => res.error) ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { forms: [] as any[], questions: [] as any[], inspectors: [] as any[], gardens: [] as any[], queryError: null as string | null });

  return (
    <DashboardShell role="admin" title="ניהול טפסי פיקוח">
      <div className="dashboard-hero-card">
        <div>
          <p className="eyebrow">Inspection Builder</p>
          <h1>בונה טפסי פיקוח ברור, דינמי ומוכן לשימוש פקחים.</h1>
          <p>ציון 1-10, כן/לא, טקסט, צילום, מסמך, משקל, שאלה קריטית, פרסום ושיוך לפיקוח חודשי.</p>
        </div>
        <span className="pill good"><ClipboardCheck size={15} /> מנוע ניקוד מחובר</span>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} /><InspectionFormBuilder forms={result.data.forms as any[]} questions={result.data.questions as any[]} inspectors={result.data.inspectors as any[]} gardens={result.data.gardens as any[]} />
    </DashboardShell>
  );
}
