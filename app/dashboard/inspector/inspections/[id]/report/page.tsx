import { FileText } from "lucide-react";
import { InspectionReportView } from "@/components/inspection-report-view";
import { InspectorAppFrame, InspectorHero, InspectorSection } from "@/components/inspector-app-ui";
import { requireOperationalRole } from "@/lib/management/operational-role";

export default async function InspectorReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireOperationalRole(["inspector"]);
  return (
    <InspectorAppFrame profile={profile} activeHref="/dashboard/inspector/reports" title="דוח ביקורת" subtitle="תוצאה חתומה, ממצאים ותיעוד" badge="דוח" backHref="/dashboard/inspector/inspections/history">
      <InspectorHero eyebrow="דוח חתום" title="תוצאת הביקורת והפעולות שנפתחו" subtitle="הציון והדוח נשמרים לפי ההגשה הקנונית. פעולות תיקון אינן משנות את הציון ההיסטורי." artwork={<FileText />} />
      <InspectorSection title="דוח ותיעוד" subtitle="מידע פרטי מוצג רק לפי הרשאת השיוך" icon={FileText}>
        <InspectionReportView id={id} role="inspector" backHref="/dashboard/inspector/inspections/history" />
      </InspectorSection>
    </InspectorAppFrame>
  );
}
