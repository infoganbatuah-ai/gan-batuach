import Link from "next/link";
import { AlertTriangle, CheckCircle2, Gauge, Rocket, Settings } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { AdminDataError } from "@/components/admin-data-state";
import { PremiumDashboardHero } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildLaunchReadinessSummary, readinessTone } from "@/lib/domain/launch-readiness";
import { updateLaunchBlocker, updateLaunchChecklistItem, updateLaunchIssue, updateLaunchReadinessScore, updatePerformanceReadinessCheck, updateProductionConfiguration } from "./actions";

const readinessStatuses = ["ready", "partial", "not_ready", "blocked"];
const configurationStatuses = ["ready", "partial", "not_ready", "blocked", "not_required"];
const checklistStatuses = ["pending", "in_progress", "completed", "verified", "blocked", "not_required"];
const issueStatuses = ["open", "investigating", "fixed", "verified", "accepted_risk"];
const severities = ["critical", "high", "medium", "low"];
const performanceStatuses = ["healthy", "degraded", "offline", "unknown", "not_configured"];

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
      <PremiumDashboardHero eyebrow="השקה" title="מוכנות לפיילוט והשקה." subtitle="חסמים, צ׳קליסט, פיילוט וביצועים במקום אחד." badge={<><Rocket size={16} /> {summary.launchStatus}</>} badgeTone={summary.launchStatus === "ready" ? "good" : summary.launchStatus === "blocked" ? "bad" : "warn"} actions={<Link className="button secondary" href="/dashboard/admin/pilot-center">מרכז פיילוט</Link>} />
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

      <section className="pilot-readiness-grid">
        <article className="pilot-score-card"><strong>Onboarding</strong><i><b>{summary.componentScores.onboarding}%</b></i><p>ליד, מנהלת, הורה וצוות</p></article>
        <article className="pilot-score-card"><strong>Communication</strong><i><b>{summary.componentScores.communication}%</b></i><p>אימייל, WhatsApp, SMS, Push</p></article>
        <article className="pilot-score-card"><strong>Cameras</strong><i><b>{summary.componentScores.camera}%</b></i><p>Gateway, הרשאות ובריאות</p></article>
        <article className="pilot-score-card"><strong>Observer</strong><i><b>{summary.componentScores.observer}%</b></i><p>Shadow mode וביקורת אנושית</p></article>
        <article className="pilot-score-card"><strong>Security</strong><i><b>{summary.componentScores.security}%</b></i><p>RLS, סודות וגיבויים</p></article>
        <article className="pilot-score-card"><strong>Support</strong><i><b>{summary.componentScores.support}%</b></i><p>תמיכה, הדרכה והסלמה</p></article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Gauge size={20} /> ציון מוכנות</h2><p>מה מוכן ומה עדיין דורש טיפול.</p></div>
          <div className="procedure-list compact-list">
            {result.data.readiness.map((item: any) => (
              <div className="mini-row" key={item.id}>
                <span>{item.category}</span>
                <strong className={readinessTone(item.status)}>{item.score}%</strong>
                <small>{item.evidence_summary} · {item.recommended_action}</small>
                <form className="inline-edit-form" action={updateLaunchReadinessScore}>
                  <input type="hidden" name="id" value={item.id} />
                  <label>Score<input name="score" type="number" min="0" max="100" defaultValue={item.score ?? 0} /></label>
                  <label>Status<select name="status" defaultValue={item.status}>{readinessStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                  <label className="wide">Evidence<input name="evidence_summary" defaultValue={item.evidence_summary ?? ""} /></label>
                  <label className="wide">Next action<input name="recommended_action" defaultValue={item.recommended_action ?? ""} /></label>
                  <button className="button secondary" type="submit">שמירה</button>
                </form>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><AlertTriangle size={20} /> חסמי השקה</h2><p>דברים שחייבים לפתור לפני הרחבה.</p></div>
          {openBlockers.length === 0 ? <div className="empty-state"><strong>אין חסמי השקה פתוחים</strong><span>אם יתגלה חסם, הוא יופיע כאן לפי חומרה.</span></div> : <div className="procedure-list compact-list">
            {openBlockers.map((blocker: any) => (
              <div className="mini-row" key={blocker.id}>
                <span>{blocker.title}</span>
                <strong className={blocker.severity === "critical" || blocker.severity === "high" ? "pill bad" : "pill warn"}>{blocker.severity}</strong>
                <small>{blocker.blocker_type} · {blocker.status} · {blocker.resolution ?? ""}</small>
                <form className="inline-edit-form" action={updateLaunchBlocker}>
                  <input type="hidden" name="id" value={blocker.id} />
                  <label>Severity<select name="severity" defaultValue={blocker.severity}>{severities.map((severity) => <option key={severity} value={severity}>{severity}</option>)}</select></label>
                  <label>Status<select name="status" defaultValue={blocker.status}>{issueStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                  <label>Due date<input name="due_date" type="date" defaultValue={blocker.due_date ?? ""} /></label>
                  <label className="wide">Resolution<input name="resolution" defaultValue={blocker.resolution ?? ""} /></label>
                  <button className="button secondary" type="submit">עדכון</button>
                </form>
              </div>
            ))}
          </div>}
        </article>
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Settings size={20} /> חיבורים והגדרות</h2><p>תקשורת, מצלמות, אבטחה וגיבויים.</p></div>
          <div className="procedure-list compact-list">
            {result.data.configuration.map((item: any) => (
              <div className="mini-row" key={item.id}>
                <span>{item.title}</span>
                <strong className={readinessTone(item.readiness_status)}>{item.readiness_status}</strong>
                <small>{item.required_for_launch ? "נדרש להשקה" : "אופציונלי"} · {item.recommended_action}</small>
                <form className="inline-edit-form" action={updateProductionConfiguration}>
                  <input type="hidden" name="id" value={item.id} />
                  <label>Status<select name="readiness_status" defaultValue={item.readiness_status}>{configurationStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                  <label className="wide">Evidence<input name="evidence_summary" defaultValue={item.evidence_summary ?? ""} /></label>
                  <label className="wide">Next action<input name="recommended_action" defaultValue={item.recommended_action ?? ""} /></label>
                  <button className="button secondary" type="submit">שמירה</button>
                </form>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><CheckCircle2 size={20} /> רשימת השקה</h2><p>שערים עיקריים לפני עלייה לאוויר.</p></div>
          <div className="procedure-list compact-list">
            {result.data.checklist.map((item: any) => (
              <div className="mini-row" key={item.id}>
                <span>{item.title}</span>
                <strong className={readinessTone(item.status)}>{item.status}</strong>
                <small>{item.required ? "חובה" : "אופציונלי"} · {item.evidence_url ?? ""}</small>
                <form className="inline-edit-form" action={updateLaunchChecklistItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <label>Status<select name="status" defaultValue={item.status}>{checklistStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                  <label className="wide">Evidence URL<input name="evidence_url" defaultValue={item.evidence_url ?? ""} /></label>
                  <label className="wide">Notes<input name="notes" defaultValue={item.notes ?? ""} /></label>
                  <button className="button secondary" type="submit">שמירה</button>
                </form>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><Gauge size={20} /> ביצועים</h2><p>בדיקות עומס וזמינות לפי תחום.</p></div>
          <div className="procedure-list compact-list">
            {result.data.performance.map((item: any) => (
              <div className="mini-row" key={item.id}>
                <span>{item.health_area}</span>
                <strong className={readinessTone(item.status)}>{item.status}</strong>
                <small>{item.recommended_action}</small>
                <form className="inline-edit-form" action={updatePerformanceReadinessCheck}>
                  <input type="hidden" name="id" value={item.id} />
                  <label>Status<select name="status" defaultValue={item.status}>{performanceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                  <label>Value<input name="latest_value" type="number" step="0.01" defaultValue={item.latest_value ?? ""} /></label>
                  <label className="wide">Next action<input name="recommended_action" defaultValue={item.recommended_action ?? ""} /></label>
                  <button className="button secondary" type="submit">שמירה</button>
                </form>
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
                <form className="inline-edit-form" action={updateLaunchIssue}>
                  <input type="hidden" name="id" value={issue.id} />
                  <label>Severity<select name="severity" defaultValue={issue.severity}>{severities.map((severity) => <option key={severity} value={severity}>{severity}</option>)}</select></label>
                  <label>Status<select name="status" defaultValue={issue.status}>{issueStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                  <label className="wide">Impact<input name="impact" defaultValue={issue.impact ?? ""} /></label>
                  <label className="wide">Resolution<input name="resolution" defaultValue={issue.resolution ?? ""} /></label>
                  <button className="button secondary" type="submit">עדכון</button>
                </form>
              </div>
              <span className={readinessTone(issue.status)}>{issue.status}</span>
            </article>
          ))}
        </div>}
      </section>
    </DashboardShell>
  );
}
