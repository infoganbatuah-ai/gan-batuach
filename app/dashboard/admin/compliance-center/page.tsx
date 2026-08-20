import Link from "next/link";
import { AlertTriangle, Award, BookOpenCheck, ClipboardCheck, FileClock, FileText, GraduationCap, ShieldCheck, UserCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildComplianceScore, complianceCategories, complianceTone, expirationBucket } from "@/lib/domain/smart-compliance";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function countRows(supabase: SupabaseServerClient, table: string) {
  const { count, error } = await supabase.from(table as any).select("id", { count: "exact", head: true });
  logSupabaseError(`compliance count ${table}`, error);
  return error ? 0 : count ?? 0;
}

async function countFiltered(supabase: SupabaseServerClient, table: string, apply: (query: any) => any) {
  const { count, error } = await apply(supabase.from(table as any).select("id", { count: "exact", head: true }));
  logSupabaseError(`compliance count ${table}`, error);
  return error ? 0 : count ?? 0;
}

function bucketLabel(bucket: string) {
  const labels: Record<string, string> = {
    expired: "פג תוקף",
    "7_days": "7 ימים",
    "14_days": "14 ימים",
    "30_days": "30 ימים",
    "60_days": "60 ימים",
    "90_days": "90 ימים",
    future: "עתידי",
    no_date: "ללא תאריך"
  };
  return labels[bucket] ?? bucket;
}

