import { Activity, Bug, CheckCircle2, Code2, GitBranch, KeyRound, PackageSearch, ShieldAlert, Workflow } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { StatCard } from "@/components/stat-card";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

function toneForStatus(status?: string | null): "good" | "warn" | "bad" {
  if (["passed", "ready", "fixed", "verified", "resolved"].includes(String(status))) return "good";
  if (["failed", "blocked", "critical", "open"].includes(String(status))) return "bad";
  return "warn";
}

function toneForScore(score: number): "good" | "warn" | "bad" {
  if (score >= 80) return "good";
  if (score >= 55) return "warn";
  return "bad";
}

function severityTone(severity?: string | null): "good" | "warn" | "bad" {
  if (["critical", "high"].includes(String(severity))) return "bad";
  if (String(severity) === "medium") return "warn";
  return "good";
}

export default async function AdminSecurityPipelinePage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("security pipeline", async () => {
    const supabase = await createClient();
    async function safeQuery<T>(index: number, run: () => PromiseLike<{ data: T[] | null; error: unknown }>) {
      try {
        const query = await run();
        logSupabaseError(`security pipeline query ${index}`, query.error);
        return { data: query.error ? [] as T[] : query.data ?? [], available: !query.error };
      } catch (error) {
        logSupabaseError(`security pipeline query ${index}`, error);
        return { data: [] as T[], available: false };
      }
    }
    const [runsRes, findingsRes, controlsRes, readinessRes, securityFindingsRes] = await Promise.all([
      safeQuery(0, () => supabase.from("security_pipeline_runs" as any).select("*").order("created_at", { ascending: false }).limit(80)),
      safeQuery(1, () => supabase.from("security_pipeline_findings" as any).select("*").order("created_at", { ascending: false }).limit(200)),
      safeQuery(2, () => supabase.from("security_pipeline_controls" as any).select("*").order("control_area").limit(100)),
      safeQuery(3, () => supabase.from("security_readiness_checks" as any).select("*").in("category", ["ci_cd", "sast", "dast", "dependency_scanning", "secret_scanning", "migration_safety", "branch_protection"]).order("severity").limit(120)),
      safeQuery(4, () => supabase.from("security_findings" as any).select("*").order("detected_at", { ascending: false }).limit(120))
    ]);
    const available = [runsRes, findingsRes, controlsRes, readinessRes, securityFindingsRes].map((query) => query.available);
    return {
      runs: runsRes.data ?? [],
      findings: findingsRes.data ?? [],
      controls: controlsRes.data ?? [],
      readiness: readinessRes.data ?? [],
      securityFindings: securityFindingsRes.data ?? [],
      available,
      queryError: available.some((value) => !value)
        ? "חלק מנתוני security pipeline אינם זמינים כרגע."
        : null
    };
  }, { available: Array<boolean>(5).fill(false), runs: [] as any[], findings: [] as any[], controls: [] as any[], readiness: [] as any[], securityFindings: [] as any[], queryError: null as string | null });

  const known = (...indices: number[]) => indices.every((index) => result.data.available[index]);
  const unavailable = "לא זמין";
  const scoreKnown = known(0, 1, 2);
  const runs = result.data.runs;
  const findings = result.data.findings;
  const openFindings = findings.filter((finding: any) => ["open", "triaged"].includes(String(finding.status)));
  const critical = openFindings.filter((finding: any) => finding.severity === "critical").length;
  const high = openFindings.filter((finding: any) => finding.severity === "high").length;
  const controlsReady = result.data.controls.filter((control: any) => control.status === "ready").length;
  const requiredControls = result.data.controls.filter((control: any) => control.required).length;
  const blockingMissing = result.data.controls.filter((control: any) => control.blocking && !["ready", "partial"].includes(String(control.status))).length;
  const lastRun = runs[0] as any | undefined;
  const readinessScore = Math.round((
    (requiredControls ? Math.round((controlsReady / requiredControls) * 100) : 35) +
    (critical ? 20 : high ? 55 : 90) +
    (lastRun?.status === "passed" ? 95 : lastRun ? 45 : 35) +
    (blockingMissing ? 35 : 85)
  ) / 4);

  return (
    <DashboardShell role="admin" title="Security Pipeline">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">CI/CD Security Gates</p>
          <h1>מרכז Security Pipeline.</h1>
          <p>נראות לשערי typecheck, build, dependency audit, secret scanning, CodeQL, migration safety ו-readiness לייצור.</p>
          <p>הציונים והתגים מתארים רשומות נתונים בלבד; אינם אישור Production, הוכחת CI עדכני או סקירת אבטחה מלאה.</p>
        </div>
        <div className="profile-actions">
          <span className={scoreKnown ? `pill ${toneForScore(readinessScore)}` : "pill"}>{scoreKnown ? `${readinessScore}/100` : unavailable}</span>
          <span className={known(1) ? critical || high ? "pill bad" : "pill good" : "pill"}>{known(1) ? critical || high ? "Production blocked" : "No high blockers" : unavailable}</span>
        </div>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="grid cols-4 dashboard-kpis">
        <StatCard label="Last security scan" value={known(0) ? lastRun?.status ?? "no runs" : unavailable} tone={known(0) ? toneForStatus(lastRun?.status) : "default"} />
        <StatCard label="Dependency scan" value={known(0) ? lastRun?.dependency_scan_status ?? "pending" : unavailable} tone={known(0) ? toneForStatus(lastRun?.dependency_scan_status) : "default"} />
        <StatCard label="Secret scan" value={known(0) ? lastRun?.secret_scan_status ?? "pending" : unavailable} tone={known(0) ? toneForStatus(lastRun?.secret_scan_status) : "default"} />
        <StatCard label="CodeQL" value={known(0) ? lastRun?.codeql_status ?? "readiness" : unavailable} tone={known(0) ? toneForStatus(lastRun?.codeql_status) : "default"} />
        <StatCard label="Critical findings" value={known(1) ? critical : unavailable} tone={known(1) ? critical ? "bad" : "good" : "default"} />
        <StatCard label="High findings" value={known(1) ? high : unavailable} tone={known(1) ? high ? "bad" : "good" : "default"} />
        <StatCard label="Controls ready" value={known(2) ? `${controlsReady}/${requiredControls || result.data.controls.length}` : unavailable} tone={known(2) ? toneForScore(requiredControls ? (controlsReady / requiredControls) * 100 : 0) : "default"} />
        <StatCard label="Build gate" value={known(0) ? lastRun?.build_status ?? "pending" : unavailable} tone={known(0) ? toneForStatus(lastRun?.build_status) : "default"} />
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Workflow size={20} /> Build Gates</h2><p>בדיקות שחייבות לעבור לפני readiness לייצור.</p></div>
          <div className="procedure-list compact-list">
            {["typecheck_status", "build_status", "diff_check_status", "dependency_scan_status", "secret_scan_status", "codeql_status", "migration_safety_status"].map((key) => (
              <div className="mini-row" key={key}>
                <span>{key.replace("_status", "").replaceAll("_", " ")}</span>
                <strong className={known(0) ? `pill ${toneForStatus(lastRun?.[key] ?? "pending")}` : "pill"}>{known(0) ? lastRun?.[key] ?? "pending" : unavailable}</strong>
                <small>{known(0) ? lastRun?.workflow_name ?? ".github/workflows/security-checks.yml" : unavailable}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><ShieldAlert size={20} /> Security Findings</h2><p>Critical/High חוסמים production readiness.</p></div>
          <div className="procedure-list compact-list">
            {!known(1) ? <div className="empty-mini">נתוני הממצאים אינם זמינים.</div> : openFindings.length === 0 ? <div className="empty-mini">אין findings פתוחים.</div> : openFindings.slice(0, 10).map((finding: any) => (
              <div className="mini-row" key={finding.id}>
                <span>{finding.finding_key}</span>
                <strong className={`pill ${severityTone(finding.severity)}`}>{finding.severity}</strong>
                <small>{finding.source} · {finding.status}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><GitBranch size={20} /> Branch Protection</h2><p>המלצות חובה ל-GitHub לפני production.</p></div>
          <div className="risk-list">
            <div>Require PR <b>required</b></div>
            <div>Require checks <b>typecheck/build/security</b></div>
            <div>Prevent force push <b>required</b></div>
            <div>Require review <b>required</b></div>
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Code2 size={20} /> Controls</h2><p>Provider-ready security gate controls.</p></div>
          <div className="procedure-list compact-list">
            {!known(2) ? <div className="empty-mini">נתוני הבקרות אינם זמינים.</div> : result.data.controls.map((control: any) => (
              <div className="mini-row" key={control.id}>
                <span>{control.title}</span>
                <strong className={`pill ${toneForStatus(control.status)}`}>{control.status}</strong>
                <small>{control.control_area} · {control.tool_name ?? "policy"}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><Activity size={20} /> Readiness Checks</h2><p>מוכנות ISO ו-security governance.</p></div>
          <div className="procedure-list compact-list">
            {!known(3) ? <div className="empty-mini">נתוני בדיקות המוכנות אינם זמינים.</div> : result.data.readiness.map((check: any) => (
              <div className="mini-row" key={check.id}>
                <span>{check.title}</span>
                <strong className={`pill ${toneForStatus(check.status)}`}>{check.status}</strong>
                <small>{check.category} · {check.severity}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-4 dashboard-panels">
        <article className="card compact-card"><PackageSearch /><h3>npm audit</h3><p>High/Critical חוסמים readiness אלא אם יש accepted risk מתועד.</p></article>
        <article className="card compact-card"><KeyRound /><h3>Secret scanning</h3><p>Service role, encryption keys, payment tokens, camera secrets ו-RTSP לא נכנסים לקוד.</p></article>
        <article className="card compact-card"><Bug /><h3>DAST readiness</h3><p>בדיקות דינמיות יופעלו רק מול staging ולא בצורה הרסנית.</p></article>
        <article className="card compact-card"><CheckCircle2 /><h3>Production rule</h3><p>ייצור מותר רק אחרי typecheck, build, security checks וללא critical.</p></article>
      </section>
    </DashboardShell>
  );
}
