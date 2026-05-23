import { ClipboardCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { InspectionFormBuilder } from "@/components/inspection-form-builder";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function InspectionFormsBuilderPage() {
  await requireRole(["admin"]);
  const supabase = createAdminClient();
  const [{ data: forms }, { data: questions }, { data: inspectors }, { data: gardens }] = await Promise.all([
    supabase.from("inspection_forms").select("id, name, description, active, frequency_months").order("created_at", { ascending: false }),
    supabase.from("inspection_form_questions").select("id, form_id, category, question_text, question_type, weight, critical, required, sort_order").order("sort_order", { ascending: true }),
    supabase.from("profiles").select("id, full_name, role").eq("role", "inspector").eq("active", true),
    supabase.from("gardens").select("id, name, city").eq("status", "active")
  ]);

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
      <InspectionFormBuilder forms={(forms ?? []) as any[]} questions={(questions ?? []) as any[]} inspectors={(inspectors ?? []) as any[]} gardens={(gardens ?? []) as any[]} />
    </DashboardShell>
  );
}
