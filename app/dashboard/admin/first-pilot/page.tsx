import Link from "next/link";
import { AlertTriangle, ClipboardCheck, GraduationCap, HeartPulse, ShieldCheck, UsersRound } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, any>;
type Tone = "default" | "good" | "warn" | "bad";

async function safeQuery<T>(label: string, run: () => any) {
  try {
    const result = (await run()) as { data: T[] | null; error: any };
    logSupabaseError(label, result.error);
    return result.error ? [] : result.data ?? [];
  } catch (error) {
    logSupabaseError(label, error);
    return [];
  }
}

function label(value?: string | null) {
  return String(value ?? "לא ידוע").replaceAll("_", " ");
}

function toneForStatus(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["approved", "completed", "healthy", "met", "pilot_ready", "active_pilot", "verified", "signed"].includes(value)) return "good";
  if (["preparing", "onboarding", "in_progress", "ready", "draft", "sent", "scheduled", "tracking", "approved_with_conditions", "pilot_ready_with_blockers"].includes(value)) return "warn";
  if (["blocked", "critical", "high", "missing", "failed", "cancelled", "not_approved", "open"].includes(value)) return "bad";
  return "default";
}

function scoreTone(score: number): Tone {
  if (score >= 82) return "good";
  if (score >= 58) return "warn";
  return "bad";
}

function percentDone(rows: Row[], doneStatuses: string[]) {
  if (!rows.length) return 0;
  const done = rows.filter((row) => doneStatuses.includes(String(row.status ?? row.approval_status))).length;
  return Math.round((done / rows.length) * 100);
}

function boolCount(row?: Row) {
  if (!row) return 0;
  return [
    row.manager_logged_in,
    row.staff_used_system,
    row.parents_used_system,
    row.documents_uploaded,
    row.child_updates_created,
    row.messages_sent_read,
    row.support_issues_reviewed,
    row.critical_blockers_checked
  ].filter(Boolean).length;
}

