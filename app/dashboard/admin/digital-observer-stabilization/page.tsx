import Link from "next/link";
import { AlertTriangle, Bell, Camera, CheckCircle2, Gauge, HelpCircle, Radar, ShieldCheck, Wrench } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  DIGITAL_OBSERVER_KNOWLEDGE_BASE_ARTICLES,
  DIGITAL_OBSERVER_LAUNCH_DECISION_STATES,
  DIGITAL_OBSERVER_PACKAGE_RECOMMENDATIONS,
  DIGITAL_OBSERVER_STABILIZATION_AREAS,
  DIGITAL_OBSERVER_SUPPORT_PLAYBOOKS
} from "@/lib/domain/digital-observer-product";

function pill(status?: string | null) {
  const value = String(status ?? "");
  if (["fixed", "verified", "published", "approved", "active", "standalone_launch_ready", "paid_beta_ready", "pilot_ready"].includes(value)) return "pill good";
  if (["new", "triaged", "in_progress", "ready_for_review", "needs_more_pilots", "deferred", "requires_external_provider", "requires_legal_review"].includes(value)) return "pill warn";
  if (["open", "critical", "high", "not_ready", "rejected", "blocked"].includes(value)) return "pill bad";
  return "pill";
}

function scorePill(score: number) {
  if (score >= 80) return "pill good";
  if (score >= 55) return "pill warn";
  return "pill bad";
}

export default async function AdminDigitalObserverStabilizationPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("digital observer stabilization", async () => {
    const supabase = await createClient();
    const [pilotSites, supportIssues, feedback, stabilization, fp, fn, calibration, playbooks, kb, packageFeedback, packageRules, gaps, decisions, domains, readiness] = await Promise.all([
      supabase.from("digital_observer_pilot_sites" as any).select("id, site_name, site_type, pilot_status, readiness_score, gateway_status, calibration_status, open_issues_count, observer_alerts_count").order("created_at", { ascending: false }).limit(100),
      supabase.from("digital_observer_pilot_support_issues" as any).select("*, digital_observer_pilot_sites(site_name)").order("created_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_pilot_feedback" as any).select("*, digital_observer_pilot_sites(site_name)").order("created_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_stabilization_actions" as any).select("*, digital_observer_pilot_sites(site_name)").order("created_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_false_positive_analysis" as any).select("*, digital_observer_pilot_sites(site_name), camera_streams(name)").order("updated_at", { ascending: false }).limit(100),
      supabase.from("digital_observer_false_negative_analysis" as any).select("*, digital_observer_pilot_sites(site_name), camera_streams(name)").order("updated_at", { ascending: false }).limit(100),
      supabase.from("digital_observer_pilot_calibration_profiles" as any).select("*, digital_observer_pilot_sites(site_name), camera_streams(name)").order("updated_at", { ascending: false }).limit(120),
      supabase.from("digital_observer_support_playbooks" as any).select("*").order("category", { ascending: true }).limit(120),
      supabase.from("digital_observer_knowledge_base_articles" as any).select("*").order("category", { ascending: true }).limit(120),
      supabase.from("digital_observer_package_feedback" as any).select("*, digital_observer_pilot_sites(site_name)").order("created_at", { ascending: false }).limit(100),
      supabase.from("digital_observer_package_recommendation_rules" as any).select("*").order("created_at", { ascending: true }).limit(100),
      supabase.from("digital_observer_standalone_gaps" as any).select("*").order("severity", { ascending: true }).limit(200),
      supabase.from("digital_observer_launch_decisions" as any).select("*").order("updated_at", { ascending: false }).limit(20),
      supabase.from("digital_observer_domain_separation_reviews" as any).select("*").order("created_at", { ascending: true }).limit(20),
      supabase.from("digital_observer_pilot_readiness_snapshots" as any).select("*, digital_observer_pilot_sites(site_name)").order("calculated_at", { ascending: false }).limit(100)
    ]);
    [pilotSites, supportIssues, feedback, stabilization, fp, fn, calibration, playbooks, kb, packageFeedback, packageRules, gaps, decisions, domains, readiness].forEach((query, index) => logSupabaseError("digital observer stabilization query " + index, query.error));
    return {
      pilotSites: pilotSites.data ?? [],
      supportIssues: supportIssues.data ?? [],
      feedback: feedback.data ?? [],
      stabilization: stabilization.data ?? [],
      fp: fp.data ?? [],
      fn: fn.data ?? [],
      calibration: calibration.data ?? [],
      playbooks: playbooks.data ?? [],
      kb: kb.data ?? [],
      packageFeedback: packageFeedback.data ?? [],
      packageRules: packageRules.data ?? [],
      gaps: gaps.data ?? [],
      decisions: decisions.data ?? [],
      domains: domains.data ?? [],
      readiness: readiness.data ?? [],
      queryError: pilotSites.error ? "לא ניתן לטעון נתוני ייצוב Digital Observer כרגע" : null
    };
  }, {
    pilotSites: [] as any[],
    supportIssues: [] as any[],
    feedback: [] as any[],
    stabilization: [] as any[],
    fp: [] as any[],
    fn: [] as any[],
    calibration: [] as any[],
    playbooks: [] as any[],
    kb: [] as any[],
    packageFeedback: [] as any[],
    packageRules: [] as any[],
    gaps: [] as any[],
    decisions: [] as any[],
    domains: [] as any[],
    readiness: [] as any[],
    queryError: null as string | null
  });

  const data = result.data;
  const decision = data.decisions[0];
  const launchScore = Number(decision?.readiness_score ?? data.readiness[0]?.readiness_score ?? 0);
  const openIssues = data.supportIssues.filter((item) => !["fixed", "verified", "closed", "deferred"].includes(item.status)).length;
  const cameraIssues = data.stabilization.filter((item) => item.area === "camera" && !["fixed", "verified"].includes(item.status)).length;
  const gatewayIssues = data.stabilization.filter((item) => item.area === "gateway" && !["fixed", "verified"].includes(item.status)).length;
  const alertIssues = data.stabilization.filter((item) => item.area === "alerts" && !["fixed", "verified"].includes(item.status)).length;
  const uxIssues = data.stabilization.filter((item) => item.area === "ux" && !["fixed", "verified"].includes(item.status)).length;
  const criticalGaps = data.gaps.filter((gap) => gap.severity === "critical" || gap.severity === "high").length;

  return (
    <DashboardShell role="admin" title="Digital Observer Stabilization">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Pilot stabilization</p>
          <h1>Digital Observer launch decision center.</h1>
          <p>מייצב את פיילוט הבית/עסק: מצלמות, gateway, playback, alerts, כיול, UX, pricing, support והחלטת standalone launch.</p>
        </div>
        <div className="hero-actions">
          <Link className="button primary" href="/dashboard/admin/digital-observer-pilot">Pilot Center</Link>
          <Link className="button secondary" href="/digital-observer/dashboard">Owner dashboard</Link>
        </div>
      </div>
      <AdminDataError message={result.error ?? data.queryError} />

      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><Gauge /><strong>{launchScore}/100</strong><span>launch readiness</span></article>
        <article className="metric-card"><Wrench /><strong>{openIssues}</strong><span>open support issues</span></article>
        <article className="metric-card"><Camera /><strong>{cameraIssues}</strong><span>camera issues</span></article>
        <article className="metric-card"><Radar /><strong>{gatewayIssues}</strong><span>gateway issues</span></article>
        <article className="metric-card"><Bell /><strong>{alertIssues}</strong><span>alert issues</span></article>
        <article className="metric-card"><AlertTriangle /><strong>{data.fp.length}/{data.fn.length}</strong><span>FP / FN analyses</span></article>
        <article className="metric-card"><HelpCircle /><strong>{uxIssues}</strong><span>UX issues</span></article>
        <article className="metric-card"><ShieldCheck /><strong>{criticalGaps}</strong><span>high blockers</span></article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Launch decision</h2><p>Decision states: {DIGITAL_OBSERVER_LAUNCH_DECISION_STATES.join(" → ")}</p></div>
          {decision ? (
            <div className="risk-list">
              <div>Current decision <b><span className={pill(decision.decision_state)}>{decision.decision_state}</span></b></div>
              <div>Camera stability <b>{decision.camera_stability_score}/100</b></div>
              <div>Alert quality <b>{decision.alert_quality_score}/100</b></div>
              <div>Support load <b>{decision.support_load_score}/100</b></div>
              <div>Billing readiness <b>{decision.billing_readiness_score}/100</b></div>
              <div>Legal/capability readiness <b>{decision.legal_capability_score}/100</b></div>
            </div>
          ) : <div className="empty-state"><strong>No launch decision yet</strong><span>Run the Phase 180 migration to seed the decision register.</span></div>}
          <p>{decision?.recommended_next_step ?? "Recommended next step will appear after decision scoring."}</p>
        </article>

        <article className="card action-panel">
          <div className="section-heading"><h2>Executive summary</h2><p>Pilot result, customer feedback, readiness and biggest blockers.</p></div>
          <div className="risk-list">
            <div>Pilot sites <b>{data.pilotSites.length}</b></div>
            <div>Feedback items <b>{data.feedback.length}</b></div>
            <div>Stabilization actions <b>{data.stabilization.length}</b></div>
            <div>Standalone gaps <b>{data.gaps.length}</b></div>
            <div>Recommended state <b>{decision?.decision_state ?? "not_ready"}</b></div>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Stabilization actions</h2><p>Camera fixes, gateway fixes, playback fixes, alert improvements and UX polish.</p></div>
        <div className="setup-checklist">
          {DIGITAL_OBSERVER_STABILIZATION_AREAS.map((area) => <span key={area}>{area}</span>)}
        </div>
        <div className="procedure-list">
          {data.stabilization.map((item) => (
            <article className="card procedure-card" key={item.id}>
              <div>
                <span className={pill(item.status)}>{item.status}</span>
                <span className="pill">{item.area}</span>
                <h3>{item.title}</h3>
                <p>{item.issue_summary}</p>
                <small>{item.fix_summary ?? "Fix not recorded yet"}</small>
              </div>
              <div className="procedure-meta">
                <span>{item.owner ?? "unassigned"} · {item.severity}</span>
                <span>{item.recommended_next_step ?? "No next step"}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>False positive analysis</h2><p>By site, camera, zone, event type, lighting, angle, sensitivity, schedule and model.</p></div>
          <div className="risk-list">
            {data.fp.length === 0 ? <div>No false positive analysis yet <b>waiting</b></div> : data.fp.map((item) => (
              <div key={item.id}>{item.event_type} · {item.digital_observer_pilot_sites?.site_name ?? "pilot"} <b>{item.status}</b></div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>False negative analysis</h2><p>Missed event tracking and calibration recommendations.</p></div>
          <div className="risk-list">
            {data.fn.length === 0 ? <div>No false negative analysis yet <b>waiting</b></div> : data.fn.map((item) => (
              <div key={item.id}>{item.event_type} · {item.possible_cause ?? "cause TBD"} <b>{item.status}</b></div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Calibration fix sprint</h2><p>Human approval required. Do not auto-promote to production.</p></div>
          <div className="risk-list">
            {data.calibration.length === 0 ? <div>No calibration profiles <b>missing</b></div> : data.calibration.slice(0, 10).map((profile) => (
              <div key={profile.id}>{profile.event_type} · threshold {profile.confidence_threshold ?? "?"} <b>{profile.calibration_status}</b></div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Package feedback</h2><p>Confusion, willingness to pay, pricing objections and upgrade interest.</p></div>
          <div className="risk-list">
            {data.packageFeedback.length === 0 ? <div>No package feedback yet <b>waiting</b></div> : data.packageFeedback.map((item) => (
              <div key={item.id}>{item.package_key} · {item.willingness_to_pay ?? "WTP TBD"} <b>{item.status}</b></div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Package recommendations</h2><p>Simple package recommendation logic from pilot feedback.</p></div>
          <div className="risk-list">
            {(data.packageRules.length ? data.packageRules : DIGITAL_OBSERVER_PACKAGE_RECOMMENDATIONS).map((rule: any) => (
              <div key={rule.id ?? rule.rule}>{rule.condition_text ?? rule.rule} <b>{rule.recommended_package_name ?? rule.packageName}</b></div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Support playbooks</h2><p>Ready-to-review support scripts for repeated pilot problems.</p></div>
          <div className="risk-list">
            {(data.playbooks.length ? data.playbooks : DIGITAL_OBSERVER_SUPPORT_PLAYBOOKS).slice(0, 10).map((item: any) => (
              <div key={item.id ?? item.key}>{item.title} <b>{item.status ?? "ready"}</b></div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Digital Observer knowledge base</h2><p>Standalone support content, separate from Gan Batuach help center.</p></div>
          <div className="risk-list">
            {(data.kb.length ? data.kb : DIGITAL_OBSERVER_KNOWLEDGE_BASE_ARTICLES).map((article: any) => (
              <div key={article.id ?? article}>{article.title ?? article} <b>{article.status ?? "planned"}</b></div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Domain and product separation</h2><p>Future standalone domain readiness without breaking Gan Batuach.</p></div>
          <div className="risk-list">
            {data.domains.map((domain) => (
              <div key={domain.id}>{domain.domain_option} <b>{domain.status}</b></div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Standalone product gaps</h2><p>Camera, gateway, AI, UX, billing, legal, support, marketing, infrastructure, domain and data separation.</p></div>
        <div className="procedure-list">
          {data.gaps.map((gap) => (
            <article className="card procedure-card" key={gap.id}>
              <div>
                <span className={pill(gap.status)}>{gap.status}</span>
                <span className="pill">{gap.category}</span>
                <h3>{gap.gap_title}</h3>
                <p>{gap.gap_description}</p>
              </div>
              <div className="procedure-meta">
                <span>{gap.severity} · {gap.owner ?? "unassigned"}</span>
                <span>{gap.remediation_plan ?? "No remediation plan"}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {decision?.decision_state === "not_ready" || criticalGaps > 0 ? (
        <div className="error-banner"><AlertTriangle size={16} /> Digital Observer is not ready for standalone launch. Resolve high blockers first.</div>
      ) : (
        <div className="success-banner"><CheckCircle2 size={16} /> Digital Observer can continue according to the selected launch decision state, still separate from Gan Batuach billing and flows.</div>
      )}
    </DashboardShell>
  );
}
