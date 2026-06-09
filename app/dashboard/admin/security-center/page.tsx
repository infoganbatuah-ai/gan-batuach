import Link from "next/link";
import { AlertTriangle, ArchiveRestore, Bug, Camera, FileCheck2, KeyRound, LockKeyhole, Route, Scale, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { auditTone, buildExternalSecurityAuditSummary, securityAuditPrinciples } from "@/lib/domain/external-security-audit";

function severityTone(severity?: string | null) {
  if (severity === "critical" || severity === "high") return "bad";
  if (severity === "medium") return "warn";
  return "default";
}

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    discovered: "התגלה",
    assigned: "שויך",
    fixed: "תוקן",
    verified: "אומת",
    open: "פתוח",
    in_progress: "בטיפול",
    resolved: "נפתר",
    accepted_risk: "סיכון מאושר",
    false_positive: "לא ממצא"
  };
  return labels[String(status ?? "")] ?? status ?? "לא ידוע";
}

export default async function AdminSecurityCommandCenterPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("external security command center", async () => {
    const supabase = await createClient();
    const [auditReviewsRes, findingsRes, rlsRes, apiRes, checklistRes, recoveryRes, checksRes, secretsRes, backupsRes, auditCatalogRes] = await Promise.all([
      supabase.from("external_security_audit_reviews" as any).select("*").order("severity").order("category"),
      supabase.from("security_findings" as any).select("*").order("severity").order("detected_at", { ascending: false }).limit(300),
      supabase.from("rls_audit_report" as any).select("*").order("risk_level").order("table_name"),
      supabase.from("api_security_audit_report" as any).select("*").order("risk_level").order("route_path"),
      supabase.from("penetration_test_checklist" as any).select("*").order("severity").order("test_area"),
      supabase.from("security_recovery_procedures" as any).select("*").order("recovery_area"),
      supabase.from("security_readiness_checks" as any).select("*").order("severity").order("category"),
      supabase.from("security_secret_inventory" as any).select("id,secret_key,secret_type,location,required,server_only,rotation_status,readiness_status,notes").order("required", { ascending: false }),
      supabase.from("backup_readiness_checks" as any).select("*").order("backup_type"),
      supabase.from("audit_event_catalog" as any).select("*").order("category")
    ]);
    [auditReviewsRes, findingsRes, rlsRes, apiRes, checklistRes, recoveryRes, checksRes, secretsRes, backupsRes, auditCatalogRes].forEach((query, index) => logSupabaseError(`external security query ${index}`, (query as any).error));
    const auditReviews = (auditReviewsRes.data ?? []) as any[];
    const findings = (findingsRes.data ?? []) as any[];
    const rlsReports = (rlsRes.data ?? []) as any[];
    const apiReports = (apiRes.data ?? []) as any[];
    const penetrationTests = (checklistRes.data ?? []) as any[];
    const recoveryProcedures = (recoveryRes.data ?? []) as any[];
    const securityChecks = (checksRes.data ?? []) as any[];
    const secrets = (secretsRes.data ?? []) as any[];
    const backups = (backupsRes.data ?? []) as any[];
    return {
      auditReviews,
      findings,
      rlsReports,
      apiReports,
      penetrationTests,
      recoveryProcedures,
      securityChecks,
      secrets,
      backups,
      auditCatalog: (auditCatalogRes.data ?? []) as any[],
      summary: buildExternalSecurityAuditSummary({ auditReviews, findings, rlsReports, apiReports, penetrationTests, recoveryProcedures, securityChecks, secrets, backups }),
      queryError: [auditReviewsRes.error, findingsRes.error, rlsRes.error, apiRes.error, checklistRes.error, recoveryRes.error, checksRes.error, secretsRes.error, backupsRes.error, auditCatalogRes.error].some(Boolean) ? "חלק מנתוני מרכז האבטחה לא נטענו. ייתכן שהמיגרציה עדיין לא הורצה." : null
    };
  }, {
    auditReviews: [] as any[],
    findings: [] as any[],
    rlsReports: [] as any[],
    apiReports: [] as any[],
    penetrationTests: [] as any[],
    recoveryProcedures: [] as any[],
    securityChecks: [] as any[],
    secrets: [] as any[],
    backups: [] as any[],
    auditCatalog: [] as any[],
    summary: buildExternalSecurityAuditSummary(),
    queryError: null as string | null
  });
  const { summary } = result.data;
  const unresolvedFindings = result.data.findings.filter((finding: any) => !["resolved", "false_positive", "accepted_risk"].includes(String(finding.status)));
  const topFindings = unresolvedFindings.slice(0, 10);
  const criticalOrHighTests = result.data.penetrationTests.filter((test: any) => ["critical", "high"].includes(test.severity)).slice(0, 10);

  return (
    <DashboardShell role="admin" title="Security Command Center">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="External Security Audit"
          title="מרכז פיקוד אבטחה"
          subtitle="תמונת מוכנות חיצונית כאילו כבר מחוברים גנים, הורים, ילדים, מצלמות ותצפיתן. המטרה: הקשחה, ראיות וסיכון נמוך לפני לקוחות אמיתיים."
          badge={`${summary.readinessScore}/100`}
          badgeTone={auditTone(summary.readinessScore)}
          actions={<><Link className="button primary" href="/dashboard/admin/audit-logs">יומן פעולות</Link><Link className="button secondary" href="/dashboard/admin/security">Security</Link></>}
        >
          <div className="setup-checklist">
            {securityAuditPrinciples.slice(0, 3).map((item) => <span key={item}>{item}</span>)}
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error ?? result.data.queryError} />

        <div className="premium-metric-grid">
          <RoleMetricCard label="Critical" value={summary.criticalFindings} hint="ממצאים פתוחים" tone={summary.criticalFindings ? "bad" : "good"} />
          <RoleMetricCard label="High" value={summary.highFindings} hint="ממצאים פתוחים" tone={summary.highFindings ? "bad" : "good"} />
          <RoleMetricCard label="Medium" value={summary.mediumFindings} hint="ממצאים פתוחים" tone={summary.mediumFindings ? "warn" : "good"} />
          <RoleMetricCard label="Low" value={summary.lowFindings} hint="ממצאים פתוחים" />
          <RoleMetricCard label="Resolved" value={summary.resolvedFindings} hint="נפתר / אושר" tone="good" />
          <RoleMetricCard label="RLS" value={`${summary.rlsScore}%`} hint="סקופ טבלאות" tone={auditTone(summary.rlsScore)} />
          <RoleMetricCard label="API" value={`${summary.apiScore}%`} hint="Auth, scope, secrets" tone={auditTone(summary.apiScore)} />
          <RoleMetricCard label="Secrets" value={`${summary.secretsScore}%`} hint="Server-only" tone={auditTone(summary.secretsScore)} />
        </div>

        <CleanSection title="ממצאים פתוחים" subtitle="תור העבודה להקשחה לפני בדיקת חוקר חיצוני.">
          {topFindings.length === 0 ? <EmptyState title="אין ממצאים פתוחים" text="כאשר יתגלה ממצא הוא יופיע כאן לפי חומרה." /> : (
            <div className="procedure-list">
              {topFindings.map((finding: any) => (
                <article className="card procedure-card" key={finding.id}>
                  <div>
                    <StatusBadge tone={severityTone(finding.severity)}>{finding.severity}</StatusBadge>
                    <StatusBadge tone={auditTone(finding.external_audit_status)}>{statusLabel(finding.external_audit_status)}</StatusBadge>
                    <h3>{finding.title}</h3>
                    <p>{finding.impact ?? finding.affected_area}</p>
                    <small>תיקון: {finding.remediation ?? "לא צוין"}</small>
                  </div>
                  <div className="procedure-meta">
                    <span>{finding.category}</span>
                    <StatusBadge tone={auditTone(finding.verification_status)}>{finding.verification_status}</StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><ShieldCheck size={20} /> Audit domains</h2>
            <div className="procedure-list compact-list">
              {result.data.auditReviews.map((review: any) => (
                <div className="mini-row" key={review.audit_key}>
                  <span>{review.title}</span>
                  <strong>{review.readiness_score}/100</strong>
                  <small>{review.category} · {review.evidence_summary}</small>
                </div>
              ))}
            </div>
          </article>
          <article className="card action-panel">
            <h2><LockKeyhole size={20} /> Security score factors</h2>
            <div className="risk-list">
              <div>Authentication / Authorization <b>{summary.authScore}%</b></div>
              <div>RLS <b>{summary.rlsScore}%</b></div>
              <div>API Security <b>{summary.apiScore}%</b></div>
              <div>Secrets <b>{summary.secretsScore}%</b></div>
              <div>Backups <b>{summary.backupScore}%</b></div>
              <div>Compliance <b>{summary.complianceScore}%</b></div>
            </div>
          </article>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <h2><FileCheck2 size={20} /> RLS audit report</h2>
            {result.data.rlsReports.length === 0 ? <div className="empty-mini">אין RLS report.</div> : result.data.rlsReports.map((report: any) => (
              <div className="list-item" key={report.report_key}>
                <div><strong>{report.table_name}</strong><span>{report.evidence_summary}</span></div>
                <StatusBadge tone={auditTone(report.risk_level)}>{report.scope_status}</StatusBadge>
              </div>
            ))}
          </article>
          <article className="card action-panel">
            <h2><Route size={20} /> API security report</h2>
            {result.data.apiReports.length === 0 ? <div className="empty-mini">אין API report.</div> : result.data.apiReports.map((report: any) => (
              <div className="list-item" key={report.route_key}>
                <div><strong>{report.route_path}</strong><span>{report.evidence_summary}</span></div>
                <StatusBadge tone={auditTone(report.risk_level)}>{report.auth_status}</StatusBadge>
              </div>
            ))}
          </article>
        </section>

        <section className="grid cols-3 dashboard-panels">
          <article className="card action-panel">
            <h2><Camera size={20} /> Camera security</h2>
            <div className="setup-checklist">
              <span>RTSP מוסתר מהדפדפן</span>
              <span>סיסמאות נשמרות בצד שרת</span>
              <span>Gateway secrets ב-env בלבד</span>
              <span>Playback דורש הרשאה ו-token</span>
              <span>צפייה נרשמת ב-Audit</span>
            </div>
          </article>
          <article className="card action-panel">
            <h2><Scale size={20} /> Compliance</h2>
            <div className="setup-checklist">
              <span>Privacy policy: דורש סיום</span>
              <span>Terms: דורש סיום</span>
              <span>Camera consent: דורש ייעוץ משפטי</span>
              <span>Child data: הגנה מוגברת</span>
              <span>Retention: לא למחוק אוטומטית בלי מדיניות</span>
            </div>
          </article>
          <article className="card action-panel">
            <h2><ArchiveRestore size={20} /> Recovery</h2>
            <div className="risk-list">
              <div>Recovery readiness <b>{summary.recoveryReadyPercent}%</b></div>
              <div>Backup readiness <b>{summary.backupScore}%</b></div>
              <div>Runbooks <b>{result.data.recoveryProcedures.length}</b></div>
              <div>Restore dry run <b>נדרש</b></div>
            </div>
          </article>
        </section>

        <CleanSection title="Penetration testing checklist" subtitle="בדיקות שחוקר חיצוני צריך לבצע עם ראיות.">
          {criticalOrHighTests.length === 0 ? <EmptyState title="אין checklist" text="לאחר הרצת המיגרציה יופיעו בדיקות חדירה." /> : (
            <div className="procedure-list">
              {criticalOrHighTests.map((test: any) => (
                <article className="card procedure-card" key={test.checklist_key}>
                  <div>
                    <StatusBadge tone={severityTone(test.severity)}>{test.severity}</StatusBadge>
                    <h3>{test.title}</h3>
                    <p>{test.instructions}</p>
                    <small>תוצאה צפויה: {test.expected_result}</small>
                  </div>
                  <div className="procedure-meta"><StatusBadge tone={auditTone(test.status)}>{test.status}</StatusBadge><span>{test.test_area}</span></div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="quick-actions-grid">
          <ActionCard title="Audit logs" text="פעולות מערכת וראיות" href="/dashboard/admin/audit-logs" icon={FileCheck2} />
          <ActionCard title="Camera deployment" text="RTSP, Gateway והרשאות" href="/dashboard/admin/camera-deployment" icon={Camera} />
          <ActionCard title="Observer calibration" text="ללא החלטות אוטומטיות" href="/dashboard/admin/observer-calibration" icon={ShieldCheck} />
          <ActionCard title="Launch readiness" text="חסמים לפני פיילוט" href="/dashboard/admin/launch-readiness" icon={Bug} />
          <ActionCard title="Security classic" text="מרכז אבטחה פנימי" href="/dashboard/admin/security" icon={AlertTriangle} />
          <ActionCard title="Integrations" text="ספקים וסודות" href="/dashboard/admin/integrations" icon={KeyRound} />
        </section>
      </div>
    </DashboardShell>
  );
}
