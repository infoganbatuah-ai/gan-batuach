import Link from "next/link";
import { AlertTriangle, ArchiveRestore, FileClock, KeyRound, LockKeyhole, Radar, Scale, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildSecurityReadinessSummary, securityStatusTone } from "@/lib/domain/security-readiness";

function severityClass(severity: string) {
  if (severity === "critical" || severity === "high") return "pill bad";
  if (severity === "medium") return "pill warn";
  return "pill";
}

export default async function AdminSecurityPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin security center", async () => {
    const supabase = await createClient();
    const [checksRes, findingsRes, secretsRes, backupsRes, recoveryRes, monitoringRes, rateLimitRes, auditCatalogRes, auditLogsRes] = await Promise.all([
      supabase.from("security_readiness_checks" as any).select("*").order("severity").order("category"),
      supabase.from("security_findings" as any).select("*").order("detected_at", { ascending: false }).limit(200),
      supabase.from("security_secret_inventory" as any).select("id,secret_key,secret_type,location,required,server_only,rotation_status,readiness_status,last_rotated_at,next_rotation_due_at,notes,created_at,updated_at").order("required", { ascending: false }),
      supabase.from("backup_readiness_checks" as any).select("*").order("backup_type"),
      supabase.from("disaster_recovery_checkpoints" as any).select("*").order("recovery_area"),
      supabase.from("security_monitoring_events" as any).select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("rate_limit_events" as any).select("id,route,hits,blocked,window_start").order("window_start", { ascending: false }).limit(100),
      supabase.from("audit_event_catalog" as any).select("*").order("category"),
      supabase.from("audit_logs" as any).select("id,action,actor_role,entity_type,created_at").order("created_at", { ascending: false }).limit(100)
    ]);
    [checksRes, findingsRes, secretsRes, backupsRes, recoveryRes, monitoringRes, rateLimitRes, auditCatalogRes, auditLogsRes].forEach((query, index) => logSupabaseError(`security center query ${index}`, (query as any).error));
    return {
      checks: checksRes.data ?? [],
      findings: findingsRes.data ?? [],
      secrets: secretsRes.data ?? [],
      backups: backupsRes.data ?? [],
      recovery: recoveryRes.data ?? [],
      monitoring: monitoringRes.data ?? [],
      rateLimit: rateLimitRes.data ?? [],
      auditCatalog: auditCatalogRes.data ?? [],
      auditLogs: auditLogsRes.data ?? [],
      summary: buildSecurityReadinessSummary({
        checks: checksRes.data ?? [],
        findings: findingsRes.data ?? [],
        secrets: secretsRes.data ?? [],
        backups: backupsRes.data ?? [],
        recovery: recoveryRes.data ?? [],
        monitoringEvents: monitoringRes.data ?? [],
        rateLimitEvents: rateLimitRes.data ?? [],
        auditCatalog: auditCatalogRes.data ?? []
      }),
      queryError: [checksRes.error, findingsRes.error, secretsRes.error, backupsRes.error, recoveryRes.error, monitoringRes.error, rateLimitRes.error, auditCatalogRes.error, auditLogsRes.error].some(Boolean) ? "חלק מנתוני האבטחה לא נטענו" : null
    };
  }, { checks: [] as any[], findings: [] as any[], secrets: [] as any[], backups: [] as any[], recovery: [] as any[], monitoring: [] as any[], rateLimit: [] as any[], auditCatalog: [] as any[], auditLogs: [] as any[], summary: buildSecurityReadinessSummary(), queryError: null as string | null });

  const { summary } = result.data;
  const unresolvedFindings = result.data.findings.filter((finding: any) => !["resolved", "false_positive", "accepted_risk"].includes(String(finding.status)));
  const criticalItems = [...result.data.checks.filter((check: any) => check.severity === "critical"), ...unresolvedFindings.filter((finding: any) => finding.severity === "critical")].slice(0, 8);
  const retentionItems = [
    { label: "מסמכים", value: "מוגדר לפי מדיניות גן" },
    { label: "צפייה במצלמות", value: "Audit נשמר, RTSP לא נשמר" },
    { label: "אירועי Observer", value: "מוכנות ל-30 יום ומעלה" },
    { label: "לוג תקשורת", value: "נשמר בלי סודות" }
  ];

  return (
    <DashboardShell role="admin" title="Security Center">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Enterprise Readiness</p>
          <h1>מרכז אבטחה ומוכנות ייצור.</h1>
          <p>מעקב פנימי אחרי הרשאות, פרטיות מצלמות, Observer, סודות, Audit, גיבויים, התאוששות ותאימות לפני פיילוט.</p>
        </div>
        <div className="profile-actions">
          <span className={summary.overallStatus === "ready" ? "pill good" : summary.overallStatus === "blocked" ? "pill bad" : "pill warn"}>{summary.overallStatus}</span>
          <Link className="button secondary" href="/dashboard/admin/audit-logs">יומן פעולות</Link>
        </div>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="grid cols-4 dashboard-kpis">
        <StatCard label="Critical" value={summary.criticalFindings} tone={summary.criticalFindings ? "bad" : "good"} />
        <StatCard label="High" value={summary.highFindings} tone={summary.highFindings ? "bad" : "good"} />
        <StatCard label="Medium" value={summary.mediumFindings} tone={summary.mediumFindings ? "warn" : "good"} />
        <StatCard label="Resolved" value={summary.resolvedFindings} tone="good" />
        <StatCard label="מוכנות תאימות" value={`${summary.complianceReadinessPercent}%`} tone={summary.complianceReadinessPercent < 80 ? "warn" : "good"} />
        <StatCard label="סודות במעקב" value={summary.secretsTracked} tone={summary.secretsPending ? "warn" : "good"} />
        <StatCard label="מוכנות גיבוי" value={`${summary.backupReadinessPercent}%`} tone={summary.backupPending ? "warn" : "good"} />
        <StatCard label="Audit coverage" value={`${summary.auditCoveragePercent}%`} tone={summary.auditCoveragePercent < 80 ? "warn" : "good"} />
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><ShieldCheck size={20} /> Security status</h2><p>Authentication, authorization, RLS, API protection and compliance readiness.</p></div>
          <div className="procedure-list compact-list">
            {result.data.checks.map((check: any) => (
              <div className="mini-row" key={check.id}>
                <span>{check.title}</span>
                <strong className={securityStatusTone(check.status)}>{check.status}</strong>
                <small>{check.category} · {check.recommended_action}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><AlertTriangle size={20} /> Critical findings</h2><p>פתוחים בלבד, לפי חומרה.</p></div>
          {criticalItems.length === 0 ? <div className="empty-state"><strong>אין ממצאים קריטיים פתוחים</strong><span>כאשר ייפתח ממצא קריטי הוא יופיע כאן.</span></div> : <div className="procedure-list compact-list">
            {criticalItems.map((item: any) => (
              <div className="mini-row" key={item.id ?? item.check_key}>
                <span>{item.title}</span>
                <strong className={severityClass(item.severity)}>{item.severity}</strong>
                <small>{item.remediation ?? item.recommended_action ?? item.impact ?? ""}</small>
              </div>
            ))}
          </div>}
        </article>
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Scale size={20} /> Compliance readiness</h2><p>תמונת מצב קצרה לפני פיילוט.</p></div>
          <div className="risk-list">
            <div>RLS וסקופ הרשאות <b>{summary.blockedChecks ? "דורש בדיקה" : "מוכן לבדיקת פיילוט"}</b></div>
            <div>פרטיות מצלמות <b>ללא RTSP בדפדפן</b></div>
            <div>Observer <b>Shadow + human review</b></div>
            <div>מסמכים וקטינים <b>נדרש ייעוץ משפטי</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><KeyRound size={20} /> Secrets readiness</h2><p>שמות וסטטוסים בלבד. אין ערכי סודות.</p></div>
          <div className="procedure-list compact-list">
            {result.data.secrets.map((secret: any) => (
              <div className="mini-row" key={secret.id}>
                <span>{secret.secret_key}</span>
                <strong className={securityStatusTone(secret.readiness_status)}>{secret.readiness_status}</strong>
                <small>{secret.server_only ? "server-only" : "public-safe"} · {secret.rotation_status}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><ArchiveRestore size={20} /> Backup & recovery</h2><p>בדיקות גיבוי, Restore ו-DR.</p></div>
          <div className="risk-list">
            <div>Database backup <b>{result.data.backups.find((item: any) => item.backup_key === "supabase-database-backup")?.status ?? "pending"}</b></div>
            <div>Storage backup <b>{result.data.backups.find((item: any) => item.backup_key === "supabase-storage-backup")?.status ?? "pending"}</b></div>
            <div>Recovery checkpoints <b>{summary.recoveryReady}/{result.data.recovery.length}</b></div>
            <div>Recovery pending <b>{summary.recoveryPending}</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><Radar size={20} /> Monitoring</h2><p>Suspicious login, failed login, unusual activity and rate-limit readiness.</p></div>
          <div className="risk-list">
            <div>Open monitoring events <b>{summary.monitoringOpen}</b></div>
            <div>Blocked rate limits <b>{summary.rateLimitBlocks}</b></div>
            <div>Recent audit logs <b>{result.data.auditLogs.length}</b></div>
            <div>Audit events implemented <b>{summary.auditCoveragePercent}%</b></div>
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><FileClock size={20} /> Retention readiness</h2><p>מודל שמירה לפני מחיקה אוטומטית.</p></div>
          <div className="procedure-list compact-list">
            {retentionItems.map((item) => (
              <div className="mini-row" key={item.label}>
                <span>{item.label}</span>
                <strong className="pill warn">review</strong>
                <small>{item.value}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><ShieldCheck size={20} /> Access scope</h2><p>בדיקות הרשאה שצריכות להישאר ירוקות.</p></div>
          <div className="risk-list">
            <div>הורה רואה רק ילדים ונתונים שלו <b>RLS + server checks</b></div>
            <div>מנהלת רואה רק את הגן שלה <b>garden_id scoped</b></div>
            <div>צוות רואה שיוך גן וצוות <b>assigned garden</b></div>
            <div>אתר Observer עצמאי נשאר נפרד <b>observer_site_id</b></div>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2><LockKeyhole size={20} /> Security findings</h2><p>תור עבודה פנימי לקראת פיילוט ו-enterprise readiness.</p></div>
        {unresolvedFindings.length === 0 ? <div className="empty-state"><strong>אין ממצאי אבטחה פתוחים</strong><span>בדיקות readiness עדיין מוצגות למעלה.</span></div> : <div className="procedure-list">
          {unresolvedFindings.map((finding: any) => (
            <article className="card procedure-card" key={finding.id}>
              <div>
                <span className={severityClass(finding.severity)}>{finding.severity}</span>
                <h3>{finding.title}</h3>
                <p>{finding.impact ?? finding.affected_area ?? ""}</p>
                <small>תיקון מומלץ: {finding.remediation ?? "לא צוין"}</small>
              </div>
              <span className={securityStatusTone(finding.status)}>{finding.status}</span>
            </article>
          ))}
        </div>}
      </section>
    </DashboardShell>
  );
}
