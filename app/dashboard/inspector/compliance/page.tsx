import Link from "next/link";
import { AlertTriangle, ClipboardCheck, FileWarning, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildComplianceScore, complianceTone } from "@/lib/domain/smart-compliance";

export default async function InspectorCompliancePage() {
  const { profile } = await requireRole(["inspector"]);
  const result = await safeAdminData("inspector compliance", async () => {
    const supabase = await createClient();
    const gardensRes = await supabase.from("gardens" as any).select("id,name,city").eq("inspector_id", profile.id);
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
    const score = buildComplianceScore({ totalDocuments: alerts.length, invalidDocuments: alerts.filter((a) => a.severity === "critical").length, expiringDocuments: alerts.length, totalStaff: 0, staffIssues: 0, overdueInspections: required.filter((item) => item.due_at && new Date(item.due_at).getTime() < Date.now()).length, unresolvedFindings: findings.filter((item) => item.resolution_status !== "verified").length, missingProcedures: 0, policyGaps: 0 });
    return { gardens: gardensRes.data ?? [], alerts, actions, findings, required, score, queryError: gardensRes.error ? "לא ניתן לטעון גנים משויכים" : null };
  }, { gardens: [] as any[], alerts: [] as any[], actions: [] as any[], findings: [] as any[], required: [] as any[], score: buildComplianceScore({ totalDocuments: 0, invalidDocuments: 0, expiringDocuments: 0, totalStaff: 0, staffIssues: 0, overdueInspections: 0, unresolvedFindings: 0, missingProcedures: 0, policyGaps: 0 }), queryError: null as string | null });
  const data = result.data;
  return <DashboardShell role="inspector" title="ציות לפקח"><div className="commercial-dashboard compliance-center-shell"><PremiumDashboardHero eyebrow="Compliance Verification" title="אימות ציות בגנים משויכים" subtitle="ליקויים, פעולות תיקון, התראות ופיקוחים שממתינים לבדיקה או סגירה." badge={`${data.score.score}/100`} badgeTone={data.score.tone} actions={<Link className="button primary" href="/dashboard/inspector/violations">ליקויים</Link>}><div className="setup-checklist"><span>{data.gardens.length} גנים</span><span>אימות אנושי</span><span>סגירת ממצאים</span></div></PremiumDashboardHero><AdminDataError message={result.error ?? data.queryError} /><section className="grid cols-4 dashboard-kpis"><RoleMetricCard label="התראות" value={data.alerts.length} tone={data.alerts.length ? "warn" : "good"} /><RoleMetricCard label="פעולות" value={data.actions.length} tone={data.actions.length ? "warn" : "good"} /><RoleMetricCard label="ממצאים" value={data.findings.length} tone={data.findings.length ? "warn" : "good"} /><RoleMetricCard label="פיקוחים פתוחים" value={data.required.length} tone={data.required.length ? "warn" : "good"} /></section><section className="grid cols-2 dashboard-panels"><article className="card action-panel"><h2><FileWarning size={20} /> ממתין לאימות</h2>{data.findings.length === 0 ? <div className="empty-mini">אין ממצאים פתוחים.</div> : data.findings.slice(0, 8).map((item: any) => <div className="list-item" key={item.id}><div><strong>{item.title}</strong><span>{item.gardens?.name ?? "גן"} · {item.due_at ? new Date(item.due_at).toLocaleDateString("he-IL") : "ללא תאריך"}</span></div><StatusBadge tone={complianceTone(item.severity)}>{item.resolution_status}</StatusBadge></div>)}</article><article className="card action-panel"><h2><AlertTriangle size={20} /> התראות ציות</h2>{data.alerts.length === 0 ? <div className="empty-mini">אין התראות פתוחות.</div> : data.alerts.slice(0, 8).map((alert: any) => <div className="list-item" key={alert.id}><div><strong>{alert.title}</strong><span>{alert.gardens?.name ?? "גן"}</span></div><StatusBadge tone={complianceTone(alert.severity)}>{alert.severity}</StatusBadge></div>)}</article></section><section className="quick-actions-grid"><ActionCard title="פיקוחים" text="ביצוע ודוחות" href="/dashboard/inspector/inspections" icon={ClipboardCheck} /><ActionCard title="ליקויים" text="תיקון ואימות" href="/dashboard/inspector/violations" icon={ShieldCheck} /><ActionCard title="משימות" text="פעולות פתוחות" href="/dashboard/inspector/tasks" icon={AlertTriangle} /></section></div></DashboardShell>;
}
