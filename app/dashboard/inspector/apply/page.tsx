import { ClipboardCheck, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { RoleMetricCard } from "@/components/premium-dashboard";
import { InspectorApplicationForm } from "@/components/self-service-forms";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
  return map[status ?? ""] ?? status ?? "-";
}

export default async function InspectorApplyPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const application = (await supabase.from("inspector_applications" as any)
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle()).data as any;

  return (
    <DashboardShell role="inspector" title="בקשת מפקח">
      <section className="dashboard-hero-card">
        <div>
          <p className="eyebrow">מועמד/ת מפקח</p>
          <h1>הגישו בקשה להצטרף למערך המפקחים של גן בטוח.</h1>
          <p>עד אישור אדמין ושיוך גנים, אין גישה לגנים, ביקורות, מצלמות, דוחות או נתוני ילדים.</p>
        </div>
        <span className={application?.status === "approved" ? "pill good" : "pill warn"}>{formatStatus(application?.status)}</span>
      </section>
      <section className="grid cols-3 dashboard-kpis">
        <RoleMetricCard label="סטטוס בקשה" value={application?.status ?? "טיוטה"} tone={application?.status === "approved" ? "good" : "warn"} />
        <RoleMetricCard label="מסמכים" value={Object.keys(application?.documents ?? {}).length} />
        <RoleMetricCard label="אזורים" value={(application?.preferred_regions ?? []).length} />
      </section>
      <InspectorApplicationForm application={application} />
      <section className="manager-report-row">
        <span><ShieldCheck /> אישור מפקח מתבצע על ידי אדמין בלבד.</span>
        <span><ClipboardCheck /> גנים נפתחים רק לאחר שיוך מפורש.</span>
      </section>
    </DashboardShell>
  );
}
