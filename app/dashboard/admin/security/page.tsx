import Link from "next/link";
import { AlertTriangle, ArchiveRestore, DatabaseZap, FileClock, Fingerprint, KeyRound, LockKeyhole, Radar, Scale, ShieldCheck, Smartphone, UserCheck } from "lucide-react";
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

function percent(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function scoreTone(score: number): "good" | "warn" | "bad" {
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

export default async function AdminSecurityPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin security center", async () => {
    const supabase = await createClient();
    const [checksRes, findingsRes, secretsRes, backupsRes, recoveryRes, monitoringRes, rateLimitRes, auditCatalogRes, auditLogsRes, profilesRes, mfaRes, classificationsRes, encryptedFieldsRes, securityEventsRes, devicesRes, sessionsRes, privacyRequestsRes, riskRegisterRes, policiesRes, trainingRes] = await Promise.all([
      supabase.from("security_readiness_checks" as any).select("*").order("severity").order("category"),
      supabase.from("security_findings" as any).select("*").order("detected_at", { ascending: false }).limit(200),
      supabase.from("security_secret_inventory" as any).select("id,secret_key,secret_type,location,required,server_only,rotation_status,readiness_status,last_rotated_at,next_rotation_due_at,notes,created_at,updated_at").order("required", { ascending: false }),
      supabase.from("backup_readiness_checks" as any).select("*").order("backup_type"),
      supabase.from("disaster_recovery_checkpoints" as any).select("*").order("recovery_area"),
      supabase.from("security_monitoring_events" as any).select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("rate_limit_events" as any).select("id,route,hits,blocked,window_start").order("window_start", { ascending: false }).limit(100),
      supabase.from("audit_event_catalog" as any).select("*").order("category"),
      supabase.from("audit_logs" as any).select("id,action,actor_role,entity_type,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles" as any).select("id,role").in("role", ["admin", "owner", "manager", "parent", "staff", "inspector", "network_manager"]).limit(5000),
      supabase.from("mfa_enrollment_status" as any).select("*").order("role").limit(5000),
      supabase.from("security_data_classifications" as any).select("*").order("data_classification").limit(300),
      supabase.from("encrypted_field_registry" as any).select("*").order("data_classification").limit(200),
      supabase.from("security_events" as any).select("*").order("created_at", { ascending: false }).limit(120),
      supabase.from("trusted_devices" as any).select("*").order("last_seen_at", { ascending: false }).limit(200),
      supabase.from("security_sessions" as any).select("*").order("last_seen_at", { ascending: false }).limit(200),
      supabase.from("privacy_rights_requests" as any).select("*").order("created_at", { ascending: false }).limit(120),
      supabase.from("security_risk_register" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(120),
      supabase.from("security_policies_repository" as any).select("*").order("policy_type").limit(120),
      supabase.from("security_training_readiness" as any).select("*").order("role").limit(120)
    ]);
    [checksRes, findingsRes, secretsRes, backupsRes, recoveryRes, monitoringRes, rateLimitRes, auditCatalogRes, auditLogsRes, profilesRes, mfaRes, classificationsRes, encryptedFieldsRes, securityEventsRes, devicesRes, sessionsRes, privacyRequestsRes, riskRegisterRes, policiesRes, trainingRes].forEach((query, index) => logSupabaseError(`security center query ${index}`, (query as any).error));
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
      profiles: profilesRes.data ?? [],
      mfa: mfaRes.data ?? [],
      classifications: classificationsRes.data ?? [],
      encryptedFields: encryptedFieldsRes.data ?? [],
      securityEvents: securityEventsRes.data ?? [],
      devices: devicesRes.data ?? [],
      sessions: sessionsRes.data ?? [],
      privacyRequests: privacyRequestsRes.data ?? [],
      riskRegister: riskRegisterRes.data ?? [],
      policies: policiesRes.data ?? [],
      training: trainingRes.data ?? [],
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
      queryError: [checksRes.error, findingsRes.error, secretsRes.error, backupsRes.error, recoveryRes.error, monitoringRes.error, rateLimitRes.error, auditCatalogRes.error, auditLogsRes.error, profilesRes.error, mfaRes.error, classificationsRes.error, encryptedFieldsRes.error, securityEventsRes.error, devicesRes.error, sessionsRes.error, privacyRequestsRes.error, riskRegisterRes.error, policiesRes.error, trainingRes.error].some(Boolean) ? "חלק מנתוני האבטחה לא נטענו. ייתכן שמיגרציית PHASE 146 עדיין לא הורצה." : null
    };
  }, { checks: [] as any[], findings: [] as any[], secrets: [] as any[], backups: [] as any[], recovery: [] as any[], monitoring: [] as any[], rateLimit: [] as any[], auditCatalog: [] as any[], auditLogs: [] as any[], profiles: [] as any[], mfa: [] as any[], classifications: [] as any[], encryptedFields: [] as any[], securityEvents: [] as any[], devices: [] as any[], sessions: [] as any[], privacyRequests: [] as any[], riskRegister: [] as any[], policies: [] as any[], training: [] as any[], summary: buildSecurityReadinessSummary(), queryError: null as string | null });

  const { summary } = result.data;
  const unresolvedFindings = result.data.findings.filter((finding: any) => !["resolved", "false_positive", "accepted_risk"].includes(String(finding.status)));
  const openRisks = result.data.riskRegister.filter((risk: any) => !["verified", "accepted_risk"].includes(String(risk.status)));
  const profileCount = result.data.profiles.length;
  const enrolledMfa = result.data.mfa.filter((item: any) => item.enrollment_status === "enrolled").length;
  const mfaReadiness = percent(enrolledMfa, Math.max(profileCount, result.data.mfa.length));
  const encryptionCoverage = result.data.encryptedFields.length ? Math.round(result.data.encryptedFields.reduce((sum: number, item: any) => sum + Number(item.coverage_percent ?? 0), 0) / result.data.encryptedFields.length) : 0;
  const requiredAudit = result.data.auditCatalog.filter((item: any) => item.required).length;
  const implementedAudit = result.data.auditCatalog.filter((item: any) => item.required && item.implemented).length;
  const auditReadiness = percent(implementedAudit, requiredAudit);
  const privacyOpen = result.data.privacyRequests.filter((item: any) => !["completed", "rejected", "cancelled"].includes(String(item.status))).length;
  const privacyReadiness = result.data.policies.some((policy: any) => policy.policy_type === "privacy") ? Math.max(55, 100 - privacyOpen * 8) : 0;
  const backupReadiness = summary.backupReadinessPercent;
  const highSecurityScore = Math.round((mfaReadiness + encryptionCoverage + auditReadiness + privacyReadiness + backupReadiness) / 5);
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
          <h1>מרכז אבטחה, פרטיות ותאימות גבוהה.</h1>
          <p>מוכנות High Security למידע ילדים, הורים, בריאות, נוכחות, פיקוח, מצלמות ו-AI. הבקרות מדידות, נאכפות ומתועדות.</p>
        </div>
        <div className="profile-actions">
          <span className={`pill ${scoreTone(highSecurityScore)}`}>{highSecurityScore}/100</span>
          <Link className="button secondary" href="/dashboard/admin/audit-logs">יומן פעולות</Link>
        </div>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="grid cols-4 dashboard-kpis">
        <StatCard label="MFA readiness" value={`${mfaReadiness}%`} tone={scoreTone(mfaReadiness)} />
        <StatCard label="Encryption" value={`${encryptionCoverage}%`} tone={scoreTone(encryptionCoverage)} />
        <StatCard label="Audit readiness" value={`${auditReadiness}%`} tone={scoreTone(auditReadiness)} />
        <StatCard label="Privacy" value={`${privacyReadiness}%`} tone={scoreTone(privacyReadiness)} />
        <StatCard label="Backup" value={`${backupReadiness}%`} tone={summary.backupPending ? "warn" : "good"} />
        <StatCard label="Open risks" value={openRisks.length} tone={openRisks.some((risk: any) => risk.severity === "critical") ? "bad" : openRisks.length ? "warn" : "good"} />
        <StatCard label="Security events" value={result.data.securityEvents.length} tone={result.data.securityEvents.some((event: any) => event.severity === "critical") ? "bad" : "good"} />
        <StatCard label="Classified data" value={result.data.classifications.length} tone="good" />
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Fingerprint size={20} /> Mandatory MFA</h2><p>כל התפקידים חייבים לעבור MFA לפני ייצור.</p></div>
          <div className="risk-list">
            <div>משתמשים במעקב <b>{profileCount}</b></div>
            <div>רשומות MFA <b>{result.data.mfa.length}</b></div>
            <div>הושלם <b>{enrolledMfa}</b></div>
            <div>גורמים נתמכים <b>Authenticator, SMS, Backup Codes</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><DatabaseZap size={20} /> Medical encryption</h2><p>מידע רפואי חייב לעבור הצפנה ברמת האפליקציה.</p></div>
          <div className="procedure-list compact-list">
            {result.data.encryptedFields.slice(0, 7).map((field: any) => (
              <div className="mini-row" key={field.id}>
                <span>{field.table_name}.{field.encrypted_field}</span>
                <strong className={securityStatusTone(field.encryption_status)}>{field.encryption_status}</strong>
                <small>{field.coverage_percent}% · {field.key_reference}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><UserCheck size={20} /> Privacy rights</h2><p>בקשות גישה, תיקון, מחיקה וייצוא.</p></div>
          <div className="risk-list">
            <div>פתוחות <b>{privacyOpen}</b></div>
            <div>מדיניות פרטיות <b>{result.data.policies.find((policy: any) => policy.policy_type === "privacy")?.status ?? "חסר"}</b></div>
            <div>בקשות אחרונות <b>{result.data.privacyRequests.length}</b></div>
            <div>סוגי בקשות <b>access / correction / deletion / export</b></div>
          </div>
        </article>
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

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Smartphone size={20} /> Device & session trust</h2><p>מכשירים, סשנים, יציאה כפויה וזיהוי חריגות.</p></div>
          <div className="risk-list">
            <div>מכשירים מוכרים <b>{result.data.devices.length}</b></div>
            <div>מכשירים חשודים <b>{result.data.devices.filter((device: any) => device.trust_status === "suspicious").length}</b></div>
            <div>סשנים במעקב <b>{result.data.sessions.length}</b></div>
            <div>סשנים בסיכון גבוה <b>{result.data.sessions.filter((session: any) => ["high", "critical"].includes(String(session.risk_level))).length}</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><AlertTriangle size={20} /> Security risk register</h2><p>סיכונים, בעלות, מיטיגציה ותאריך יעד.</p></div>
          {openRisks.length === 0 ? <div className="empty-state"><strong>אין סיכוני אבטחה פתוחים</strong><span>סיכונים חדשים יופיעו כאן.</span></div> : <div className="procedure-list compact-list">
            {openRisks.slice(0, 8).map((risk: any) => (
              <div className="mini-row" key={risk.id}>
                <span>{risk.title}</span>
                <strong className={severityClass(risk.severity)}>{risk.severity}</strong>
                <small>{risk.mitigation_plan}</small>
              </div>
            ))}
          </div>}
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Scale size={20} /> Data classification</h2><p>Public, Internal, Confidential, Sensitive, Medical, Regulated.</p></div>
          <div className="procedure-list compact-list">
            {result.data.classifications.slice(0, 10).map((item: any) => (
              <div className="mini-row" key={item.id}>
                <span>{item.table_name}{item.field_name ? `.${item.field_name}` : ""}</span>
                <strong className={item.data_classification === "medical" || item.data_classification === "regulated" ? "pill bad" : "pill warn"}>{item.data_classification}</strong>
                <small>{item.access_rule_summary}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><FileClock size={20} /> Policies & training</h2><p>מאגר מדיניות והכשרות אבטחה.</p></div>
          <div className="risk-list">
            <div>מדיניות <b>{result.data.policies.length}</b></div>
            <div>מאושרות <b>{result.data.policies.filter((policy: any) => policy.status === "approved").length}</b></div>
            <div>הכשרות <b>{result.data.training.length}</b></div>
            <div>השלמה ממוצעת <b>{result.data.training.length ? Math.round(result.data.training.reduce((sum: number, item: any) => sum + Number(item.completion_rate ?? 0), 0) / result.data.training.length) : 0}%</b></div>
          </div>
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
