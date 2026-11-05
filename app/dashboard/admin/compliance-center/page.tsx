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
  try {
    const { count, error } = await supabase.from(table as any).select("id", { count: "exact", head: true });
    logSupabaseError(`compliance count ${table}`, error);
    return { count: error ? null : count ?? 0, available: !error };
  } catch {
    logSupabaseError(`compliance count ${table}`, true);
    return { count: null, available: false };
  }
}

async function countFiltered(supabase: SupabaseServerClient, table: string, apply: (query: any) => any) {
  try {
    const { count, error } = await apply(supabase.from(table as any).select("id", { count: "exact", head: true }));
    logSupabaseError(`compliance count ${table}`, error);
    return { count: error ? null : count ?? 0, available: !error };
  } catch {
    logSupabaseError(`compliance count ${table}`, true);
    return { count: null, available: false };
  }
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
      totalDocumentsRes,
      invalidDocumentsRes,
      expiringDocumentsRes,
      totalStaffRes,
      staffIssuesRes,
      overdueInspectionsRes,
      unresolvedFindingsRes,
      missingProceduresRes,
      policyGapsRes,
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
      ...[
        async () => supabase.from("compliance_requirements" as any).select("*").eq("active", true).order("category"),
        async () => supabase.from("compliance_alerts" as any).select("id,garden_id,staff_id,category,title,severity,alert_status,due_at,expiration_date,warning_bucket,gardens(name,city)").in("alert_status", ["open", "in_progress"]).order("expiration_date", { ascending: true }).limit(120),
        async () => supabase.from("compliance_corrective_actions" as any).select("id,garden_id,action_title,status,priority,due_at,gardens(name,city)").not("status", "in", "(verified,closed,cancelled)").order("due_at", { ascending: true }).limit(120),
        async () => supabase.from("documents" as any).select("id,garden_id,staff_id,child_id,name,document_type,status,expires_at,gardens(name,city),staff(full_name)").order("expires_at", { ascending: true }).limit(120),
        async () => supabase.from("staff" as any).select("id,garden_id,full_name,background_check_status,police_clearance_status,approved_to_work,gardens(name,city)").limit(160),
        async () => supabase.from("gardens" as any).select("id,name,city,status,last_inspection_score,safe_status").limit(300),
        async () => supabase.from("national_compliance_findings" as any).select("id,garden_id,title,severity,resolution_status,due_at,gardens(name,city)").in("resolution_status", ["open", "in_progress"]).order("due_at", { ascending: true }).limit(120),
        async () => supabase.from("compliance_score_snapshots" as any).select("*").order("calculated_at", { ascending: false }).limit(80),
        async () => supabase.from("compliance_report_requests" as any).select("*").order("created_at", { ascending: false }).limit(40)
      ].map(async (query, index) => {
        try {
          const result = await query();
          logSupabaseError(`compliance query ${index}`, result.error);
          return { data: result.error ? [] : result.data ?? [], available: !result.error };
        } catch {
          logSupabaseError(`compliance query ${index}`, true);
          return { data: [], available: false };
        }
      })
    ]);
    // Numeric placeholders serve the unchanged component formulas only; display
    // eligibility always comes from the independent count availability below.
    const totalDocuments = totalDocumentsRes.count ?? 0;
    const invalidDocuments = invalidDocumentsRes.count ?? 0;
    const expiringDocuments = expiringDocumentsRes.count ?? 0;
    const totalStaff = totalStaffRes.count ?? 0;
    const staffIssues = staffIssuesRes.count ?? 0;
    const overdueInspections = overdueInspectionsRes.count ?? 0;
    const unresolvedFindings = unresolvedFindingsRes.count ?? 0;
    const missingProcedures = missingProceduresRes.count ?? 0;
    const policyGaps = policyGapsRes.count ?? 0;
    const availability = { totalDocuments: totalDocumentsRes.available, invalidDocuments: invalidDocumentsRes.available, expiringDocuments: expiringDocumentsRes.available, totalStaff: totalStaffRes.available, staffIssues: staffIssuesRes.available, overdueInspections: overdueInspectionsRes.available, unresolvedFindings: unresolvedFindingsRes.available, missingProcedures: missingProceduresRes.available, policyGaps: policyGapsRes.available, requirements: requirementsRes.available, alerts: alertsRes.available, actions: actionsRes.available, documents: documentsRes.available, staff: staffRes.available, gardens: gardensRes.available, findings: findingsRes.available, snapshots: snapshotsRes.available, reports: reportsRes.available };
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
    const criticalAlerts = availability.alerts && availability.documents ? alerts.filter((alert) => alert.severity === "critical").length + documents.filter((doc) => expirationBucket(doc.expires_at) === "expired").length : null;
    const rankingAvailable = availability.alerts && availability.documents && availability.staff && availability.gardens && availability.findings;
    const gardenScores = rankingAvailable ? gardens.map((garden) => {
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
    }).sort((a, b) => a.score - b.score) : [];
    return { totalDocuments, invalidDocuments, expiringDocuments, totalStaff, staffIssues, overdueInspections, unresolvedFindings, requirements, alerts, actions, documents, staff, findings, snapshots, reports, score, criticalAlerts, gardenScores, availability, queryError: Object.values(availability).some((available) => !available) ? "חלק מנתוני הציות לא נטענו" : null };
  }, { totalDocuments: 0, invalidDocuments: 0, expiringDocuments: 0, totalStaff: 0, staffIssues: 0, overdueInspections: 0, unresolvedFindings: 0, requirements: [] as any[], alerts: [] as any[], actions: [] as any[], documents: [] as any[], staff: [] as any[], findings: [] as any[], snapshots: [] as any[], reports: [] as any[], score: buildComplianceScore({ totalDocuments: 0, invalidDocuments: 0, expiringDocuments: 0, totalStaff: 0, staffIssues: 0, overdueInspections: 0, unresolvedFindings: 0, missingProcedures: 0, policyGaps: 0 }), criticalAlerts: 0, gardenScores: [] as any[], availability: { totalDocuments: false, invalidDocuments: false, expiringDocuments: false, totalStaff: false, staffIssues: false, overdueInspections: false, unresolvedFindings: false, missingProcedures: false, policyGaps: false, requirements: false, alerts: false, actions: false, documents: false, staff: false, gardens: false, findings: false, snapshots: false, reports: false }, queryError: null as string | null });

  const data = result.data;
  const available = data.availability;
  const unavailable = "לא זמין";
  const nationalAvailable = available.totalDocuments && available.invalidDocuments && available.expiringDocuments && available.totalStaff && available.staffIssues && available.overdueInspections && available.unresolvedFindings && available.missingProcedures && available.policyGaps;
  const documentsRatioAvailable = available.totalDocuments && available.invalidDocuments;
  const documentsScoreAvailable = documentsRatioAvailable && available.expiringDocuments;
  const staffScoreAvailable = available.totalStaff && available.staffIssues;
  const proceduresScoreAvailable = available.missingProcedures && available.policyGaps;
  const criticalAvailable = available.alerts && available.documents;
  const rankingAvailable = available.alerts && available.documents && available.staff && available.gardens && available.findings;
  return (
    <DashboardShell role="admin" title="Compliance Center">
      <div className="commercial-dashboard compliance-center-shell">
        <PremiumDashboardHero eyebrow="Smart Compliance" title="מרכז ציות חכם" subtitle="מעקב יזום אחרי רישיונות, ביטוחים, תעודות צוות, נהלים, מסמכים, פיקוחים וליקויים לפני שהם הופכים לבעיה." badge={nationalAvailable ? `${data.score.score}/100` : unavailable} badgeTone={nationalAvailable ? data.score.tone : "default"} actions={<><Link className="button primary" href="/dashboard/admin/documents">מסמכים</Link><Link className="button secondary" href="/dashboard/admin/national-inspections">פיקוח ארצי</Link></>}>
          <div className="setup-checklist"><span>זיהוי מוקדם</span><span>פעולות תיקון</span><span>דוחות ציות</span></div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? data.queryError} />
        <section className="grid cols-4 dashboard-kpis">
          <RoleMetricCard label="ציון ציות" value={nationalAvailable ? `${data.score.score}/100` : unavailable} hint="לאומי" tone={nationalAvailable ? data.score.tone : "default"} />
          <RoleMetricCard label="קריטי" value={criticalAvailable ? data.criticalAlerts : unavailable} hint="פג תוקף / דחוף" tone={criticalAvailable ? data.criticalAlerts ? "bad" : "good" : "default"} />
          <RoleMetricCard label="עומד לפוג" value={available.expiringDocuments ? data.expiringDocuments : unavailable} hint="90 ימים" tone={available.expiringDocuments ? data.expiringDocuments ? "warn" : "good" : "default"} />
          <RoleMetricCard label="פעולות פתוחות" value={available.actions ? data.actions.length : unavailable} hint="תיקון ואימות" tone={available.actions ? data.actions.length ? "warn" : "good" : "default"} />
          <RoleMetricCard label="מסמכים" value={documentsRatioAvailable ? `${data.totalDocuments - data.invalidDocuments}/${data.totalDocuments}` : unavailable} hint="תקינים" tone={documentsRatioAvailable ? data.invalidDocuments ? "warn" : "good" : "default"} />
          <RoleMetricCard label="צוות" value={staffScoreAvailable ? `${data.totalStaff - data.staffIssues}/${data.totalStaff}` : unavailable} hint="מוכן לעבודה" tone={staffScoreAvailable ? data.staffIssues ? "warn" : "good" : "default"} />
          <RoleMetricCard label="פיקוח" value={available.overdueInspections ? `${data.score.inspectionsScore}%` : unavailable} hint={available.overdueInspections ? `${data.overdueInspections} באיחור` : unavailable} tone={available.overdueInspections ? complianceTone(data.score.inspectionsScore) : "default"} />
          <RoleMetricCard label="ליקויים" value={available.unresolvedFindings ? data.unresolvedFindings : unavailable} hint="פתוחים" tone={available.unresolvedFindings ? data.unresolvedFindings ? "warn" : "good" : "default"} />
        </section>

        <section className="compliance-score-grid">
          <article><FileText /><span>מסמכים</span><strong>{documentsScoreAvailable ? `${data.score.documentsScore}%` : unavailable}</strong></article>
          <article><UserCheck /><span>צוות</span><strong>{staffScoreAvailable ? `${data.score.staffScore}%` : unavailable}</strong></article>
          <article><ClipboardCheck /><span>פיקוחים</span><strong>{available.overdueInspections ? `${data.score.inspectionsScore}%` : unavailable}</strong></article>
          <article><AlertTriangle /><span>ליקויים</span><strong>{available.unresolvedFindings ? `${data.score.findingsScore}%` : unavailable}</strong></article>
          <article><BookOpenCheck /><span>נהלים</span><strong>{proceduresScoreAvailable ? `${data.score.proceduresScore}%` : unavailable}</strong></article>
        </section>

        <CleanSection title="קטגוריות ציות" subtitle="הדרישות שהמערכת עוקבת אחריהן.">
          <div className="compliance-category-grid">{complianceCategories.map((category) => <article key={category}><Award size={18} /><strong>{category}</strong><span>{available.requirements ? `${data.requirements.filter((item: any) => item.category === category).length} דרישות` : unavailable}</span></article>)}</div>
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel"><h2><FileClock size={20} /> התראות קרובות</h2>{!available.alerts ? <div className="empty-mini">{unavailable}</div> : data.alerts.length === 0 ? <div className="empty-mini">אין התראות ציות פתוחות.</div> : data.alerts.slice(0, 8).map((alert: any) => <div className="list-item" key={alert.id}><div><strong>{alert.title}</strong><span>{alert.gardens?.name ?? "גן"} · {bucketLabel(alert.warning_bucket ?? expirationBucket(alert.expiration_date))}</span></div><StatusBadge tone={complianceTone(alert.severity)}>{alert.severity}</StatusBadge></div>)}</article>
          <article className="card action-panel"><h2><ShieldCheck size={20} /> פעולות תיקון</h2>{!available.actions ? <div className="empty-mini">{unavailable}</div> : data.actions.length === 0 ? <div className="empty-mini">אין פעולות תיקון פתוחות.</div> : data.actions.slice(0, 8).map((action: any) => <div className="list-item" key={action.id}><div><strong>{action.action_title}</strong><span>{action.gardens?.name ?? "גן"} · {action.due_at ? new Date(action.due_at).toLocaleDateString("he-IL") : "ללא תאריך"}</span></div><StatusBadge tone={complianceTone(action.priority)}>{action.status}</StatusBadge></div>)}</article>
        </section>

        <CleanSection title="גנים בסיכון ציות" subtitle="הגנים עם הציון הנמוך ביותר מקבלים קדימות.">
          {!rankingAvailable ? <div className="empty-mini">{unavailable}</div> : data.gardenScores.length === 0 ? <EmptyState title="אין גנים להצגה" text="כשיהיו נתוני גנים, יוצג דירוג ציות." /> : <div className="compliance-risk-list">{data.gardenScores.slice(0, 10).map((garden: any) => <Link href={`/dashboard/admin/gardens/${garden.id}`} key={garden.id}><div><strong>{garden.name}</strong><span>{garden.city} · {garden.alerts} התראות · {garden.findings} ליקויים · {garden.staffIssues} בעיות צוות</span></div><StatusBadge tone={complianceTone(garden.score)}>{garden.score}/100</StatusBadge></Link>)}</div>}
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
