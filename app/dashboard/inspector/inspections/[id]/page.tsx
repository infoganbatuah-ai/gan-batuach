import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Camera, CheckCircle2, ClipboardCheck, FileText, MapPin } from "lucide-react";
import { InspectorInspectionWizard } from "@/components/inspector-inspection-wizard";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";
import { InspectorAppFrame, InspectorHero, InspectorMetricCard, InspectorMetricGrid, InspectorSection, InspectorStatus } from "@/components/inspector-app-ui";

export default async function InspectorInspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireOperationalRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, inspectionRes] = await Promise.all([
    supabase.from("inspectors" as any).select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("inspections" as any).select("id,garden_id,form_id,status,started_at,completed_at,weighted_score,violation_count,gps_verified,gardens(name,city,address)").eq("id", id).eq("inspector_id", profile.id).maybeSingle()
  ]);
  const inspection = inspectionRes.data as any;
  if (!inspection) notFound();
  if (["done", "completed", "closed"].includes(String(inspection.status))) redirect(`/dashboard/inspector/inspections/${id}/report`);
  const questionsRes = await supabase.from("inspection_form_questions" as any).select("id,form_id,category,question_text,question_type,weight,critical,required,requires_photo,requires_document,sort_order").eq("form_id", inspection.form_id).order("sort_order");
  const questions = (questionsRes.data ?? []) as any[];
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as any)?.profile_photo_url ?? profile.profile_image_url };
  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/inspections" title="פרטי ביקורת" subtitle={inspection.gardens?.name ?? "גן משויך"} badge="טיוטה פעילה" backHref="/dashboard/inspector/inspections/due">
      <InspectorHero eyebrow="ביקורת חודשית" title={inspection.gardens?.name ?? "ביקורת"} subtitle={`${inspection.gardens?.city ?? ""} · ${inspection.gardens?.address ?? ""}`} artwork={<ClipboardCheck />} meta={<><InspectorStatus tone="primary">ניתן לשמור ולהמשיך</InspectorStatus><InspectorStatus tone="info"><MapPin size={15} /> GPS נבדק בהגשה</InspectorStatus></>} action={<Link className="inspector-action-button" href="/dashboard/inspector/inspections/history">היסטוריה</Link>} />
      <InspectorMetricGrid columns={4}>
        <InspectorMetricCard label="סעיפים" value={questions.length} hint="סה״כ בטופס" icon={ClipboardCheck} />
        <InspectorMetricCard label="חובה" value={questions.filter((q) => q.required).length} hint="לפני הגשה" icon={CheckCircle2} tone="warning" />
        <InspectorMetricCard label="דורשי תמונה" value={questions.filter((q) => q.requires_photo).length} hint="ראיה פרטית" icon={Camera} />
        <InspectorMetricCard label="מסמכים" value={questions.filter((q) => q.requires_document).length} hint="לפי סעיף" icon={FileText} />
      </InspectorMetricGrid>
      <InspectorSection title="צ׳ק ליסט ביקורת" subtitle="טיוטה נשמרת בשרת; הציון הסופי מחושב רק בהגשה הקנונית" icon={ClipboardCheck}>
        <InspectorInspectionWizard inspections={[inspection]} questions={questions} initialInspectionId={id} />
      </InspectorSection>
    </InspectorAppFrame>
  );
}