export default async function AdminComplianceCenterPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("compliance center", async () => {
    const supabase = await createClient();
    const nowIso = new Date().toISOString();
    const ninetyDays = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const [
      totalDocuments,
      invalidDocuments,
      expiringDocuments,
      totalStaff,
      staffIssues,
      overdueInspections,
      unresolvedFindings,
      missingProcedures,
      policyGaps,
      requirementsRes,
      alertsRes,
      actionsRes,
      documentsRes,
      staffRes,
      gardensRes,
      findingsRes,
      snapshotsRes,
      reportsRes
    ] = await Promise.all([
      countRows(supabase, "documents"),
      countFiltered(supabase, "documents", (query) => query.in("status", ["missing", "required", "expired", "rejected"])),
      countFiltered(supabase, "documents", (query) => query.lte("expires_at", ninetyDays).not("expires_at", "is", null)),
      countRows(supabase, "staff"),
      countFiltered(supabase, "staff", (query) => query.or("approved_to_work.eq.false,background_check_status.neq.valid,police_clearance_status.neq.valid")),
      countFiltered(supabase, "required_inspections", (query) => query.lt("due_at", nowIso).neq("status", "done")),
      countFiltered(supabase, "national_compliance_findings", (query) => query.in("resolution_status", ["open", "in_progress"])),
      countFiltered(supabase, "mandatory_procedures", (query) => query.eq("active", true).eq("required", true)),
      countFiltered(supabase, "policies", (query) => query.eq("active", true).not("published_at", "is", null)),
      supabase.from("compliance_requirements" as any).select("*").eq("active", true).order("category"),
      supabase.from("compliance_alerts" as any).select("id,garden_id,staff_id,category,title,severity,alert_status,due_at,expiration_date,warning_bucket,gardens(name,city)").in("alert_status", ["open", "in_progress"]).order("expiration_date", { ascending: true }).limit(120),
      supabase.from("compliance_corrective_actions" as any).select("id,garden_id,action_title,status,priority,due_at,gardens(name,city)").not("status", "in", "(verified,closed,cancelled)").order("due_at", { ascending: true }).limit(120),
      supabase.from("documents" as any).select("id,garden_id,staff_id,child_id,name,document_type,status,expires_at,gardens(name,city),staff(full_name)").order("expires_at", { ascending: true }).limit(120),
      supabase.from("staff" as any).select("id,garden_id,full_name,background_check_status,police_clearance_status,approved_to_work,gardens(name,city)").limit(160),
      supabase.from("gardens" as any).select("id,name,city,status,last_inspection_score,safe_status").limit(300),
      supabase.from("national_compliance_findings" as any).select("id,garden_id,title,severity,resolution_status,due_at,gardens(name,city)").in("resolution_status", ["open", "in_progress"]).order("due_at", { ascending: true }).limit(120),
      supabase.from("compliance_score_snapshots" as any).select("*").order("calculated_at", { ascending: false }).limit(80),
      supabase.from("compliance_report_requests" as any).select("*").order("created_at", { ascending: false }).limit(40)
    ]);
    [requirementsRes, alertsRes, actionsRes, documentsRes, staffRes, gardensRes, findingsRes, snapshotsRes, reportsRes].forEach((query, index) => logSupabaseError(`compliance query ${index}`, (query as any).error));
    const requirements = (requirementsRes.data ?? []) as any[];
    const alerts = (alertsRes.data ?? []) as any[];
    const actions = (actionsRes.data ?? []) as any[];
    const documents = (documentsRes.data ?? []) as any[];
    const staff = (staffRes.data ?? []) as any[];
    const gardens = (gardensRes.data ?? []) as any[];
    const findings = (findingsRes.data ?? []) as any[];
    const snapshots = (snapshotsRes.data ?? []) as any[];
    const reports = (reportsRes.data ?? []) as any[];
    const score = buildComplianceScore({ totalDocuments, invalidDocuments, expiringDocuments, totalStaff, staffIssues, overdueInspections, unresolvedFindings, missingProcedures: Math.max(0, missingProcedures - 1), policyGaps: Math.max(0, 4 - policyGaps) });
    const criticalAlerts = alerts.filter((alert) => alert.severity === "critical").length + documents.filter((doc) => expirationBucket(doc.expires_at) === "expired").length;
    const gardenScores = gardens.map((garden) => {
      const gardenDocs = documents.filter((doc) => doc.garden_id === garden.id);
      const gardenStaff = staff.filter((member) => member.garden_id === garden.id);
      const gardenFindings = findings.filter((finding) => finding.garden_id === garden.id);
      const gardenAlerts = alerts.filter((alert) => alert.garden_id === garden.id);
      const gardenScore = buildComplianceScore({
        totalDocuments: gardenDocs.length,
        invalidDocuments: gardenDocs.filter((doc) => ["missing", "required", "expired", "rejected"].includes(String(doc.status))).length,
        expiringDocuments: gardenDocs.filter((doc) => ["expired", "7_days", "14_days", "30_days", "60_days", "90_days"].includes(expirationBucket(doc.expires_at))).length,
        totalStaff: gardenStaff.length,
        staffIssues: gardenStaff.filter((member) => !member.approved_to_work || member.background_check_status !== "valid" || member.police_clearance_status !== "valid").length,
        overdueInspections: 0,
        unresolvedFindings: gardenFindings.length + gardenAlerts.length,
        missingProcedures: 0,
        policyGaps: 0
      });
      return { ...garden, score: gardenScore.score, alerts: gardenAlerts.length, findings: gardenFindings.length, docs: gardenDocs.length, staffIssues: gardenStaff.filter((member) => !member.approved_to_work || member.background_check_status !== "valid" || member.police_clearance_status !== "valid").length };
    }).sort((a, b) => a.score - b.score);
    return { totalDocuments, invalidDocuments, expiringDocuments, totalStaff, staffIssues, overdueInspections, unresolvedFindings, requirements, alerts, actions, documents, staff, findings, snapshots, reports, score, criticalAlerts, gardenScores, queryError: [requirementsRes.error, alertsRes.error, actionsRes.error].some(Boolean) ? "חלק מנתוני הציות לא נטענו. ייתכן שהמיגרציה עדיין לא הורצה." : null };
  }, { totalDocuments: 0, invalidDocuments: 0, expiringDocuments: 0, totalStaff: 0, staffIssues: 0, overdueInspections: 0, unresolvedFindings: 0, requirements: [] as any[], alerts: [] as any[], actions: [] as any[], documents: [] as any[], staff: [] as any[], findings: [] as any[], snapshots: [] as any[], reports: [] as any[], score: buildComplianceScore({ totalDocuments: 0, invalidDocuments: 0, expiringDocuments: 0, totalStaff: 0, staffIssues: 0, overdueInspections: 0, unresolvedFindings: 0, missingProcedures: 0, policyGaps: 0 }), criticalAlerts: 0, gardenScores: [] as any[], queryError: null as string | null });

  const data = result.data;
  return (
    <DashboardShell role="admin" title="Compliance Center">
      <div className="commercial-dashboard compliance-center-shell">
        <PremiumDashboardHero eyebrow="Smart Compliance" title="מרכז ציות חכם" subtitle="מעקב יזום אחרי רישיונות, ביטוחים, תעודות צוות, נהלים, מסמכים, פיקוחים וליקויים לפני שהם הופכים לבעיה." badge={`${data.score.score}/100`} badgeTone={data.score.tone} actions={<><Link className="button primary" href="/dashboard/admin/documents">מסמכים</Link><Link className="button secondary" href="/dashboard/admin/national-inspections">פיקוח ארצי</Link></>}>
          <div className="setup-checklist"><span>זיהוי מוקדם</span><span>פעולות תיקון</span><span>דוחות ציות</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />
        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="ציון ציות" value={`${data.score.score}/100`} hint="לאומי" tone={data.score.tone} />
          <RoleMetricCard label="קריטי" value={data.criticalAlerts} hint="פג תוקף / דחוף" tone={data.criticalAlerts ? "bad" : "good"} />
          <RoleMetricCard label="עומד לפוג" value={data.expiringDocuments} hint="90 ימים" tone={data.expiringDocuments ? "warn" : "good"} />
          <RoleMetricCard label="פעולות פתוחות" value={data.actions.length} hint="תיקון ואימות" tone={data.actions.length ? "warn" : "good"} />
          <RoleMetricCard label="מסמכים" value={`${data.totalDocuments - data.invalidDocuments}/${data.totalDocuments}`} hint="תקינים" tone={data.invalidDocuments ? "warn" : "good"} />
          <RoleMetricCard label="צוות" value={`${data.totalStaff - data.staffIssues}/${data.totalStaff}`} hint="מוכן לעבודה" tone={data.staffIssues ? "warn" : "good"} />
          <RoleMetricCard label="פיקוח" value={`${data.score.inspectionsScore}%`} hint={`${data.overdueInspections} באיחור`} tone={complianceTone(data.score.inspectionsScore)} />
          <RoleMetricCard label="ליקויים" value={data.unresolvedFindings} hint="פתוחים" tone={data.unresolvedFindings ? "warn" : "good"} />
        </section>

        <section className="compliance-score-grid">
          <article><FileText /><span>מסמכים</span><strong>{data.score.documentsScore}%</strong></article>
          <article><UserCheck /><span>צוות</span><strong>{data.score.staffScore}%</strong></article>
          <article><ClipboardCheck /><span>פיקוחים</span><strong>{data.score.inspectionsScore}%</strong></article>
          <article><AlertTriangle /><span>ליקויים</span><strong>{data.score.findingsScore}%</strong></article>
          <article><BookOpenCheck /><span>נהלים</span><strong>{data.score.proceduresScore}%</strong></article>
        </section>

        <CleanSection title="קטגוריות ציות" subtitle="הדרישות שהמערכת עוקבת אחריהן.">
          <div className="compliance-category-grid">{complianceCategories.map((category) => <article key={category}><Award size={18} /><strong>{category}</strong><span>{data.requirements.filter((item: any) => item.category === category).length} דרישות</span></article>)}</div>
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel"><h2><FileClock size={20} /> התראות קרובות</h2>{data.alerts.length === 0 ? <div className="empty-mini">אין התראות ציות פתוחות.</div> : data.alerts.slice(0, 8).map((alert: any) => <div className="list-item" key={alert.id}><div><strong>{alert.title}</strong><span>{alert.gardens?.name ?? "גן"} · {bucketLabel(alert.warning_bucket ?? expirationBucket(alert.expiration_date))}</span></div><StatusBadge tone={complianceTone(alert.severity)}>{alert.severity}</StatusBadge></div>)}</article>
          <article className="card action-panel"><h2><ShieldCheck size={20} /> פעולות תיקון</h2>{data.actions.length === 0 ? <div className="empty-mini">אין פעולות תיקון פתוחות.</div> : data.actions.slice(0, 8).map((action: any) => <div className="list-item" key={action.id}><div><strong>{action.action_title}</strong><span>{action.gardens?.name ?? "גן"} · {action.due_at ? new Date(action.due_at).toLocaleDateString("he-IL") : "ללא תאריך"}</span></div><StatusBadge tone={complianceTone(action.priority)}>{action.status}</StatusBadge></div>)}</article>
        </section>

        <CleanSection title="גנים בסיכון ציות" subtitle="הגנים עם הציון הנמוך ביותר מקבלים קדימות.">
          {data.gardenScores.length === 0 ? <EmptyState title="אין גנים להצגה" text="כשיהיו נתוני גנים, יוצג דירוג ציות." /> : <div className="compliance-risk-list">{data.gardenScores.slice(0, 10).map((garden: any) => <Link href={`/dashboard/admin/gardens/${garden.id}`} key={garden.id}><div><strong>{garden.name}</strong><span>{garden.city} · {garden.alerts} התראות · {garden.findings} ליקויים · {garden.staffIssues} בעיות צוות</span></div><StatusBadge tone={complianceTone(garden.score)}>{garden.score}/100</StatusBadge></Link>)}</div>}
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="מסמכים" text="תוקף ואישור" href="/dashboard/admin/documents" icon={FileText} />
          <ActionCard title="נהלים" text="נהלי חובה" href="/dashboard/admin/procedures" icon={BookOpenCheck} />
          <ActionCard title="מדיניות" text="תקנונים ואישורים" href="/dashboard/admin/policies" icon={ShieldCheck} />
          <ActionCard title="פיקוח ארצי" text="ליקויים והמשך טיפול" href="/dashboard/admin/national-inspections" icon={ClipboardCheck} />
          <ActionCard title="מפקחים" text="אימות וסגירה" href="/dashboard/admin/inspectors" icon={UserCheck} />
          <ActionCard title="דוחות" text="חודשי ושנתי" href="/dashboard/admin/reports" icon={GraduationCap} />
        </section>
      </div>
    </DashboardShell>
  );
}
