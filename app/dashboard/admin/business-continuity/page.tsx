import Link from "next/link";
import {
  Activity,
  ArchiveRestore,
  BellRing,
  CheckCircle2,
  CloudOff,
  DatabaseBackup,
  FileClock,
  HeartPulse,
  LifeBuoy,
  RadioTower,
  RefreshCcw,
  ShieldCheck,
  Siren,
  WifiOff
} from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

type ContinuityData = {
  backups: any[];
  restoreTests: any[];
  plans: any[];
  providers: any[];
  incidents: any[];
  recommendations: any[];
  failoverRules: any[];
  offlineModes: any[];
  auditEvents: any[];
  objectives: any[];
  retentionChecks: any[];
};

const emptyData: ContinuityData = {
  backups: [],
  restoreTests: [],
  plans: [],
  providers: [],
  incidents: [],
  recommendations: [],
  failoverRules: [],
  offlineModes: [],
  auditEvents: [],
  objectives: [],
  retentionChecks: []
};

function toneForStatus(status?: string | null) {
  if (["ready", "tested", "passed", "healthy", "resolved", "closed", "prepared", "defined", "not_required"].includes(String(status))) return "good" as const;
  if (["failed", "blocked", "critical", "open", "degraded"].includes(String(status))) return "bad" as const;
  if (["partial", "pending", "scheduled", "needs_review", "mitigating", "investigating", "running"].includes(String(status))) return "warn" as const;
  return "default" as const;
}

function statusLabel(status?: string | null) {
  const map: Record<string, string> = {
    ready: "מוכן",
    tested: "נבדק",
    passed: "עבר",
    partial: "חלקי",
    pending: "ממתין",
    scheduled: "מתוכנן",
    failed: "נכשל",
    blocked: "חסום",
    healthy: "תקין",
    degraded: "חלקי",
    open: "פתוח",
    investigating: "בבדיקה",
    mitigating: "בטיפול",
    resolved: "נפתר",
    closed: "נסגר",
    prepared: "מוכן",
    needs_review: "דורש בדיקה",
    defined: "מוגדר",
    not_tested: "לא נבדק",
    not_required: "לא נדרש"
  };
  return map[String(status ?? "")] ?? "ממתין";
}

function areaLabel(value?: string | null) {
  const map: Record<string, string> = {
    database: "מסד נתונים",
    file_storage: "אחסון קבצים",
    auth_users: "משתמשי התחברות",
    documents: "מסמכים",
    medical_records: "מידע רפואי",
    inspection_reports: "דוחות פיקוח",
    signatures: "חתימות",
    parent_communications: "תקשורת הורים",
    compliance_records: "ציות",
    observer_metadata: "תצפיתן",
    ai_telemetry: "מדדי חכמה",
    configuration_settings: "הגדרות מערכת",
    communications: "תקשורת",
    camera_gateway: "מצלמות",
    observer: "תצפיתן",
    storage: "אחסון",
    inspections: "פיקוח",
    compliance: "ציות",
    configuration: "הגדרות"
  };
  return map[String(value ?? "")] ?? String(value ?? "כללי");
}

