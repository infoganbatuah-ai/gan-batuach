import { ClipboardCheck, FileText, MapPin, ShieldCheck } from "lucide-react";
import { InspectorApplicationForm } from "@/components/self-service-forms";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InspectorAppFrame, InspectorHero, InspectorMetricCard, InspectorMetricGrid, InspectorSection } from "@/components/inspector-app-ui";

function formatStatus(status?: string | null) {
  const map: Record<string, string> = {
    draft: "טיוטה",
    submitted: "נשלח",
    under_review: "בבדיקה",
    approved_pending_assignment: "ממתין לשיוך",
    more_information_requested: "נדרש מידע נוסף",
    approved: "מאושר",
    rejected: "נדחה",
    suspended: "מושהה",
    inactive: "לא פעיל"
  };
  return map[status ?? ""] ?? status ?? "טיוטה";
}

export default async function InspectorApplyPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const application = (await supabase.from("inspector_applications" as any)
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle()).data as any;

  return (
    <InspectorAppFrame profile={profile} activeHref="/dashboard/inspector/settings" title="בקשת מפקח" subtitle="הגשה, מסמכים ואישור אדמין" badge={formatStatus(application?.status)}>
      <InspectorHero
        eyebrow="מועמד/ת מפקח"
        title="הצטרפות למערך המפקחים של גן בטוח"
        subtitle="עד אישור אדמין ושיוך גנים, אין גישה לגנים, ביקורות, מצלמות, דוחות או נתוני ילדים."
        artwork={<ClipboardCheck />}
      />
      <InspectorMetricGrid columns={3}>
        <InspectorMetricCard label="סטטוס בקשה" value={formatStatus(application?.status)} hint="אישור אדמין בלבד" icon={ShieldCheck} tone={application?.status === "approved" ? "success" : "warning"} />
        <InspectorMetricCard label="מסמכים" value={Object.keys(application?.documents ?? {}).length} hint="צורפו לבקשה" icon={FileText} />
        <InspectorMetricCard label="אזורים" value={(application?.preferred_regions ?? []).length} hint="העדפות אזור" icon={MapPin} />
      </InspectorMetricGrid>
      <InspectorSection title="טופס בקשה" subtitle="הטופס הקיים נשמר כדי לא לשנות את תהליך ההגשה" icon={ClipboardCheck}>
        <InspectorApplicationForm application={application} />
      </InspectorSection>
    </InspectorAppFrame>
  );
}
