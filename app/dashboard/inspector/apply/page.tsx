import { ClipboardCheck, FileText, MapPin, ShieldCheck } from "lucide-react";
import { InspectorApplicationForm } from "@/components/self-service-forms";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InspectorAppFrame, InspectorHero, InspectorMetricCard, InspectorMetricGrid, InspectorSection, InspectorStatePanel } from "@/components/inspector-app-ui";

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
  const blocked = ["suspended", "inactive"].includes(String(application?.status ?? ""));

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
      {blocked ? (
        <InspectorStatePanel
          tone="danger"
          icon={<ShieldCheck />}
          eyebrow="סטטוס חשבון"
          title="הגישה לפעילות פיקוח הושהתה"
          text="היסטוריית הבקשה נשמרת, אך אין גישה לגנים, לראיות או לביקורות עד לבדיקת מנהל המערכת."
          actions={<a className="inspector-action-button" href="#application-status">צפייה בפרטי הבקשה</a>}
        />
      ) : null}
      <InspectorSection title={blocked ? "פרטי בקשה" : "טופס בקשה"} subtitle={blocked ? "הפרטים מוצגים לשמירת רצף הבדיקה" : "הטופס הקיים נשמר כדי לא לשנות את תהליך ההגשה"} icon={ClipboardCheck}>
        <div id="application-status">
          {blocked ? <p className="inspector-inline-note">לא ניתן לערוך בקשה מושהית. ניתן לפנות לתמיכה דרך ערוץ החשבון.</p> : <InspectorApplicationForm application={application} />}
        </div>
      </InspectorSection>
    </InspectorAppFrame>
  );
}
