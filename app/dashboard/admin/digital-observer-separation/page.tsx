import Link from "next/link";
import { AlertTriangle, Boxes, Camera, Cloud, Code2, CreditCard, Database, Gauge, GitBranch, Globe2, ShieldCheck } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  DIGITAL_OBSERVER_DATA_BOUNDARY_GROUPS,
  DIGITAL_OBSERVER_FUTURE_MONOREPO_PLAN,
  DIGITAL_OBSERVER_SEPARATION_DECISION_STATES,
  DIGITAL_OBSERVER_SEPARATION_FACTORS
} from "@/lib/domain/digital-observer-product";

function tone(status?: string | null) {
  const value = String(status ?? "");
  if (["full_separation_ready", "separate_repo_ready", "separate_supabase_ready", "separate_vercel_ready", "recommended", "ready_for_review", "ready_for_copy", "already_reusable", "mitigated", "low"].includes(value)) return "pill good";
  if (["keep_inside_gan_batuach", "monorepo_recommended", "needs_review", "needs_refactor", "future_only", "planned", "medium", "deferred", "open"].includes(value)) return "pill warn";
  if (["not_ready", "blocked", "critical", "high", "unsafe_to_move_now"].includes(value)) return "pill bad";
  return "pill";
}

function scoreTone(score: number) {
  if (score >= 80) return "pill good";
  if (score >= 55) return "pill warn";
  return "pill bad";
}

