import Link from "next/link";
import { Camera, CalendarCheck, ClipboardCheck, FileText, ShieldCheck } from "lucide-react";
import { InspectorInspectionWizard } from "@/components/inspector-inspection-wizard";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  InspectorActionCard,
  InspectorActions,
  InspectorAppFrame,
  InspectorHero,
  InspectorMetricCard,
  InspectorMetricGrid,
  InspectorSection
} from "@/components/inspector-app-ui";

export default async function InspectorInspectionsPage({ searchParams }: { searchParams?: Promise<{ required?: string }> }) {
  const params: { required?: string } = searchParams ? await searchParams.catch(() => ({})) : {};
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, inspectionsRes, requiredRes] = await Promise.all([
    supabase.from("inspectors" as any).select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("inspections").select("id, garden_id, form_id, status, gardens(name, city)").eq("inspector_id", profile.id).neq("status", "done").limit(20),
    params.required ? supabase.from("required_inspections" as any).select("id, inspection_id").eq("id", params.required).eq("inspector_id", profile.id).maybeSingle() : Promise.resolve({ data: null })
  ]);
  const inspections = (inspectionsRes.data ?? []) as any[];
  const formIds = [...new Set(inspections.map((inspection) => inspection.form_id).filter(Boolean))];
  const { data: questions } = formIds.length
    ? await supabase.from("inspection_form_questions").select("id, form_id, category, question_text, question_type, weight, critical, required, sort_order").in("form_id", formIds).order("sort_order", { ascending: true })
    : { data: [] };
  const initialInspectionId = (requiredRes.data as any)?.inspection_id ?? "";
  const inspector = inspectorRes.data as any;
  const profileForUi = { ...profile, profile_image_url: inspector?.profile_photo_url ?? profile.profile_image_url };
  const requiredQuestions = (questions ?? []).filter((question: any) => question.required).length;
  const categories = new Set((questions ?? []).map((question: any) => question.category)).size;

  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/inspections" title="טופס ביקורת חודשית" subtitle="סעיפים, תמונות, הערות, ניקוד וחתימה" badge="ביקורת">
      <InspectorHero
        eyebrow="ביקורת בשטח"
        title="מלאו ביקורת, צלמו ממצאים ושלחו דוח חתום"
        subtitle="הטופס מחייב עבודה מסודרת: סעיפים, ציון, הערות, הוכחות, GPS וחתימה לפני שליחת הדוח."
        artwork={<ClipboardCheck />}
        action={<Link className="inspector-action-button" href="/dashboard/inspector/inspections/history">היסטוריית ביקורות</Link>}
      />
      <InspectorMetricGrid columns={4}>
        <InspectorMetricCard label="ביקורות פתוחות" value={inspections.length} hint="ממתינות לטיפול" icon={CalendarCheck} />
        <InspectorMetricCard label="קטגוריות" value={categories} hint="סעיפי בדיקה" icon={ShieldCheck} />
        <InspectorMetricCard label="שאלות חובה" value={requiredQuestions} hint="לפני שליחה" icon={FileText} tone="warning" />
        <InspectorMetricCard label="תיעוד" value="תמונות" hint="לפי סעיף" icon={Camera} />
      </InspectorMetricGrid>
      <InspectorSection title="טופס הביקורת" subtitle="בחירת ביקורת, התקדמות, סעיפים וחתימה" icon={ClipboardCheck}>
        <InspectorInspectionWizard inspections={inspections} questions={(questions ?? []) as any[]} initialInspectionId={initialInspectionId} />
      </InspectorSection>
      <InspectorActions>
        <InspectorActionCard title="לוח ביקורות" text="קרובות ובאיחור" href="/dashboard/inspector/inspections/due" icon={CalendarCheck} />
        <InspectorActionCard title="היסטוריה" text="דוחות קודמים" href="/dashboard/inspector/inspections/history" icon={FileText} />
        <InspectorActionCard title="ליקויים" text="מעקב תיקונים" href="/dashboard/inspector/violations" icon={ShieldCheck} />
        <InspectorActionCard title="גנים" text="גנים משויכים" href="/dashboard/inspector/control-center" icon={CalendarCheck} />
      </InspectorActions>
    </InspectorAppFrame>
  );
}
