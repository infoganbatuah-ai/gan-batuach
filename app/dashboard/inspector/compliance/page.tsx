import Link from "next/link";
import { AlertTriangle, ClipboardCheck, FileWarning, ShieldCheck } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildComplianceScore, complianceTone } from "@/lib/domain/smart-compliance";
import {
  InspectorActionCard,
  InspectorActions,
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

function toTone(value?: string | null) {
  const tone = complianceTone(value ?? "");
  return tone === "bad" ? "danger" : tone === "warn" ? "warning" : tone === "good" ? "success" : "primary";
}

export default async function InspectorCompliancePage() {
  const { profile } = await requireRole(["inspector"]);
  const result = await safeAdminData("inspector compliance", async () => {
    const supabase = await createClient();
    const [inspectorRes, gardensRes] = await Promise.all([
      supabase.from("inspectors" as any).select("profile_photo_url").eq("id", profile.id).maybeSingle(),
      supabase.from("gardens" as any).select("id,name,city").eq("inspector_id", profile.id)
    ]);
    logSupabaseError("inspector compliance gardens", gardensRes.error);
    const gardenIds = ((gardensRes.data ?? []) as any[]).map((garden) => garden.id);
    const [alertsRes, actionsRes, findingsRes, requiredRes] = gardenIds.length ? await Promise.all([
      supabase.from("compliance_alerts" as any).select("id,garden_id,title,severity,alert_status,due_at,expiration_date,gardens(name,city)").in("garden_id", gardenIds).in("alert_status", ["open", "in_progress"]).order("due_at", { ascending: true }).limit(120),
      supabase.from("compliance_corrective_actions" as any).select("id,garden_id,action_title,status,priority,due_at,gardens(name,city)").in("garden_id", gardenIds).in("status", ["identified", "assigned", "in_progress", "ready_for_verification"]).order("due_at", { ascending: true }).limit(120),
      supabase.from("national_compliance_findings" as any).select("id,garden_id,title,severity,resolution_status,due_at,gardens(name,city)").in("garden_id", gardenIds).in("resolution_status", ["open", "in_progress", "resolved"]).order("due_at", { ascending: true }).limit(120),
      supabase.from("required_inspections" as any).select("id,garden_id,status,due_at,gardens(name,city)").in("garden_id", gardenIds).neq("status", "done").order("due_at", { ascending: true }).limit(120)
    ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
    [alertsRes, actionsRes, findingsRes, requiredRes].forEach((res, index) => logSupabaseError(`inspector compliance ${index}`, (res as any).error));
    const alerts = (alertsRes.data ?? []) as any[];
    const actions = (actionsRes.data ?? []) as any[];
    const findings = (findingsRes.data ?? []) as any[];
    const required = (requiredRes.data ?? []) as any[];
    const score = buildComplianceScore({
      totalDocuments: alerts.length,
      invalidDocuments: alerts.filter((a) => a.severity === "critical").length,
      expiringDocuments: alerts.length,
      totalStaff: 0,
      staffIssues: 0,
      overdueInspections: required.filter((item) => item.due_at && new Date(item.due_at).getTime() < Date.now()).length,
      unresolvedFindings: findings.filter((item) => item.resolution_status !== "verified").length,
      missingProcedures: 0,
      policyGaps: 0
    });
    return { gardens: gardensRes.data ?? [], alerts, actions, findings, required, score, profilePhoto: (inspectorRes.data as any)?.profile_photo_url ?? null, queryError: gardensRes.error ? "לא ניתן לטעון גנים משויכים" : null };
  }, { gardens: [] as any[], alerts: [] as any[], actions: [] as any[], findings: [] as any[], required: [] as any[], score: buildComplianceScore({ totalDocuments: 0, invalidDocuments: 0, expiringDocuments: 0, totalStaff: 0, staffIssues: 0, overdueInspections: 0, unresolvedFindings: 0, missingProcedures: 0, policyGaps: 0 }), profilePhoto: null as string | null, queryError: null as string | null });
  const data = result.data;
  const profileForUi = { ...profile, profile_image_url: data.profilePhoto ?? profile.profile_image_url };

  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/reports" title="ציות ובקרה" subtitle="אימות ממצאים, מסמכים ופעולות תיקון" badge="ציות" backHref="/dashboard/inspector">
      <InspectorHero
        eyebrow="אימות ציות"
        title="סגירת ממצאים בגנים משויכים"
        subtitle="ליקויים, פעולות תיקון, התראות ופיקוחים שממתינים לבדיקה או סגירה מקצועית."
        artwork={<ShieldCheck />}
        action={<Link className="inspector-action-button" href="/dashboard/inspector/violations">ליקויים פתוחים</Link>}
        meta={<><span>{data.gardens.length} גנים</span><span>{data.score.score}/100 ציון ציות</span></>}
      />
      <AdminDataError message={result.error ?? data.queryError} />
      <InspectorMetricGrid columns={4}>
        <InspectorMetricCard label="התראות" value={data.alerts.length} hint="פתוחות" icon={AlertTriangle} tone={data.alerts.length ? "warning" : "success"} />
        <InspectorMetricCard label="פעולות" value={data.actions.length} hint="לתיקון" icon={ClipboardCheck} tone={data.actions.length ? "warning" : "success"} />
        <InspectorMetricCard label="ממצאים" value={data.findings.length} hint="לאימות" icon={FileWarning} tone={data.findings.length ? "warning" : "success"} />
        <InspectorMetricCard label="פיקוחים פתוחים" value={data.required.length} hint="עדיין לא נסגרו" icon={ShieldCheck} tone={data.required.length ? "warning" : "success"} />
      </InspectorMetricGrid>

      <InspectorSection title="ממתין לאימות" subtitle="ממצאים שדורשים סגירה מקצועית" icon={FileWarning}>
        <InspectorList>
          {data.findings.slice(0, 12).map((item: any) => (
            <InspectorRow key={item.id} title={item.title} subtitle={item.gardens?.name ?? "גן"} meta={item.due_at ? new Date(item.due_at).toLocaleDateString("he-IL") : "ללא תאריך"} status={<InspectorStatus tone={toTone(item.severity)}>{item.resolution_status}</InspectorStatus>} />
          ))}
          {data.findings.length === 0 ? <InspectorEmpty title="אין ממצאים פתוחים" text="ממצאים שדורשים אימות יופיעו כאן." icon={ShieldCheck} /> : null}
        </InspectorList>
      </InspectorSection>

      <InspectorSection title="התראות ציות" subtitle="התראות פתוחות בגנים שלך" icon={AlertTriangle}>
        <InspectorList>
          {data.alerts.slice(0, 12).map((alert: any) => (
            <InspectorRow key={alert.id} title={alert.title} subtitle={alert.gardens?.name ?? "גן"} meta={alert.due_at ? new Date(alert.due_at).toLocaleDateString("he-IL") : ""} status={<InspectorStatus tone={toTone(alert.severity)}>{alert.severity}</InspectorStatus>} />
          ))}
          {data.alerts.length === 0 ? <InspectorEmpty title="אין התראות פתוחות" text="כרגע אין פערי ציות שממתינים לטיפול." icon={ShieldCheck} /> : null}
        </InspectorList>
      </InspectorSection>

      <InspectorActions>
        <InspectorActionCard title="פיקוחים" text="ביצוע ודוחות" href="/dashboard/inspector/inspections" icon={ClipboardCheck} />
        <InspectorActionCard title="ליקויים" text="תיקון ואימות" href="/dashboard/inspector/violations" icon={ShieldCheck} />
        <InspectorActionCard title="משימות" text="פעולות פתוחות" href="/dashboard/inspector/tasks" icon={AlertTriangle} />
      </InspectorActions>
    </InspectorAppFrame>
  );
}