function money(value: unknown) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function countBy(items: any[], key: string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = String(item[key] ?? "unknown");
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

export default async function AdminDigitalObserverSeparationPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("digital observer separation", async () => {
    const supabase = await createClient();
    const [decisions, strategies, boundaries, core, migration, risks, costs, timeline, rollback, betaCustomers, betaSites, betaHealth, betaDecisions] = await Promise.all([
      supabase.from("digital_observer_separation_decisions" as any).select("*").order("updated_at", { ascending: false }).limit(10),
      supabase.from("digital_observer_strategy_reviews" as any).select("*").order("strategy_area").order("readiness_score", { ascending: false }).limit(100),
      supabase.from("digital_observer_data_boundary_map" as any).select("*").order("boundary_group").order("table_or_area").limit(200),
      supabase.from("digital_observer_shared_core_readiness" as any).select("*").order("package_key").limit(100),
      supabase.from("digital_observer_data_migration_readiness" as any).select("*").order("migration_area").limit(100),
      supabase.from("digital_observer_extraction_risks" as any).select("*").order("severity").order("created_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_extraction_cost_estimates" as any).select("*").order("estimated_total_monthly_cost").limit(20),
      supabase.from("digital_observer_extraction_timeline_estimates" as any).select("*").order("estimated_days", { ascending: false }).limit(30),
      supabase.from("digital_observer_rollback_plans" as any).select("*").order("rollback_key").limit(50),
      supabase.from("digital_observer_beta_customers" as any).select("id, beta_status, payment_status, package_selected").limit(500),
      supabase.from("digital_observer_beta_sites" as any).select("id, camera_count, beta_readiness, camera_health, gateway_health, observer_health").limit(500),
      supabase.from("digital_observer_customer_health_scores" as any).select("score, churn_risk_score, setup_completion_score, camera_stability_score").limit(500),
      supabase.from("digital_observer_beta_launch_decisions" as any).select("*").order("updated_at", { ascending: false }).limit(10)
    ]);
    [decisions, strategies, boundaries, core, migration, risks, costs, timeline, rollback, betaCustomers, betaSites, betaHealth, betaDecisions].forEach((query, index) => logSupabaseError("digital observer separation query " + index, query.error));
    return {
      decisions: decisions.data ?? [],
      strategies: strategies.data ?? [],
      boundaries: boundaries.data ?? [],
      core: core.data ?? [],
      migration: migration.data ?? [],
      risks: risks.data ?? [],
      costs: costs.data ?? [],
      timeline: timeline.data ?? [],
      rollback: rollback.data ?? [],
      betaCustomers: betaCustomers.data ?? [],
      betaSites: betaSites.data ?? [],
      betaHealth: betaHealth.data ?? [],
      betaDecisions: betaDecisions.data ?? [],
      queryError: decisions.error ? "לא ניתן לטעון נתוני הפרדת Digital Observer כרגע" : null
    };
  }, {
    decisions: [] as any[],
    strategies: [] as any[],
    boundaries: [] as any[],
    core: [] as any[],
    migration: [] as any[],
    risks: [] as any[],
    costs: [] as any[],
    timeline: [] as any[],
    rollback: [] as any[],
    betaCustomers: [] as any[],
    betaSites: [] as any[],
    betaHealth: [] as any[],
    betaDecisions: [] as any[],
    queryError: null as string | null
  });

  const data = result.data;
  const decision = data.decisions[0];
  const paidCustomers = data.betaCustomers.filter((customer) => ["paid_beta", "active", "completed"].includes(customer.beta_status)).length;
  const activeSites = data.betaSites.length;
  const camerasConnected = data.betaSites.reduce((sum, site) => sum + Number(site.camera_count ?? 0), 0);
  const highRisks = data.risks.filter((risk) => ["critical", "high"].includes(risk.severity) && !["mitigated", "accepted_risk"].includes(risk.status)).length;
  const readiness = Number(decision?.separation_readiness_score ?? 0);
  const strategyCounts = countBy(data.strategies, "strategy_area");
  const boundaryCounts = countBy(data.boundaries, "boundary_group");
  const coreUnsafe = data.core.filter((item) => item.unsafe_to_move_now || item.readiness_status === "unsafe_to_move_now").length;
  const totalTimelineDays = data.timeline.reduce((sum, item) => sum + Number(item.estimated_days ?? 0), 0);

  return (
    <DashboardShell role="admin" title="Digital Observer Separation">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Infrastructure extraction decision</p>
          <h1>Digital Observer separation readiness.</h1>
          <p>מסגרת החלטה להפרדת Digital Observer מ-Gan Batuach בלי ליצור repo, Supabase, Vercel או העברת נתונים בשלב הזה.</p>
        </div>
        <div className="hero-actions">
          <Link className="button primary" href="/dashboard/admin/digital-observer-paid-beta">Paid beta evidence</Link>
          <Link className="button secondary" href="/dashboard/admin/digital-observer-core">Core mapping</Link>
        </div>
      </div>
      <AdminDataError message={result.error ?? data.queryError} />

      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><Gauge /><strong>{readiness}/100</strong><span>separation readiness</span></article>
        <article className="metric-card"><CreditCard /><strong>{paidCustomers}</strong><span>paid beta customers</span></article>
        <article className="metric-card"><ShieldCheck /><strong>{activeSites}</strong><span>observer sites</span></article>
        <article className="metric-card"><Camera /><strong>{camerasConnected}</strong><span>cameras connected</span></article>
        <article className="metric-card"><Globe2 /><strong>{decision?.domain_readiness_score ?? 0}/100</strong><span>domain readiness</span></article>
        <article className="metric-card"><Cloud /><strong>{decision?.vercel_readiness_score ?? 0}/100</strong><span>Vercel readiness</span></article>
        <article className="metric-card"><Database /><strong>{decision?.supabase_readiness_score ?? 0}/100</strong><span>Supabase readiness</span></article>
        <article className="metric-card"><AlertTriangle /><strong>{highRisks}</strong><span>high blockers</span></article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Go / No-Go decision</h2><p>Decision states: {DIGITAL_OBSERVER_SEPARATION_DECISION_STATES.join(" → ")}</p></div>
          {decision ? (
            <div className="risk-list">
              <div>Current recommendation <b><span className={tone(decision.decision_state)}>{decision.decision_state}</span></b></div>
              <div>Paid beta <b>{decision.paid_beta_validation_status}</b></div>
              <div>Product readiness <b>{decision.product_readiness_score}/100</b></div>
              <div>Revenue readiness <b>{decision.revenue_readiness_score}/100</b></div>
              <div>Technical readiness <b>{decision.technical_readiness_score}/100</b></div>
              <div>Data separation <b>{decision.data_separation_readiness_score}/100</b></div>
            </div>
          ) : <div className="empty-state"><strong>No separation decision yet</strong><span>Run the Phase 182 migration to seed the decision model.</span></div>}
          <p>{decision?.final_recommendation ?? "Do not separate until paid beta evidence is available."}</p>
          <small>{decision?.next_phase_recommendation ?? "Next phase should collect real beta evidence and harden boundaries."}</small>
        </article>

        <article className="card action-panel">
          <div className="section-heading"><h2>Decision factors</h2><p>Full separation is blocked if paid beta is not validated.</p></div>
          <div className="setup-checklist">
            {DIGITAL_OBSERVER_SEPARATION_FACTORS.map((factor) => <span key={factor}>{factor}</span>)}
          </div>
        </article>
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>GitHub strategy</h2><p>Do not create a repository yet.</p></div>
          <div className="risk-list">
            {data.strategies.filter((item) => item.strategy_area === "github").map((item) => (
              <div key={item.id}>{item.option_title} <b><span className={tone(item.status)}>{item.recommendation}</span></b></div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Vercel strategy</h2><p>Route-based now, separate Vercel later.</p></div>
          <div className="risk-list">
            {data.strategies.filter((item) => item.strategy_area === "vercel").map((item) => (
              <div key={item.id}>{item.option_title} <b>{item.readiness_score}/100</b></div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Supabase strategy</h2><p>Separate project is not recommended until migration rehearsals.</p></div>
          <div className="risk-list">
            {data.strategies.filter((item) => item.strategy_area === "supabase").map((item) => (
              <div key={item.id}>{item.option_title} <b><span className={tone(item.status)}>{item.recommendation}</span></b></div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Product boundary review</h2><p>Gan Batuach and Digital Observer stay clearly separated.</p></div>
        <div className="grid cols-3 dashboard-panels">
          <article className="card action-panel">
            <h3>Gan Batuach only</h3>
            <div className="setup-checklist">{DIGITAL_OBSERVER_DATA_BOUNDARY_GROUPS.ganBatuachOnly.map((item) => <span key={item}>{item}</span>)}</div>
          </article>
          <article className="card action-panel">
            <h3>Digital Observer only</h3>
            <div className="setup-checklist">{DIGITAL_OBSERVER_DATA_BOUNDARY_GROUPS.digitalObserverOnly.map((item) => <span key={item}>{item}</span>)}</div>
          </article>
          <article className="card action-panel">
            <h3>Shared core</h3>
            <div className="setup-checklist">{DIGITAL_OBSERVER_DATA_BOUNDARY_GROUPS.sharedCore.map((item) => <span key={item}>{item}</span>)}</div>
          </article>
        </div>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Future monorepo plan</h2><p>Documented only. No file movement in this phase.</p></div>
          <div className="risk-list">
            <div>apps <b>{DIGITAL_OBSERVER_FUTURE_MONOREPO_PLAN.apps.join(" / ")}</b></div>
            <div>packages <b>{DIGITAL_OBSERVER_FUTURE_MONOREPO_PLAN.packages.length}</b></div>
            <div>estimated workstreams <b>{data.timeline.length}</b></div>
            <div>estimated days <b>{totalTimelineDays}</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Product switcher readiness</h2><p>Admin context must show which product is active before sensitive actions.</p></div>
          <div className="risk-list">
            <div>Gan Batuach context <b>kindergarten flows</b></div>
            <div>Digital Observer context <b>observer sites</b></div>
            <div>Wrong-product risk <b><span className="pill warn">needs continued UX guardrails</span></b></div>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Data boundary map</h2><p>Tables and areas classified by product ownership and future migration action.</p></div>
        <div className="setup-checklist">
          {Object.entries(boundaryCounts).map(([group, count]) => <span key={group}>{group}: {count}</span>)}
        </div>
        <div className="procedure-list">
          {data.boundaries.slice(0, 24).map((item) => (
            <article className="card procedure-card" key={item.id}>
              <div>
                <span className={tone(item.status)}>{item.status}</span>
                <span className="pill">{item.boundary_group}</span>
                <h3>{item.table_or_area}</h3>
                <p>{item.migration_notes}</p>
                <small>{item.contains_sensitive_data ? "sensitive" : "non-sensitive"} · garden_id {item.garden_id_dependency ? "yes" : "no"} · observer_site_id {item.observer_site_id_dependency ? "yes" : "no"}</small>
              </div>
              <div className="procedure-meta"><span>{item.product_owner}</span><span>{item.future_action}</span></div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Shared core mapping</h2><p>Already reusable, needs refactor, product-specific, or unsafe to move.</p></div>
          <div className="risk-list">
            {data.core.map((item) => (
              <div key={item.id}>{item.package_name} <b><span className={tone(item.readiness_status)}>{item.readiness_status}</span></b></div>
            ))}
            <div>Unsafe to move now <b>{coreUnsafe}</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Data migration readiness</h2><p>No data is moved in this phase.</p></div>
          <div className="risk-list">
            {data.migration.map((item) => (
              <div key={item.id}>{item.source_table_or_bucket} <b><span className={tone(item.status)}>{item.migration_risk}</span></b></div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Extraction risks</h2><p>Critical and high risks prevent full split.</p></div>
          <div className="risk-list">
            {data.risks.slice(0, 12).map((risk) => (
              <div key={risk.id}>{risk.risk_title} <b><span className={tone(risk.severity)}>{risk.severity}</span></b></div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Cost estimates</h2><p>Monthly estimate by separation scenario.</p></div>
          <div className="risk-list">
            {data.costs.map((cost) => (
              <div key={cost.id}>{cost.scenario_name} <b>{money(cost.estimated_total_monthly_cost)}</b></div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Timeline estimate</h2><p>Monorepo, packages, Vercel, Supabase, data migration, DNS, QA and rollback.</p></div>
          <div className="risk-list">
            {data.timeline.map((item) => (
              <div key={item.id}>{item.workstream} <b>{item.estimated_days} days</b></div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Rollback plan</h2><p>Fallback keeps Digital Observer under /digital-observer and preserves customers, billing and data.</p></div>
          <div className="risk-list">
            {data.rollback.map((item) => (
              <div key={item.id}>{item.rollback_step} <b>{item.status}</b></div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <GitBranch />
          <h2>GitHub readiness</h2>
          <p>Recommendation: single monorepo first. Do not create a separate repository yet.</p>
          <span className={scoreTone(Number(decision?.github_readiness_score ?? 0))}>{decision?.github_readiness_score ?? 0}/100</span>
        </article>
        <article className="card action-panel">
          <Code2 />
          <h2>Environment split</h2>
          <p>Future Digital Observer envs need separate Supabase, payment, invoice, messaging, camera gateway, AI and domain variables. No secrets added.</p>
        </article>
        <article className="card action-panel">
          <Boxes />
          <h2>Final recommendation</h2>
          <p>{decision?.reason ?? "Keep inside Gan Batuach until paid beta is validated."}</p>
        </article>
      </section>
    </DashboardShell>
  );
}
