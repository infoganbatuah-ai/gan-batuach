import Link from "next/link";
import { AlertTriangle, CheckCircle2, Gauge, Rocket, Settings } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildLaunchReadinessSummary, readinessTone } from "@/lib/domain/launch-readiness";

export default async function AdminLaunchReadinessPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("launch readiness", async () => {
    const supabase = await createClient();
    const [readinessRes, configRes, issuesRes, blockersRes, checklistRes, pilotsRes, participantsRes, successRes, performanceRes] = await Promise.all([
      supabase.from("launch_readiness_scores" as any).select("*").order("category"),
      supabase.from("production_configuration_readiness" as any).select("*").order("category"),
      supabase.from("launch_issues" as any).select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("launch_blockers" as any).select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("launch_checklist" as any).select("*").order("category"),
      supabase.from("pilot_programs" as any).select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("pilot_participants" as any).select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("customer_success_readiness" as any).select("*").order("material_type"),
      supabase.from("performance_readiness_checks" as any).select("*").order("health_area")
    ]);
    [readinessRes, configRes, issuesRes, blockersRes, checklistRes, pilotsRes, participantsRes, successRes, performanceRes].forEach((query, index) => logSupabaseError(`launch readiness query ${index}`, (query as any).error));
    return {
      readiness: readinessRes.data ?? [],
      configuration: configRes.data ?? [],
      issues: issuesRes.data ?? [],
      blockers: blockersRes.data ?? [],
      checklist: checklistRes.data ?? [],
      pilots: pilotsRes.data ?? [],
      participants: participantsRes.data ?? [],
      success: successRes.data ?? [],
      performance: performanceRes.data ?? [],
      summary: buildLaunchReadinessSummary({ readiness: readinessRes.data ?? [], configuration: configRes.data ?? [], issues: issuesRes.data ?? [], blockers: blockersRes.data ?? [], checklist: checklistRes.data ?? [], pilots: pilotsRes.data ?? [], participants: participantsRes.data ?? [] }),
      queryError: [readinessRes.error, configRes.error, issuesRes.error, blockersRes.error, checklistRes.error, pilotsRes.error, participantsRes.error, successRes.error, performanceRes.error].some(Boolean) ? "חלק מנתוני מוכנות ההשקה לא נטענו" : null
    };
  }, { readiness: [] as any[], configuration: [] as any[], issues: [] as any[], blockers: [] as any[], checklist: [] as any[], pilots: [] as any[], participants: [] as any[], success: [] as any[], performance: [] as any[], summary: buildLaunchReadinessSummary(), queryError: null as string | null });

  const { summary } = result.data;
  const openBlockers = result.data.blockers.filter((blocker: any) => !["verified", "accepted_risk"].includes(String(blocker.status)));
  const openIssues = result.data.issues.filter((issue: any) => !["verified", "accepted_risk"].includes(String(issue.status)));

  return (
    <DashboardShell role="admin" title="Launch Readiness">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Go Live</p>
          <h1>מוכנות לפיילוט מסחרי והשקה.</h1>
          <p>ציון מוכנות, חסמים, בעיות פתוחות, סטטוס פיילוט, קונפיגורציה, ביצועים וצ׳קליסט Go-live.</p>
        </div>
        <div className="profile-actions">
          <span className={summary.launchStatus === "ready" ? "pill good" : summary.launchStatus === "blocked" ? "pill bad" : "pill warn"}><Rocket size={16} /> {summary.launchStatus}</span>
          <Link className="button secondary" href="/dashboard/admin/pilot-center">מרכז פיילוט</Link>
        </div>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="grid cols-4 dashboard-kpis">
        <StatCard label="Readiness" value={`${summary.overallScore}%`} tone={summary.overallScore >= 85 ? "good" : summary.overallScore >= 60 ? "warn" : "bad"} />
        <StatCard label="Checklist" value={`${summary.checklistPercent}%`} tone={summary.checklistPercent >= 80 ? "good" : "warn"} />
        <StatCard label="חסמים פתוחים" value={summary.openBlockers} tone={summary.openBlockers ? "bad" : "good"} />
        <StatCard label="בעיות פתוחות" value={summary.openIssues} tone={summary.openIssues ? "warn" : "good"} />
        <StatCard label="Critical" value={summary.criticalIssues} tone={summary.criticalIssues ? "bad" : "good"} />
        <StatCard label="High" value={summary.highIssues} tone={summary.highIssues ? "bad" : "good"} />
        <StatCard label="Config ready" value={`${summary.configurationReady}/${result.data.configuration.length}`} tone={summary.configurationPending ? "warn" : "good"} />
        <StatCard label="פיילוטים פעילים" value={summary.activePilots} tone="good" />
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Gauge size={20} /> Readiness score</h2><p>תשתית, קליטה, התראות, תצפיתן, מצלמות, אבטחה, ביצועים ותמיכה.</p></div>
          <div className="procedure-list compact-list">
            {result.data.readiness.map((item: any) => (
              <div className="mini-row" key={item.id}>
                <span>{item.category}</span>
                <strong className={readinessTone(item.status)}>{item.score}%</strong>
                <small>{item.evidence_summary} · {item.recommended_action}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><AlertTriangle size={20} /> Launch blockers</h2><p>חסמים שמונעים הרחבת פיילוט או השקה.</p></div>
          {openBlockers.length === 0 ? <div className="empty-state"><strong>אין חסמי השקה פתוחים</strong><span>אם יתגלה חסם, הוא יופיע כאן לפי חומרה.</span></div> : <div className="procedure-list compact-list">
            {openBlockers.map((blocker: any) => (
              <div className="mini-row" key={blocker.id}>
                <span>{blocker.title}</span>
                <strong className={blocker.severity === "critical" || blocker.severity === "high" ? "pill bad" : "pill warn"}>{blocker.severity}</strong>
                <small>{blocker.blocker_type} · {blocker.status} · {blocker.resolution ?? ""}</small>
              </div>
            ))}
          </div>}
        </article>
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Settings size={20} /> Production configuration</h2><p>WhatsApp, SMS, Push, Email, Cameras, AI, Security, Backups.</p></div>
          <div className="procedure-list compact-list">
            {result.data.configuration.map((item: any) => (
              <div className="mini-row" key={item.id}>
                <span>{item.title}</span>
                <strong className={readinessTone(item.readiness_status)}>{item.readiness_status}</strong>
                <small>{item.required_for_launch ? "נדרש להשקה" : "אופציונלי"} · {item.recommended_action}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><CheckCircle2 size={20} /> Go-live checklist</h2><p>שערי השקה עיקריים.</p></div>
          <div className="procedure-list compact-list">
            {result.data.checklist.map((item: any) => (
              <div className="mini-row" key={item.id}>
                <span>{item.title}</span>
                <strong className={readinessTone(item.status)}>{item.status}</strong>
                <small>{item.required ? "חובה" : "אופציונלי"} · {item.evidence_url ?? ""}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><Gauge size={20} /> Performance readiness</h2><p>Database, API, Observer, Notifications, Camera.</p></div>
          <div className="procedure-list compact-list">
            {result.data.performance.map((item: any) => (
              <div className="mini-row" key={item.id}>
                <span>{item.health_area}</span>
                <strong className={readinessTone(item.status)}>{item.status}</strong>
                <small>{item.recommended_action}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Open launch issues</h2><p>פתוחות, investigating או fixed עד verification.</p></div>
        {openIssues.length === 0 ? <div className="empty-state"><strong>אין בעיות פתוחות</strong><span>בעיות פיילוט והשקה יופיעו כאן.</span></div> : <div className="procedure-list">
          {openIssues.slice(0, 12).map((issue: any) => (
            <article className="card procedure-card" key={issue.id}>
              <div>
                <span className={issue.severity === "critical" || issue.severity === "high" ? "pill bad" : "pill warn"}>{issue.severity}</span>
                <h3>{issue.title}</h3>
                <p>{issue.impact ?? issue.category}</p>
                <small>{issue.resolution ?? "ממתין לטיפול"}</small>
              </div>
              <span className={readinessTone(issue.status)}>{issue.status}</span>
            </article>
          ))}
        </div>}
      </section>
    </DashboardShell>
  );
}
