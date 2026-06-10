import Link from "next/link";
import { AlertTriangle, BookOpenCheck, ClipboardCheck, FileText, ShieldCheck, UserCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildComplianceScore, complianceTone, expirationBucket } from "@/lib/domain/smart-compliance";

export default async function GardenCompliancePage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  const result = await safeAdminData("garden compliance", async () => {
    const supabase = await createClient();
    const nowIso = new Date().toISOString();
    const ninetyDays = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const [documentsRes, staffRes, alertsRes, actionsRes, findingsRes, inspectionsRes] = await Promise.all([
      supabase.from("documents" as any).select("id,name,document_type,status,expires_at").eq("garden_id", gardenId).order("expires_at", { ascending: true }).limit(120),
      supabase.from("staff" as any).select("id,full_name,background_check_status,police_clearance_status,approved_to_work").eq("garden_id", gardenId).limit(160),
      supabase.from("compliance_alerts" as any).select("*").eq("garden_id", gardenId).in("alert_status", ["open", "in_progress"]).order("expiration_date", { ascending: true }).limit(80),
      supabase.from("compliance_corrective_actions" as any).select("*").eq("garden_id", gardenId).not("status", "in", "(verified,closed,cancelled)").order("due_at", { ascending: true }).limit(80),
      supabase.from("national_compliance_findings" as any).select("*").eq("garden_id", gardenId).in("resolution_status", ["open", "in_progress"]).order("due_at", { ascending: true }).limit(80),
      supabase.from("required_inspections" as any).select("*").eq("garden_id", gardenId).lt("due_at", nowIso).neq("status", "done").limit(20)
    ]);
    [documentsRes, staffRes, alertsRes, actionsRes, findingsRes, inspectionsRes].forEach((res, index) => logSupabaseError(`garden compliance ${index}`, (res as any).error));
    const documents = (documentsRes.data ?? []) as any[];
    const staff = (staffRes.data ?? []) as any[];
    const alerts = (alertsRes.data ?? []) as any[];
    const actions = (actionsRes.data ?? []) as any[];
    const findings = (findingsRes.data ?? []) as any[];
    const overdueInspections = (inspectionsRes.data ?? []) as any[];
    const score = buildComplianceScore({
      totalDocuments: documents.length,
      invalidDocuments: documents.filter((doc) => ["missing", "required", "expired", "rejected"].includes(String(doc.status))).length,
      expiringDocuments: documents.filter((doc) => doc.expires_at && doc.expires_at <= ninetyDays).length,
      totalStaff: staff.length,
      staffIssues: staff.filter((member) => !member.approved_to_work || member.background_check_status !== "valid" || member.police_clearance_status !== "valid").length,
      overdueInspections: overdueInspections.length,
      unresolvedFindings: findings.length + alerts.length,
      missingProcedures: 0,
      policyGaps: 0
    });
    return { documents, staff, alerts, actions, findings, overdueInspections, score, queryError: [documentsRes.error, staffRes.error].some(Boolean) ? "חלק מנתוני הציות לא נטענו" : null };
  }, { documents: [] as any[], staff: [] as any[], alerts: [] as any[], actions: [] as any[], findings: [] as any[], overdueInspections: [] as any[], score: buildComplianceScore({ totalDocuments: 0, invalidDocuments: 0, expiringDocuments: 0, totalStaff: 0, staffIssues: 0, overdueInspections: 0, unresolvedFindings: 0, missingProcedures: 0, policyGaps: 0 }), queryError: null as string | null });
  const data = result.data;
  return <DashboardShell role="manager" title="ציות הגן"><div className="commercial-dashboard compliance-center-shell"><PremiumDashboardHero eyebrow="Compliance" title="מוכנות ציות של הגן" subtitle="מה חסר, מה עומד לפוג ומה צריך תיקון כדי להישאר מוכנים לפיקוח." badge={`${data.score.score}/100`} badgeTone={data.score.tone} actions={<Link className="button primary" href="/dashboard/garden/documents">מסמכים</Link>}><div className="setup-checklist"><span>מסמכים</span><span>צוות</span><span>פיקוח</span></div></PremiumDashboardHero><AdminDataError message={result.error ?? data.queryError} /><section className="grid cols-4 dashboard-kpis"><RoleMetricCard label="ציון" value={`${data.score.score}/100`} tone={data.score.tone} /><RoleMetricCard label="התראות" value={data.alerts.length} tone={data.alerts.length ? "warn" : "good"} /><RoleMetricCard label="פעולות" value={data.actions.length} tone={data.actions.length ? "warn" : "good"} /><RoleMetricCard label="פיקוח באיחור" value={data.overdueInspections.length} tone={data.overdueInspections.length ? "bad" : "good"} /></section><section className="grid cols-2 dashboard-panels"><article className="card action-panel"><h2><AlertTriangle size={20} /> מה דורש טיפול</h2>{data.alerts.length === 0 ? <div className="empty-mini">אין התראות פתוחות.</div> : data.alerts.slice(0, 8).map((alert: any) => <div className="list-item" key={alert.id}><div><strong>{alert.title}</strong><span>{alert.expiration_date ? new Date(alert.expiration_date).toLocaleDateString("he-IL") : alert.category}</span></div><StatusBadge tone={complianceTone(alert.severity)}>{alert.severity}</StatusBadge></div>)}</article><article className="card action-panel"><h2><ShieldCheck size={20} /> פעולות תיקון</h2>{data.actions.length === 0 ? <div className="empty-mini">אין פעולות תיקון.</div> : data.actions.slice(0, 8).map((action: any) => <div className="list-item" key={action.id}><div><strong>{action.action_title}</strong><span>{action.due_at ? new Date(action.due_at).toLocaleDateString("he-IL") : "ללא תאריך"}</span></div><StatusBadge tone={complianceTone(action.priority)}>{action.status}</StatusBadge></div>)}</article></section><CleanSection title="מסמכים ותוקף" subtitle="מסמכים שפגו או עומדים לפוג.">{data.documents.length === 0 ? <EmptyState title="אין מסמכים להצגה" /> : <div className="compliance-risk-list">{data.documents.slice(0, 10).map((doc: any) => <Link href="/dashboard/garden/documents" key={doc.id}><div><strong>{doc.name}</strong><span>{doc.document_type} · {doc.expires_at ? new Date(doc.expires_at).toLocaleDateString("he-IL") : "ללא תוקף"}</span></div><StatusBadge tone={complianceTone(expirationBucket(doc.expires_at))}>{doc.status}</StatusBadge></Link>)}</div>}</CleanSection><section className="quick-actions-grid"><ActionCard title="מסמכים" text="העלאה וחידוש" href="/dashboard/garden/documents" icon={FileText} /><ActionCard title="צוות" text="אישורים והדרכות" href="/dashboard/garden/staff" icon={UserCheck} /><ActionCard title="פיקוחים" text="סטטוס וליקויים" href="/dashboard/garden/inspections" icon={ClipboardCheck} /><ActionCard title="נהלים" text="הנחיות חובה" href="/dashboard/garden/tasks" icon={BookOpenCheck} /></section></div></DashboardShell>;
}
