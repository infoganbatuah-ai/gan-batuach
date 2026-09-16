import { AlertTriangle, FileText, MessageSquareWarning } from "lucide-react";
import { ComplaintCaseActions } from "@/components/complaint-case-actions";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";
import {
  InspectorAppFrame,
  InspectorEmpty,
  InspectorHero,
  InspectorList,
  InspectorMetricCard,
  InspectorMetricGrid,
  InspectorRow,
  InspectorSection,
  InspectorStatus
} from "@/components/inspector-app-ui";

function reportStatusLabel(status?: string | null, severity?: string | null) {
  const statusLabels: Record<string, string> = {
    open: "פתוח",
    pending: "ממתין",
    review: "בבדיקה",
    in_progress: "בטיפול",
    closed: "נסגר",
    done: "הושלם"
  };
  const severityLabels: Record<string, string> = {
    critical: "קריטי",
    urgent: "דחוף",
    high: "גבוה",
    medium: "בינוני",
    low: "נמוך"
  };
  return statusLabels[String(status ?? "").toLowerCase()] ?? severityLabels[String(severity ?? "").toLowerCase()] ?? "פתוח";
}

export default async function InspectorReportsPage() {
  const { profile } = await requireOperationalRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, gardensRes] = await Promise.all([
    supabase.from("inspectors" as any).select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("gardens" as any).select("id").eq("inspector_id", profile.id)
  ]);
  const ids = (gardensRes.data ?? []).map((g: any) => g.id);
  const [complaints, incidents] = ids.length ? await Promise.all([
    supabase.from("complaints" as any).select("id, subject, severity, status, created_at, acknowledgement_due_at, response_due_at, resolution_due_at, sla_policy_id, gardens(name)").in("garden_id", ids).order("created_at", { ascending: false }),
    supabase.from("incident_reports" as any).select("id, title, severity, status, created_at, gardens(name)").in("garden_id", ids).order("created_at", { ascending: false })
  ]) : [{ data: [] }, { data: [] }];
  const rows = [...(complaints.data ?? []).map((row) => ({ ...row, source: "complaint" })),
    ...(incidents.data ?? []).map((row) => ({ ...row, source: "incident" }))] as any[];
  const urgent = rows.filter((row) => ["critical", "high", "urgent"].includes(String(row.severity))).length;
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as any)?.profile_photo_url ?? profile.profile_image_url };

  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/reports" title="דיווחים ופניות" subtitle="תלונות, אירועים ודוחות בגנים המשויכים" badge="דוחות">
      <InspectorHero eyebrow="דיווחים לפקח" title="כל אירוע שדורש בדיקה אנושית" subtitle="הפקח רואה רק פניות, תלונות ואירועים של גנים שהוקצו לו." artwork={<MessageSquareWarning />} />
      <InspectorMetricGrid columns={3}>
        <InspectorMetricCard label="דיווחים פתוחים" value={rows.length} hint="לטיפול" icon={FileText} />
        <InspectorMetricCard label="דחופים" value={urgent} hint="חומרה גבוהה" icon={AlertTriangle} tone={urgent ? "warning" : "success"} />
        <InspectorMetricCard label="גנים משויכים" value={ids.length} hint="טווח הרשאה" icon={MessageSquareWarning} />
      </InspectorMetricGrid>
      <InspectorSection title="תור דיווחים" subtitle="פניות ואירועים לפי זמן וחומרה" icon={FileText}>
        <InspectorList>
          {rows.map((row) => (
            <InspectorRow
              key={`${row.id}-${row.subject ?? row.title}`}
              title={row.subject ?? row.title ?? "דיווח"}
              subtitle={row.gardens?.name ?? "גן"}
              meta={`${row.created_at ? new Date(row.created_at).toLocaleString("he-IL") : ""}${row.source === "complaint" && row.sla_policy_id && [row.acknowledgement_due_at, row.response_due_at, row.resolution_due_at].some((due) => due && new Date(due).getTime() < Date.now()) && !["resolved", "closed"].includes(row.status) ? " · יעד SLA חלף" : ""}`}
              status={<InspectorStatus tone={["critical", "high", "urgent"].includes(String(row.severity)) ? "danger" : "warning"}>{reportStatusLabel(row.status, row.severity)}</InspectorStatus>}
              actions={row.source === "complaint" ? <ComplaintCaseActions id={row.id} status={row.status} role="inspector" /> : undefined}
            />
          ))}
          {rows.length === 0 ? <InspectorEmpty title="אין דיווחים פתוחים" text="כאשר הורה, גן או תצפיתן ייצרו אירוע בגנים שלך, הוא יופיע כאן." icon={FileText} /> : null}
        </InspectorList>
      </InspectorSection>
    </InspectorAppFrame>
  );
}
