import Link from "next/link";
import { Bug, FileCheck2, KeyRound, LockKeyhole, Route, ShieldAlert, ShieldCheck } from "lucide-react";
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

function toneForStatus(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["approved", "ready_for_external_tester", "ready", "passed", "verified", "closed", "completed"].includes(value)) return "good";
  if (["draft", "planned", "triaged", "under_test", "scheduled", "retest_pending", "accepted_risk"].includes(value)) return "warn";
  if (["open", "blocked", "failed", "critical", "high"].includes(value)) return "bad";
  return "default";
}

function scoreTone(score: number): Tone {
  if (score >= 82) return "good";
  if (score >= 62) return "warn";
  return "bad";
}

function label(value?: string | null) {
  return String(value ?? "לא ידוע").replaceAll("_", " ");
}

export default async function SecurityReviewPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("security review center", async () => {
    const supabase = await createClient();
    const [scores, scopes, users, plans, findings, accessModes] = await Promise.all([
      safeQuery<Row>("penetration test readiness", () => supabase.from("penetration_test_readiness_score" as any).select("*").order("created_at", { ascending: false }).limit(1)),
      safeQuery<Row>("penetration test scopes", () => supabase.from("penetration_test_scopes" as any).select("*").order("approval_status").order("scope_name").limit(80)),
      safeQuery<Row>("security test user pack", () => supabase.from("security_test_user_pack" as any).select("*").order("role_key").limit(80)),
      safeQuery<Row>("security review test plans", () => supabase.from("security_review_test_plans" as any).select("*").order("severity").order("test_area").limit(160)),
      safeQuery<Row>("external security findings", () => supabase.from("external_security_findings" as any).select("*").order("severity").order("due_date").limit(160)),
      safeQuery<Row>("external tester access modes", () => supabase.from("external_tester_access_modes" as any).select("*").order("mode_key").limit(20))
    ]);
    return { scores, scopes, users, plans, findings, accessModes };
  }, {
    scores: [] as Row[],
    scopes: [] as Row[],
    users: [] as Row[],
    plans: [] as Row[],
    findings: [] as Row[],
    accessModes: [] as Row[]
  });

  const data = result.data;
  const score = data.scores[0];
  const readinessScore = Number(score?.readiness_score ?? 0);
  const readyScopes = data.scopes.filter((scope) => ["ready_for_external_tester", "approved", "completed"].includes(String(scope.approval_status))).length;
  const generatedUsers = data.users.filter((user) => ["generated", "delivered_to_tester"].includes(String(user.credential_delivery_status))).length;
  const openFindings = data.findings.filter((finding) => !["verified", "closed", "accepted_risk"].includes(String(finding.status)));
  const criticalFindings = openFindings.filter((finding) => finding.severity === "critical").length;
  const highFindings = openFindings.filter((finding) => finding.severity === "high").length;
  const retestPending = data.findings.filter((finding) => finding.status === "fixed").length;
  const criticalPlans = data.plans.filter((plan) => ["critical", "high"].includes(String(plan.severity)));

  return (
    <DashboardShell role="admin" title="Security Review">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="External Penetration Test Readiness"
          title="מרכז הכנה לבדיקת חדירה חיצונית"
          subtitle="חבילת scope, משתמשי בדיקה, תוכניות בדיקה וממצאים לחברת אבטחה מורשית. אין כאן בדיקות הרסניות ואין גישה לסודות או לנתוני ייצור."
          badge={`${readinessScore}/100`}
          badgeTone={scoreTone(readinessScore)}
          actions={<><Link className="button primary" href="/dashboard/admin/security-center">מרכז אבטחה</Link><Link className="button secondary" href="/dashboard/admin/security-pipeline">Security Pipeline</Link></>}
        >
          <div className="setup-checklist">
            <span>Staging / sandbox only</span>
            <span>אין בדיקות הרסניות</span>
            <span>אין production secrets או נתונים אמיתיים</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="PT readiness" value={`${readinessScore}/100`} hint="Readiness only" tone={scoreTone(readinessScore)} />
          <RoleMetricCard label="Scopes ready" value={`${readyScopes}/${data.scopes.length}`} hint="מסלולי בדיקה" tone={readyScopes === data.scopes.length && data.scopes.length ? "good" : "warn"} />
          <RoleMetricCard label="Test users" value={`${generatedUsers}/${data.users.length}`} hint="credentials לא נשמרים כאן" tone={generatedUsers ? "good" : "warn"} />
          <RoleMetricCard label="Test plans" value={data.plans.length} hint={`${criticalPlans.length} high/critical`} tone="good" />
          <RoleMetricCard label="Open findings" value={openFindings.length} hint="ממתינים לטיפול" tone={openFindings.length ? "warn" : "good"} />
          <RoleMetricCard label="Critical" value={criticalFindings} hint="חוסם פיילוט" tone={criticalFindings ? "bad" : "good"} />
          <RoleMetricCard label="High" value={highFindings} hint="חוסם production" tone={highFindings ? "bad" : "good"} />
          <RoleMetricCard label="Retest pending" value={retestPending} hint="תוקן וממתין אימות" tone={retestPending ? "warn" : "good"} />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <ActionCard icon={FileCheck2} title="Rules of engagement" text="סביבת בדיקה, פעולות אסורות, חלון בדיקה, דיווח והסלמה." href="/dashboard/admin/docs/PENETRATION_TEST_RULES_OF_ENGAGEMENT" />
          <ActionCard icon={ShieldCheck} title="Security architecture pack" text="Auth, RLS, storage, camera, AI, payments, audit and data protection." href="/dashboard/admin/docs/SECURITY_ARCHITECTURE_EXTERNAL_REVIEW_PACK" />
          <ActionCard icon={Bug} title="External review checklist" text="Authentication, authorization, RLS, API, storage, cameras, payments, AI, mobile." href="/dashboard/admin/docs/EXTERNAL_SECURITY_REVIEW_CHECKLIST" />
          <ActionCard icon={Route} title="Master PT package" text="Scope, roles, test users, findings workflow and remediation workflow." href="/dashboard/admin/docs/EXTERNAL_PENETRATION_TEST_AND_SECURITY_REVIEW_PREPARATION" />
        </section>

        <CleanSection title="Penetration Test Scopes" subtitle="מה מותר לבדוק, באיזו סביבה, ומה מחוץ לתחום.">
          {data.scopes.length === 0 ? <EmptyState title="אין scope מוגדר" text="הרצת מיגרציית Phase 167 תוסיף scope." /> : (
            <div className="procedure-list">
              {data.scopes.map((scope) => (
                <article className="card procedure-card" key={scope.id ?? scope.scope_key}>
                  <div>
                    <StatusBadge tone={toneForStatus(scope.approval_status)}>{label(scope.approval_status)}</StatusBadge>
                    <h3>{scope.scope_name}</h3>
                    <p>{scope.test_restrictions}</p>
                    <small>Environment {scope.environment} · roles {(scope.included_roles ?? []).join?.(", ") ?? "configured"}</small>
                  </div>
                  <div className="procedure-meta">
                    <StatusBadge tone={scope.environment === "production_readonly" ? "warn" : "good"}>{scope.environment}</StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Security Test User Pack" subtitle="משתמשי בדיקה מתועדים. credentials לא נשמרים במסד הנתונים.">
            <div className="camera-infra-list">
              {data.users.map((user) => (
                <article className="camera-infra-row" key={user.id ?? user.user_key}>
                  <div>
                    <strong>{user.display_name}</strong>
                    <span>{user.permissions_summary}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(user.account_state)}>{label(user.account_state)}</StatusBadge>
                  <StatusBadge tone={toneForStatus(user.mfa_state)}>{label(user.mfa_state)}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="External Security Findings" subtitle="ממצאי PT ייכנסו לכאן ויעברו triage, fix, retest, verify.">
            {data.findings.length === 0 ? <EmptyState title="אין ממצאים" /> : (
              <div className="camera-infra-list">
                {data.findings.map((finding) => (
                  <article className="camera-infra-row" key={finding.id ?? finding.finding_key}>
                    <div>
                      <strong>{finding.finding_title}</strong>
                      <span>{finding.affected_system} · {finding.recommendation}</span>
                    </div>
                    <StatusBadge tone={toneForStatus(finding.severity)}>{label(finding.severity)}</StatusBadge>
                    <StatusBadge tone={toneForStatus(finding.status)}>{label(finding.status)}</StatusBadge>
                  </article>
                ))}
              </div>
            )}
          </CleanSection>
        </section>

        <CleanSection title="Security Test Plans" subtitle="תוכניות בדיקה שמיועדות לחברה חיצונית מורשית, עם תוצאה צפויה ופעולות אסורות.">
          <div className="procedure-list">
            {data.plans.map((plan) => (
              <article className="card procedure-card" key={plan.id ?? plan.plan_key}>
                <div>
                  <StatusBadge tone={toneForStatus(plan.severity)}>{label(plan.severity)}</StatusBadge>
                  <StatusBadge tone={toneForStatus(plan.status)}>{label(plan.status)}</StatusBadge>
                  <h3>{plan.title}</h3>
                  <p>{plan.objective}</p>
                  <small>Expected: {plan.expected_result}</small>
                </div>
                <div className="procedure-meta">
                  <StatusBadge tone="default">{label(plan.test_area)}</StatusBadge>
                </div>
              </article>
            ))}
          </div>
        </CleanSection>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="External Tester Access Mode" subtitle="מה בודק חיצוני יכול לראות ומה חסום לחלוטין.">
            <div className="camera-infra-list">
              {data.accessModes.map((mode) => (
                <article className="camera-infra-row" key={mode.id ?? mode.mode_key}>
                  <div>
                    <strong>{mode.mode_key}</strong>
                    <span>{mode.notes}</span>
                  </div>
                  <StatusBadge tone={toneForStatus(mode.status)}>{label(mode.status)}</StatusBadge>
                  <StatusBadge tone="good">{mode.testing_environment}</StatusBadge>
                </article>
              ))}
            </div>
          </CleanSection>

          <CleanSection title="Critical Security Areas" subtitle="נקודות שחייבות כיסוי בבדיקת החדירה.">
            <div className="communication-template-grid">
              <article className="communication-template-card"><LockKeyhole /><div><strong>Auth / MFA / Sessions</strong><span>Login, lockout, trusted devices, session expiry.</span></div></article>
              <article className="communication-template-card"><KeyRound /><div><strong>RLS / IDOR</strong><span>Parent, garden, inspector and admin boundaries.</span></div></article>
              <article className="communication-template-card"><ShieldAlert /><div><strong>Camera / AI</strong><span>No RTSP exposure, no raw AI to parents.</span></div></article>
              <article className="communication-template-card"><Bug /><div><strong>Payments / Webhooks</strong><span>No raw card data, idempotency, replay protection.</span></div></article>
            </div>
          </CleanSection>
        </section>
      </div>
    </DashboardShell>
  );
}