function dateText(value?: string | null) {
  if (!value) return "לא נקבע";
  return new Date(value).toLocaleDateString("he-IL");
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function calculateContinuityScore(data: ContinuityData) {
  const backupScore = average(data.backups.map((item) => Number(item.readiness_score ?? 0)));
  const providerScore = data.providers.length
    ? Math.round((data.providers.filter((item) => item.status === "healthy").length / data.providers.length) * 100)
    : 0;
  const restoreScore = data.restoreTests.length
    ? Math.round((data.restoreTests.filter((item) => ["passed", "scheduled"].includes(String(item.status))).length / data.restoreTests.length) * 100)
    : 0;
  const planScore = data.plans.length
    ? Math.round((data.plans.filter((item) => ["ready", "tested", "needs_review"].includes(String(item.status))).length / data.plans.length) * 100)
    : 0;
  const activeIncidentPenalty = Math.min(30, data.incidents.filter((item) => !["resolved", "closed"].includes(String(item.status))).length * 10);
  return Math.max(0, Math.min(100, Math.round((backupScore + providerScore + restoreScore + planScore) / 4) - activeIncidentPenalty));
}

export default async function AdminBusinessContinuityPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("business continuity", async () => {
    const supabase = await createClient();
    const [
      backupsRes,
      restoreTestsRes,
      plansRes,
      providersRes,
      incidentsRes,
      recommendationsRes,
      failoverRulesRes,
      offlineModesRes,
      auditEventsRes,
      objectivesRes,
      retentionChecksRes
    ] = await Promise.all([
      supabase.from("backup_readiness_checks" as any).select("id,backup_key,backup_type,status,backup_frequency,last_backup_at,next_backup_at,last_restore_test_at,restore_status,readiness_score,coverage_scope,retention_days,recovery_point_objective_minutes,recovery_time_objective_minutes,validation_status,legal_hold_supported,deletion_request_handling,notes,updated_at").order("backup_type"),
      supabase.from("restore_test_runs" as any).select("id,test_key,test_type,target_system,status,started_at,completed_at,duration_minutes,rto_target_minutes,rpo_target_minutes,rto_met,rpo_met,result_summary,next_test_due_at,created_at").order("created_at", { ascending: false }).limit(80),
      supabase.from("disaster_recovery_plans" as any).select("id,plan_key,incident_type,title,status,rto_minutes,rpo_minutes,detection_signals,recovery_steps,failover_strategy,communication_plan,last_tested_at,next_test_due_at,updated_at").order("incident_type"),
      supabase.from("provider_health_checks" as any).select("id,provider_key,provider_name,provider_type,status,last_checked_at,latency_ms,failure_count,last_failure_at,fallback_provider_key,recovery_recommendation,updated_at").order("provider_type"),
      supabase.from("operational_incidents" as any).select("id,incident_key,title,severity,status,impact_summary,affected_systems,started_at,ended_at,root_cause,mitigation,postmortem,created_at").order("started_at", { ascending: false }).limit(60),
      supabase.from("recovery_recommendations" as any).select("id,recommendation_key,source_type,source_id,severity,status,title,recommendation,suggested_owner_role,due_at,resolved_at,created_at").order("created_at", { ascending: false }).limit(80),
      supabase.from("failover_rules" as any).select("id,rule_key,service_type,primary_condition,fallback_action,status,automation_mode,last_tested_at,updated_at").order("service_type"),
      supabase.from("offline_operations_modes" as any).select("id,mode_key,role_key,capability,status,sync_strategy,max_offline_hours,conflict_policy,updated_at").order("role_key"),
      supabase.from("business_continuity_audit_events" as any).select("id,event_type,severity,source_table,title,created_at").order("created_at", { ascending: false }).limit(80),
      supabase.from("recovery_objectives" as any).select("id,objective_key,system_area,rto_minutes,rpo_minutes,priority,status,notes,updated_at").order("priority"),
      supabase.from("retention_alignment_checks" as any).select("id,check_key,data_domain,retention_policy_status,deletion_request_supported,legal_hold_supported,backup_erasure_notes,last_reviewed_at,updated_at").order("data_domain")
    ]);

    [
      backupsRes,
      restoreTestsRes,
      plansRes,
      providersRes,
      incidentsRes,
      recommendationsRes,
      failoverRulesRes,
      offlineModesRes,
      auditEventsRes,
      objectivesRes,
      retentionChecksRes
    ].forEach((query, index) => logSupabaseError(`business continuity query ${index}`, (query as any).error));

    return {
      backups: (backupsRes.data ?? []) as any[],
      restoreTests: (restoreTestsRes.data ?? []) as any[],
      plans: (plansRes.data ?? []) as any[],
      providers: (providersRes.data ?? []) as any[],
      incidents: (incidentsRes.data ?? []) as any[],
      recommendations: (recommendationsRes.data ?? []) as any[],
      failoverRules: (failoverRulesRes.data ?? []) as any[],
      offlineModes: (offlineModesRes.data ?? []) as any[],
      auditEvents: (auditEventsRes.data ?? []) as any[],
      objectives: (objectivesRes.data ?? []) as any[],
      retentionChecks: (retentionChecksRes.data ?? []) as any[]
    };
  }, emptyData);

  const data = result.data;
  const continuityScore = calculateContinuityScore(data);
  const activeIncidents = data.incidents.filter((incident) => !["resolved", "closed"].includes(String(incident.status)));
  const providerIssues = data.providers.filter((provider) => provider.status !== "healthy");
  const openRecommendations = data.recommendations.filter((item) => !["resolved", "dismissed"].includes(String(item.status)));
  const restoreReady = data.restoreTests.filter((test) => ["passed", "scheduled"].includes(String(test.status))).length;
  const backupAverage = average(data.backups.map((item) => Number(item.readiness_score ?? 0)));
  const lastRestore = data.restoreTests.find((test) => test.completed_at);
  const coverageItems = [
    "supabase-database-backup",
    "supabase-auth-users-backup",
    "supabase-storage-buckets-backup",
    "documents-backup",
    "medical-records-backup",
    "inspection-reports-backup",
    "signature-records-backup",
    "parent-communications-backup",
    "compliance-records-backup",
    "observer-metadata-backup",
    "ai-telemetry-backup",
    "configuration-settings-backup"
  ];

  return (
    <DashboardShell role="admin" title="המשכיות עסקית">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Business Continuity"
          title="המערכת נשארת זמינה גם כשמשהו מתקלקל"
          subtitle="מרכז אחד לגיבויים, בדיקות שחזור, בריאות ספקים, אירועים תפעוליים, מצב אופליין ותוכניות התאוששות."
          badge={`${continuityScore}/100`}
          badgeTone={continuityScore >= 80 ? "good" : continuityScore >= 55 ? "warn" : "bad"}
          actions={<Link className="button secondary" href="/dashboard/admin/security-center">מרכז אבטחה</Link>}
        >
          <div className="setup-checklist">
            <span>גיבוי מתועד</span>
            <span>שחזור נבדק</span>
            <span>ספקים במעקב</span>
          </div>
        </PremiumDashboardHero>

        <AdminDataError message={result.error} />

        <section className="grid cols-5 dashboard-kpis">
          <RoleMetricCard label="ציון חוסן" value={`${continuityScore}%`} hint="גיבוי, ספקים, שחזור ואירועים" tone={continuityScore >= 80 ? "good" : continuityScore >= 55 ? "warn" : "bad"} />
          <RoleMetricCard label="מוכנות גיבוי" value={`${backupAverage}%`} hint={`${data.backups.length} אזורי כיסוי`} tone={backupAverage >= 80 ? "good" : backupAverage >= 55 ? "warn" : "bad"} />
          <RoleMetricCard label="בדיקות שחזור" value={`${restoreReady}/${data.restoreTests.length}`} hint={`אחרונה: ${dateText(lastRestore?.completed_at)}`} tone={restoreReady === data.restoreTests.length && data.restoreTests.length ? "good" : "warn"} />
          <RoleMetricCard label="ספקים בבעיה" value={providerIssues.length} hint={`${data.providers.length} ספקים במעקב`} tone={providerIssues.length ? "bad" : "good"} />
          <RoleMetricCard label="אירועים פעילים" value={activeIncidents.length} hint={`${openRecommendations.length} המלצות פתוחות`} tone={activeIncidents.length ? "bad" : openRecommendations.length ? "warn" : "good"} />
        </section>

        <section className="grid cols-4 action-grid">
          <ActionCard title="בדיקת שחזור" text="מסד נתונים, קבצים ומשתמשים" href="/dashboard/admin/business-continuity#restore-tests" icon={ArchiveRestore} tone="warn" />
          <ActionCard title="בריאות ספקים" text="Supabase, Vercel, תקשורת ומצלמות" href="/dashboard/admin/business-continuity#providers" icon={HeartPulse} />
          <ActionCard title="אירוע תפעולי" text="מעקב השפעה והחלמה" href="/dashboard/admin/business-continuity#incidents" icon={Siren} tone={activeIncidents.length ? "bad" : "default"} />
          <ActionCard title="מצב אופליין" text="עבודה בתור עד חזרת חיבור" href="/dashboard/admin/business-continuity#offline" icon={WifiOff} />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="כיסוי גיבויים" subtitle="כל תחום קריטי מקבל תדירות, יעדי שחזור ומעקב readiness.">
            {data.backups.length ? (
              <div className="stack-list">
                {data.backups
                  .filter((backup) => coverageItems.includes(String(backup.backup_key)))
                  .map((backup) => (
                    <article className="list-item" key={backup.id}>
                      <div>
                        <strong>{areaLabel(backup.backup_type)}</strong>
                        <span>{backup.coverage_scope ?? backup.backup_key}</span>
                        <small>תדירות {backup.backup_frequency} · RPO {backup.recovery_point_objective_minutes ?? "-"} דק׳ · RTO {backup.recovery_time_objective_minutes ?? "-"} דק׳</small>
                      </div>
                      <StatusBadge tone={toneForStatus(backup.status)}>{backup.readiness_score ?? 0}/100</StatusBadge>
                    </article>
                  ))}
              </div>
            ) : (
              <EmptyState title="אין נתוני גיבוי" text="לאחר הרצת המיגרציה יוצג כאן כיסוי הגיבויים המלא." />
            )}
          </CleanSection>

          <CleanSection title="המלצות התאוששות" subtitle="פעולות שמקטינות סיכון לפני פיילוט אמיתי.">
            {openRecommendations.length ? (
              <div className="stack-list">
                {openRecommendations.slice(0, 8).map((item) => (
                  <article className="list-item" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.recommendation}</span>
                      <small>אחראי: {item.suggested_owner_role} · יעד: {dateText(item.due_at)}</small>
                    </div>
                    <StatusBadge tone={toneForStatus(item.severity)}>{item.severity}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="אין המלצות פתוחות" text="כאשר גיבוי, ספק או בדיקת שחזור דורשים טיפול, זה יופיע כאן." />
            )}
          </CleanSection>
        </section>

        <section className="grid cols-3 dashboard-panels" id="restore-tests">
          <CleanSection title="בדיקות שחזור" subtitle="בדיקות יבשות שמוכיחות שאפשר לחזור לפעילות.">
            <div className="stack-list">
              {data.restoreTests.map((test) => (
                <article className="list-item" key={test.id}>
                  <div>
                    <strong>{test.target_system}</strong>
                    <span>{test.result_summary ?? test.test_type}</span>
                    <small>בדיקה הבאה: {dateText(test.next_test_due_at)}</small>
                  </div>
                  <StatusBadge tone={toneForStatus(test.status)}>{statusLabel(test.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="יעדי התאוששות" subtitle="כמה מהר חוזרים וכמה מידע מותר לאבד.">
            <div className="stack-list">
              {data.objectives.map((objective) => (
                <article className="list-item" key={objective.id}>
                  <div>
                    <strong>{areaLabel(objective.system_area)}</strong>
                    <span>RTO {objective.rto_minutes} דק׳ · RPO {objective.rpo_minutes} דק׳</span>
                    <small>{objective.notes ?? "יעד מוגדר"}</small>
                  </div>
                  <StatusBadge tone={toneForStatus(objective.status)}>{statusLabel(objective.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="תוכניות התאוששות" subtitle="מה עושים כשספק או מערכת נופלים.">
            <div className="stack-list">
              {data.plans.slice(0, 10).map((plan) => (
                <article className="list-item" key={plan.id}>
                  <div>
                    <strong>{plan.title}</strong>
                    <span>RTO {plan.rto_minutes} דק׳ · RPO {plan.rpo_minutes} דק׳</span>
                    <small>בדיקה הבאה: {dateText(plan.next_test_due_at)}</small>
                  </div>
                  <StatusBadge tone={toneForStatus(plan.status)}>{statusLabel(plan.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels" id="providers">
          <CleanSection title="בריאות ספקים" subtitle="ספקי תשתית, תקשורת, מצלמות, תצפיתן ותשלומים.">
            <div className="stack-list">
              {data.providers.map((provider) => (
                <article className="list-item" key={provider.id}>
                  <div>
                    <strong>{provider.provider_name}</strong>
                    <span>{areaLabel(provider.provider_type)} · נפילות: {provider.failure_count ?? 0}</span>
                    <small>{provider.recovery_recommendation ?? "במעקב"}</small>
                  </div>
                  <StatusBadge tone={toneForStatus(provider.status)}>{statusLabel(provider.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Failover מוכן" subtitle="נפילה לא חייבת לעצור את הגן.">
            <div className="procedure-list">
              {data.failoverRules.map((rule) => (
                <article className="procedure-card card" key={rule.id}>
                  <StatusBadge tone={toneForStatus(rule.status)}>{statusLabel(rule.status)}</StatusBadge>
                  <div>
                    <strong>{areaLabel(rule.service_type)}</strong>
                    <span>{rule.primary_condition}</span>
                    <small>{rule.fallback_action} · {rule.automation_mode}</small>
                  </div>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels" id="incidents">
          <CleanSection title="אירועים תפעוליים" subtitle="השפעה, טיפול, שורש תקלה ו־postmortem.">
            {data.incidents.length ? (
              <div className="stack-list">
                {data.incidents.map((incident) => (
                  <article className="list-item" key={incident.id}>
                    <div>
                      <strong>{incident.title}</strong>
                      <span>{incident.impact_summary ?? "אירוע תפעולי"}</span>
                      <small>{(incident.affected_systems ?? []).join(", ") || "מערכת"} · התחיל {dateText(incident.started_at)}</small>
                    </div>
                    <StatusBadge tone={incident.severity === "critical" || incident.severity === "high" ? "bad" : toneForStatus(incident.status)}>
                      {incident.severity}
                    </StatusBadge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="אין אירועים פעילים" text="אירועי תפעול אמיתיים יופיעו כאן עם השפעה, טיפול ושורש תקלה." />
            )}
          </CleanSection>

          <CleanSection title="יומן המשכיות" subtitle="גיבויים, שחזורים, ספקים ואירועים נשמרים ל־audit.">
            {data.auditEvents.length ? (
              <div className="stack-list">
                {data.auditEvents.slice(0, 8).map((event) => (
                  <article className="list-item" key={event.id}>
                    <div>
                      <strong>{event.title}</strong>
                      <span>{event.event_type} · {event.source_table ?? "כללי"}</span>
                      <small>{dateText(event.created_at)}</small>
                    </div>
                    <StatusBadge tone={toneForStatus(event.severity)}>{event.severity}</StatusBadge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="אין אירועי audit עדיין" text="פעולות גיבוי ושחזור יתועדו כאן." />
            )}
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels" id="offline">
          <CleanSection title="מצבי עבודה בזמן תקלה" subtitle="מה כל תפקיד יכול לעשות כשאין חיבור מלא.">
            <div className="stack-list">
              {data.offlineModes.map((mode) => (
                <article className="list-item" key={mode.id}>
                  <div>
                    <strong>{mode.role_key}</strong>
                    <span>{mode.capability}</span>
                    <small>{mode.sync_strategy} · עד {mode.max_offline_hours ?? "-"} שעות</small>
                  </div>
                  <StatusBadge tone={toneForStatus(mode.status)}>{statusLabel(mode.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="התאמת שמירה ופרטיות" subtitle="גיבויים צריכים לכבד מחיקה, שמירה והחזקה משפטית.">
            <div className="stack-list">
              {data.retentionChecks.map((check) => (
                <article className="list-item" key={check.id}>
                  <div>
                    <strong>{areaLabel(check.data_domain)}</strong>
                    <span>{check.backup_erasure_notes ?? "נדרש review"}</span>
                    <small>מחיקה: {check.deletion_request_supported ? "נתמכת" : "בדיקה ידנית"} · Legal hold: {check.legal_hold_supported ? "כן" : "לא"}</small>
                  </div>
                  <StatusBadge tone={toneForStatus(check.retention_policy_status)}>{statusLabel(check.retention_policy_status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="עוזר המשכיות" subtitle="שאלות תפעוליות קצרות. העוזר ממליץ, מנהל אנושי מחליט.">
          <div className="ai-prompt-grid">
            {[
              { text: "אילו גיבויים דורשים בדיקת שחזור?", icon: DatabaseBackup },
              { text: "אילו ספקים במצב חלקי או כשל?", icon: RadioTower },
              { text: "מה מסכן את החזרה לפעילות?", icon: BellRing },
              { text: "מה הפעולה הבאה במקרה של נפילת מצלמות?", icon: CloudOff },
              { text: "אילו יעדי RTO/RPO לא נבדקו?", icon: FileClock },
              { text: "מה צריך לבדוק לפני פיילוט אמיתי?", icon: ShieldCheck }
            ].map(({ text, icon: PromptIcon }) => (
              <article className="card mini-card" key={text}>
                <PromptIcon size={20} />
                <strong>{text}</strong>
                <span>תשובה מבוססת נתונים בלבד.</span>
              </article>
            ))}
          </div>
        </CleanSection>

        <section className="grid cols-3 action-grid">
          <ActionCard title="אבטחה ותאימות" text="סיכונים, Audit והרשאות" href="/dashboard/admin/security-center" icon={ShieldCheck} />
          <ActionCard title="בריאות מערכת" text="מה חסר לפני הפעלה מלאה" href="/dashboard/admin/system-health" icon={Activity} />
          <ActionCard title="מוכנות השקה" text="חסמים לפני עלייה לאוויר" href="/dashboard/admin/launch-readiness" icon={CheckCircle2} tone="good" />
        </section>
      </div>
    </DashboardShell>
  );
}
