import Link from "next/link";
import { AlertTriangle, Bug, CheckCircle2, ClipboardCheck, MonitorSmartphone, ShieldAlert, UserCheck } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActionCard, CleanSection, EmptyState, PremiumDashboardHero, RoleMetricCard, StatusBadge } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, any>;
type Tone = "default" | "good" | "warn" | "bad";

function toneForStatus(status?: string | null): Tone {
  const value = String(status ?? "");
  if (["passed", "fixed", "verified"].includes(value)) return "good";
  if (["needs_review", "not_tested", "in_progress", "deferred"].includes(value)) return "warn";
  if (["failed", "blocked", "open", "critical", "high"].includes(value)) return "bad";
  return "default";
}

function toneForScore(score: number): Tone {
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

function label(value?: string | null) {
  return String(value ?? "unknown").replaceAll("_", " ");
}

function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

async function safeQuery<T>(labelText: string, run: () => any) {
  try {
    const result = (await run()) as { data: T[] | null; error: any };
    logSupabaseError(labelText, result.error);
    return result.error ? [] : result.data ?? [];
  } catch (error) {
    logSupabaseError(labelText, error);
    return [];
  }
}

function recommendation(score: number, criticalBlockers: number) {
  if (criticalBlockers > 0 || score < 50) return "not ready";
  if (score < 70) return "QA in progress";
  if (score < 85) return "pilot ready after fixes";
  return "pilot ready";
}

export default async function MasterQaPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("master qa", async () => {
    const supabase = await createClient();
    const [testCases, bugReports, workflowRuns, launchBlockers, finalGaps] = await Promise.all([
      safeQuery<Row>("qa test cases", () => supabase.from("qa_test_cases" as any).select("*").order("severity").order("test_area").limit(500)),
      safeQuery<Row>("qa bug reports", () => supabase.from("qa_bug_reports" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(250)),
      safeQuery<Row>("qa workflow runs", () => supabase.from("qa_workflow_runs" as any).select("*").order("workflow_area").limit(120)),
      safeQuery<Row>("launch blockers", () => supabase.from("launch_blockers" as any).select("*").order("created_at", { ascending: false }).limit(120)),
      safeQuery<Row>("final compliance gaps", () => supabase.from("final_compliance_gaps" as any).select("*").order("severity").limit(120))
    ]);
    return { testCases, bugReports, workflowRuns, launchBlockers, finalGaps };
  }, {
    testCases: [] as Row[],
    bugReports: [] as Row[],
    workflowRuns: [] as Row[],
    launchBlockers: [] as Row[],
    finalGaps: [] as Row[]
  });

  const data = result.data;
  const total = data.testCases.length;
  const passed = data.testCases.filter((test) => test.status === "passed").length;
  const failed = data.testCases.filter((test) => test.status === "failed").length;
  const blocked = data.testCases.filter((test) => test.status === "blocked").length;
  const needsReview = data.testCases.filter((test) => test.status === "needs_review" || test.status === "not_tested").length;
  const openBugs = data.bugReports.filter((bug) => !["fixed", "verified", "deferred"].includes(String(bug.status)));
  const criticalBlockers = openBugs.filter((bug) => bug.launch_blocker || bug.severity === "critical");
  const weightedScore = Math.max(0, Math.min(100, pct(passed, Math.max(total, 1)) + pct(data.workflowRuns.filter((run) => run.status === "passed").length, Math.max(data.workflowRuns.length, 1)) - criticalBlockers.length * 8 - blocked * 4));
  const roles = ["admin", "manager", "parent", "staff", "inspector", "public"];
  const areas = Array.from(new Set(data.testCases.map((test) => String(test.test_area)))).sort();
  const rec = recommendation(weightedScore, criticalBlockers.length);

  return (
    <DashboardShell role="admin" title="Master QA">
      <div className="commercial-dashboard">
        <PremiumDashboardHero
          eyebrow="Master QA"
          title="מרכז QA מקצה לקצה וייצוב באגים"
          subtitle="בדיקת כל התפקידים, הזרימות והחסמים במקום אחד. המטרה כאן היא אמת מוצרית: מה עבר, מה חסום ומה עדיין דורש בדיקה ידנית."
          badge={`${weightedScore}/100`}
          badgeTone={toneForScore(weightedScore)}
          actions={<><Link className="button primary" href="/dashboard/admin/launch-readiness">Launch readiness</Link><Link className="button secondary" href="/dashboard/admin/final-compliance-review">Final compliance</Link></>}
        >
          <div className="setup-checklist">
            <span>{rec}</span>
            <span>{criticalBlockers.length} critical blockers</span>
            <span>{needsReview} tests need review</span>
          </div>
        </PremiumDashboardHero>
        <AdminDataError message={result.error} />

        <section className="camera-infra-kpis">
          <RoleMetricCard label="QA readiness" value={`${weightedScore}%`} hint={rec} tone={toneForScore(weightedScore)} />
          <RoleMetricCard label="Passed" value={passed} hint={`${total} total test cases`} tone={passed ? "good" : "warn"} />
          <RoleMetricCard label="Failed" value={failed} hint="Test cases marked failed" tone={failed ? "bad" : "good"} />
          <RoleMetricCard label="Blocked" value={blocked} hint="Cannot proceed without fix or external setup" tone={blocked ? "bad" : "good"} />
          <RoleMetricCard label="Open bugs" value={openBugs.length} hint="Regression bug register" tone={openBugs.length ? "bad" : "good"} />
          <RoleMetricCard label="Critical blockers" value={criticalBlockers.length} hint="Prevents pilot readiness" tone={criticalBlockers.length ? "bad" : "good"} />
          <RoleMetricCard label="Role coverage" value={`${roles.filter((role) => data.testCases.some((test) => test.user_role === role)).length}/${roles.length}`} hint="Admin, manager, parent, staff, inspector, public" tone="warn" />
          <RoleMetricCard label="Workflow coverage" value={areas.length} hint="Test areas represented" tone="good" />
        </section>

        <section className="grid cols-3 dashboard-panels">
          <ActionCard icon={ClipboardCheck} title="QA matrix" text="Role-based and workflow-based test cases with expected and actual results." href="#qa-matrix" />
          <ActionCard icon={Bug} title="Bug register" text="Critical blockers, high priority bugs and stabilization issues." href="#bug-register" tone={criticalBlockers.length ? "bad" : "default"} />
          <ActionCard icon={MonitorSmartphone} title="Mobile QA" text="360px, 390px, 414px, tablet and desktop coverage still requires live browser/device QA." href="#workflow-coverage" tone="warn" />
        </section>

        <section className="grid cols-2 dashboard-panels">
          <CleanSection title="Critical Launch Blockers" subtitle="כל אחד מהפריטים האלה מונע המלצת Pilot Ready עד תיקון או אימות.">
            {criticalBlockers.length === 0 ? <EmptyState title="אין critical blockers פתוחים" /> : (
              <div className="camera-infra-list">
                {criticalBlockers.map((bug) => (
                  <article className="camera-infra-row" key={bug.id ?? bug.bug_key}>
                    <div>
                      <strong>{bug.title}</strong>
                      <span>{bug.actual_result}</span>
                    </div>
                    <StatusBadge tone="bad">{label(bug.severity)}</StatusBadge>
                  </article>
                ))}
              </div>
            )}
          </CleanSection>

          <CleanSection title="Role Coverage" subtitle="כל תפקיד נבדק בנפרד, כולל גבולות הרשאה ונתונים לא מורשים.">
            <div className="camera-infra-list">
              {roles.map((role) => {
                const roleTests = data.testCases.filter((test) => test.user_role === role);
                const roleBlocked = roleTests.filter((test) => test.status === "blocked").length;
                const rolePassed = roleTests.filter((test) => test.status === "passed").length;
                return (
                  <article className="camera-infra-row" key={role}>
                    <div>
                      <strong>{label(role)}</strong>
                      <span>{roleTests.length} tests · {rolePassed} passed · {roleBlocked} blocked</span>
                    </div>
                    <StatusBadge tone={roleBlocked ? "bad" : rolePassed ? "good" : "warn"}>{roleTests.length ? "covered" : "missing"}</StatusBadge>
                  </article>
                );
              })}
            </div>
          </CleanSection>
        </section>

        <CleanSection title="Workflow Coverage" subtitle="סטטוס הרצות QA מצטברות לפי מסע משתמש ותחום מוצר." action={<span id="workflow-coverage" />}>
          {data.workflowRuns.length === 0 ? <EmptyState title="אין workflow runs" text="לאחר הרצת המיגרציה יופיעו כאן suites מרכזיים." /> : (
            <div className="procedure-list">
              {data.workflowRuns.map((run) => (
                <article className="card procedure-card" key={run.id ?? run.run_key}>
                  <div>
                    <StatusBadge tone={toneForStatus(run.status)}>{label(run.status)}</StatusBadge>
                    <h3>{run.workflow_name}</h3>
                    <p>{run.notes}</p>
                    <small>{label(run.workflow_area)} · {label(run.role_scope)} · passed {run.passed_count} · blocked {run.blocked_count} · review {run.needs_review_count}</small>
                  </div>
                  <div className="procedure-meta">
                    <StatusBadge tone={toneForScore(Number(run.readiness_score ?? 0))}>{run.readiness_score}/100</StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <CleanSection title="QA Test Matrix" subtitle="בדיקות מפורטות לפי אזור, תפקיד, route ותוצאה צפויה." action={<span id="qa-matrix" />}>
          {data.testCases.length === 0 ? <EmptyState title="אין test cases" text="הרץ את מיגרציית Phase 161 כדי לטעון מטריצת QA ראשונית." /> : (
            <div className="procedure-list compact-list">
              {data.testCases.map((test) => (
                <article className="card procedure-card" key={test.id ?? test.test_key}>
                  <div>
                    <StatusBadge tone={toneForStatus(test.status)}>{label(test.status)}</StatusBadge>
                    <h3>{test.test_name}</h3>
                    <p>{test.actual_result ?? "Not tested yet"}</p>
                    <small>{label(test.test_area)} · {label(test.user_role)} · {test.related_route ?? "no route"} · expected: {test.expected_result}</small>
                  </div>
                  <div className="procedure-meta">
                    <StatusBadge tone={toneForStatus(test.severity)}>{label(test.severity)}</StatusBadge>
                    <StatusBadge tone="default">{test.assigned_owner}</StatusBadge>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <CleanSection title="Regression Bug Register" subtitle="באגים וחסמי יציבות שצריכים תיקון, אימות או החלטת דחייה." action={<span id="bug-register" />}>
          {data.bugReports.length === 0 ? <EmptyState title="אין באגים רשומים" /> : (
            <div className="procedure-list">
              {data.bugReports.map((bug) => (
                <article className="card procedure-card" key={bug.id ?? bug.bug_key}>
                  <div>
                    <StatusBadge tone={toneForStatus(bug.status)}>{label(bug.status)}</StatusBadge>
                    <h3>{bug.title}</h3>
                    <p>{bug.description}</p>
                    <small>{bug.route ?? "global"} · expected: {bug.expected_result} · actual: {bug.actual_result}</small>
                  </div>
                  <div className="procedure-meta">
                    <StatusBadge tone={toneForStatus(bug.severity)}>{label(bug.severity)}</StatusBadge>
                    {bug.launch_blocker ? <StatusBadge tone="bad">Launch blocker</StatusBadge> : <StatusBadge tone="default">Non-blocking</StatusBadge>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </CleanSection>

        <CleanSection title="QA Recommendation" subtitle="המלצה לפי מצב המטריצה, חסמים וסטטוס האימות המקומי.">
          <div className="grid cols-3">
            <ActionCard icon={ShieldAlert} title="Current recommendation" text={rec} href="/dashboard/admin/master-qa" tone={criticalBlockers.length ? "bad" : "warn"} />
            <ActionCard icon={AlertTriangle} title="Fix before pilot" text="Typecheck, build, parent isolation, camera gateway, payments and onboarding must be verified." href="#bug-register" tone="bad" />
            <ActionCard icon={CheckCircle2} title="After fixes" text="Run seeded browser QA for all roles and target mobile widths, then mark tests verified." href="/dashboard/admin/pilot-readiness" tone="default" />
          </div>
        </CleanSection>
      </div>
    </DashboardShell>
  );
}