export default async function FirstPilotPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("first pilot command center", async () => {
    const supabase = await createClient();
    const [profiles, scores, gates, dataPolicies, agreements, trainings, issues, feedback, health, metrics, risks, exitCriteria] = await Promise.all([
      safeQuery<Row>("pilot kindergarten profiles", () => supabase.from("pilot_kindergarten_profiles" as any).select("*").order("created_at", { ascending: false }).limit(20)),
      safeQuery<Row>("first pilot readiness scores", () => supabase.from("first_pilot_readiness_scores" as any).select("*").order("calculated_at", { ascending: false }).limit(20)),
      safeQuery<Row>("pilot approval gates", () => supabase.from("pilot_approval_gates" as any).select("*").order("gate_area").order("gate_key").limit(80)),
      safeQuery<Row>("pilot data policies", () => supabase.from("pilot_data_policies" as any).select("*").order("data_category").limit(80)),
      safeQuery<Row>("pilot agreement checklist", () => supabase.from("pilot_agreement_checklist" as any).select("*").order("document_type").limit(80)),
      safeQuery<Row>("pilot training checklist", () => supabase.from("pilot_training_checklist" as any).select("*").order("training_track").limit(80)),
      safeQuery<Row>("pilot issue reports", () => supabase.from("pilot_issue_reports" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(100)),
      safeQuery<Row>("pilot feedback collection", () => supabase.from("pilot_feedback_collection" as any).select("*").order("collected_at", { ascending: false }).limit(80)),
      safeQuery<Row>("pilot daily health checks", () => supabase.from("pilot_daily_health_checks" as any).select("*").order("check_date", { ascending: false }).limit(30)),
      safeQuery<Row>("pilot success metrics", () => supabase.from("pilot_success_metrics" as any).select("*").order("metric_area").limit(80)),
      safeQuery<Row>("pilot risks", () => supabase.from("pilot_risks" as any).select("*").order("severity").order("risk_category").limit(100)),
      safeQuery<Row>("pilot exit criteria", () => supabase.from("pilot_exit_criteria" as any).select("*").order("criteria_key").limit(80))
    ]);
    return { profiles, scores, gates, dataPolicies, agreements, trainings, issues, feedback, health, metrics, risks, exitCriteria };
  }, {
    profiles: [] as Row[],
    scores: [] as Row[],
    gates: [] as Row[],
    dataPolicies: [] as Row[],
    agreements: [] as Row[],
    trainings: [] as Row[],
    issues: [] as Row[],
    feedback: [] as Row[],
    health: [] as Row[],
    metrics: [] as Row[],
    risks: [] as Row[],
    exitCriteria: [] as Row[]
  });

  const data = result.data;
  const profile = data.profiles[0];
  const score = data.scores[0];
  const readinessScore = Number(score?.readiness_score ?? profile?.health_score ?? 0);
  const openIssues = data.issues.filter((issue) => !["fixed", "verified", "deferred"].includes(String(issue.status)));
  const criticalIssues = openIssues.filter((issue) => issue.severity === "critical").length;
  const highIssues = openIssues.filter((issue) => issue.severity === "high").length;
  const blockingGates = data.gates.filter((gate) => gate.required && gate.blocks_activation && gate.status !== "approved").length;
  const approvedGates = data.gates.filter((gate) => gate.status === "approved").length;
  const allowedData = data.dataPolicies.filter((policy) => policy.allowed === true).length;
  const agreementPercent = percentDone(data.agreements, ["signed", "approved", "not_required"]);
  const trainingPercent = percentDone(data.trainings, ["completed"]);
  const exitPercent = percentDone(data.exitCriteria, ["met", "not_required"]);
  const latestHealth = data.health[0];
  const dailyHealthDone = boolCount(latestHealth);
  const cameraPolicy = data.dataPolicies.find((policy) => policy.data_category === "camera_data");
  const aiPolicy = data.dataPolicies.find((policy) => policy.data_category === "ai_processing");

  return (
    <DashboardShell role="admin" title="First Pilot">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Controlled Kindergarten Pilot"
          title="פיילוט גן ראשון"
          subtitle="מרכז שליטה להפעלת גן אמיתי ראשון בצורה מבוקרת: שערי אישור, מדיניות נתונים, הדרכה, תמיכה, מצלמות, תצפיתן, תשלומים וחסמים. הפיילוט אינו מפעיל production אוטומטית."
          badge={`${readinessScore}/100`}
          badgeTone={scoreTone(readinessScore)}
          actions={<><Link className="button primary" href="/dashboard/admin/legal-review">סקירה משפטית</Link><Link className="button secondary" href="/dashboard/admin/security-review">בדיקת אבטחה</Link></>}
        >
          <div className="setup-checklist">
            <span>Pilot mode בלבד</span>
            <span>real data חסום עד אישור</span>
            <span>Observer ב־shadow mode</span>
            <span>Parent camera visibility כבוי כברירת מחדל</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="Pilot health" value={`${readinessScore}/100`} hint={label(score?.status ?? profile?.pilot_status)} tone={scoreTone(readinessScore)} />
          <RoleMetricCard label="Pilot status" value={label(profile?.pilot_status)} hint={profile?.kindergarten_name ?? "גן טרם נבחר"} tone={toneForStatus(profile?.pilot_status)} />
          <RoleMetricCard label="Approval gates" value={`${approvedGates}/${data.gates.length}`} hint={`${blockingGates} חוסמים`} tone={blockingGates ? "bad" : "good"} />
          <RoleMetricCard label="Data allowed" value={`${allowedData}/${data.dataPolicies.length}`} hint="ברירת מחדל חסומה" tone={allowedData <= 1 ? "good" : "warn"} />
          <RoleMetricCard label="Agreements" value={`${agreementPercent}%`} hint="הסכמים והודעות" tone={scoreTone(agreementPercent)} />
          <RoleMetricCard label="Training" value={`${trainingPercent}%`} hint="מנהלת, צוות, הורים" tone={scoreTone(trainingPercent)} />
          <RoleMetricCard label="Open issues" value={openIssues.length} hint={`${criticalIssues} critical · ${highIssues} high`} tone={criticalIssues ? "bad" : openIssues.length ? "warn" : "good"} />
          <RoleMetricCard label="Exit criteria" value={`${exitPercent}%`} hint="לפני סיום פיילוט" tone={scoreTone(exitPercent)} />
        </section>

        <CleanSection title="Pilot Kindergarten Profile" subtitle="הפרופיל נשאר placeholder עד בחירת גן אמיתי ואישור מסמכי הפיילוט.">
          {profile ? (
            <article className="card procedure-card">
              <div>
                <StatusBadge tone={toneForStatus(profile.pilot_status)}>{label(profile.pilot_status)}</StatusBadge>
                <StatusBadge tone={toneForStatus(profile.pilot_mode)}>{label(profile.pilot_mode)}</StatusBadge>
                <h3>{profile.kindergarten_name}</h3>
                <p>{profile.notes}</p>
                <small>{profile.city ?? "עיר לא נבחרה"} · {profile.number_of_children ?? 0} ילדים · {profile.number_of_staff ?? 0} אנשי צוות · camera {label(profile.camera_availability)}</small>
              </div>
              <div className="procedure-meta">
                <StatusBadge tone="warn">support {profile.support_owner ?? "TBD"}</StatusBadge>
                <StatusBadge tone="default">owner {profile.pilot_owner ?? "TBD"}</StatusBadge>
              </div>
            </article>
          ) : <EmptyState title="אין פרופיל פיילוט" text="הרצת המיגרציה של Phase 168 תיצור פרופיל placeholder מבוקר." />}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Pilot Approval Gates" subtitle="אי אפשר להעביר ל־active_pilot בלי אישור כל השערים החוסמים.">
            <div className="camera-infra-list">
              {data.gates.map((gate) => (
                <article className="camera-infra-row" key={gate.id ?? gate.gate_key}>
                  <div>
                    <strong>{gate.title}</strong>
                    <span>{gate.evidence_summary}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(gate.status)}>{label(gate.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Pilot Data Policy" subtitle="קטגוריות מידע אמיתיות חסומות עד אישור מפורש.">
            <div className="camera-infra-list">
              {data.dataPolicies.map((policy) => (
                <article className="camera-infra-row" key={policy.id ?? policy.policy_key}>
                  <div>
                    <strong>{label(policy.data_category)}</strong>
                    <span>{policy.restrictions}</span>
                  </div>
                  <StatusBadge tone={policy.allowed ? "warn" : "good"}>{policy.allowed ? "allowed" : "blocked"}</StatusBadge>
                  <StatusBadge tone={toneForStatus(policy.approval_status)}>{label(policy.approval_status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Agreement Checklist" subtitle="הסכמי פיילוט, הודעות פרטיות, מצלמות ו־AI לפני כל שימוש אמיתי.">
            <div className="procedure-list">
              {data.agreements.map((item) => (
                <article className="card procedure-card" key={item.id ?? item.checklist_key}>
                  <div>
                    <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                    <h3>{item.title}</h3>
                    <p>{item.notes}</p>
                  </div>
                  <div className="procedure-meta"><StatusBadge tone="default">{label(item.document_type)}</StatusBadge></div>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Training & Onboarding" subtitle="הכנה למנהלת, צוות, הורים, מפקח ותמיכה.">
            <div className="camera-infra-list">
              {data.trainings.map((training) => (
                <article className="camera-infra-row" key={training.id ?? training.training_key}>
                  <div>
                    <strong>{training.title}</strong>
                    <span>{training.notes}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(training.status)}>{label(training.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Pilot Support Desk & Issues" subtitle="תמיכה, באגים וחסמי פיילוט. Critical חוסם הפעלה או הרחבה.">
            {data.issues.length === 0 ? <EmptyState title="אין בעיות פיילוט" /> : (
              <div className="camera-infra-list">
                {data.issues.map((issue) => (
                  <article className="camera-infra-row" key={issue.id ?? issue.issue_key}>
                    <div>
                      <strong>{issue.title}</strong>
                      <span>{issue.description}</span>
                    </div>
                    <StatusBadge tone={toneForStatus(issue.severity)}>{label(issue.severity)}</StatusBadge>
                    <StatusBadge tone={toneForStatus(issue.status)}>{label(issue.status)}</StatusBadge>
                  </article>
                ))}
              </div>
            )}
          </CleanSection>

          <CleanSection title="Feedback System" subtitle="איסוף משוב ממנהלת, צוות, הורים, מפקח ותמיכה.">
            <div className="camera-infra-list">
              {data.feedback.map((item) => (
                <article className="camera-infra-row" key={item.id ?? item.feedback_key}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.summary}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(item.status)}>{label(item.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Daily Pilot Health Check" subtitle="בדיקה יומית לאחר תחילת onboarding מבוקר.">
            <article className="card procedure-card">
              <div>
                <StatusBadge tone={toneForStatus(latestHealth?.status)}>{label(latestHealth?.status)}</StatusBadge>
                <h3>{dailyHealthDone}/8 פעולות יומיות סומנו</h3>
                <p>{latestHealth?.notes ?? "Daily health check starts after pilot onboarding begins."}</p>
                <small>{latestHealth?.check_date ?? "No date"}</small>
              </div>
              <div className="procedure-meta"><StatusBadge tone={scoreTone(Number(latestHealth?.score ?? 0))}>{latestHealth?.score ?? 0}/100</StatusBadge></div>
            </article>
          </CleanSection>

          <CleanSection title="Pilot Success Metrics" subtitle="מדדי אימוץ, תקשורת, תמיכה ושביעות רצון.">
            <div className="camera-infra-list">
              {data.metrics.map((metric) => (
                <article className="camera-infra-row" key={metric.id ?? metric.metric_key}>
                  <div>
                    <strong>{metric.metric_name}</strong>
                    <span>{label(metric.metric_area)} · target {metric.target_value ?? "TBD"}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(metric.status)}>{label(metric.status)}</StatusBadge>
                  <StatusBadge tone="default">{metric.metric_value}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Camera, Observer, Payment & Notification Readiness" subtitle="כל יכולת מסוכנת נשארת חסומה או במצב בדיקה עד אישור מפורש.">
          <div className="premium-action-grid">
            <ActionCard icon={ShieldCheck} title="Camera pilot" text={`Camera data: ${label(cameraPolicy?.approval_status)}. Parent viewing disabled unless approved.`} href="/dashboard/admin/camera-gateway" />
            <ActionCard icon={HeartPulse} title="Observer pilot" text={`AI processing: ${label(aiPolicy?.approval_status)}. Shadow mode only, no parent raw AI.`} href="/dashboard/admin/observer-pilot" />
            <ActionCard icon={ClipboardCheck} title="Payments" text="Sandbox/test mode until provider, invoice and agreement approval are ready." href="/dashboard/admin/integrations" />
            <ActionCard icon={GraduationCap} title="Training" text={`${trainingPercent}% complete across manager, staff, parent, inspector and support tracks.`} href="/dashboard/admin/customer-success" />
          </div>
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Pilot Risk Register" subtitle="סיכונים משפטיים, פרטיות, אבטחה, UX, מצלמות, AI, תשלום ותמיכה.">
            <div className="procedure-list">
              {data.risks.map((risk) => (
                <article className="card procedure-card" key={risk.id ?? risk.risk_key}>
                  <div>
                    <StatusBadge tone={toneForStatus(risk.severity)}>{label(risk.severity)}</StatusBadge>
                    <h3>{risk.risk_title}</h3>
                    <p>{risk.mitigation}</p>
                    <small>{label(risk.risk_category)} · owner {risk.owner ?? "TBD"}</small>
                  </div>
                  <div className="procedure-meta"><StatusBadge tone={toneForStatus(risk.status)}>{label(risk.status)}</StatusBadge></div>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Pilot Exit Criteria" subtitle="תנאים לפני סימון הפיילוט כהושלם והחלטה על הצעד הבא.">
            <div className="camera-infra-list">
              {data.exitCriteria.map((criteria) => (
                <article className="camera-infra-row" key={criteria.id ?? criteria.criteria_key}>
                  <div>
                    <strong>{criteria.title}</strong>
                    <span>{criteria.evidence_summary}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(criteria.status)}>{label(criteria.status)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>
        </section>

        {criticalIssues || blockingGates ? (
          <div className="error-banner"><AlertTriangle size={16} /> הפיילוט עדיין חסום: {blockingGates} שערי אישור לא מאושרים ו־{criticalIssues} חסמים קריטיים פתוחים.</div>
        ) : (
          <div className="success-banner"><UsersRound size={16} /> הפיילוט נראה מוכן לשלב הבא, בכפוף לאישור משפטי/פרטיות/אבטחה חיצוני.</div>
        )}
      </div>
    </DashboardShell>
  );
}
