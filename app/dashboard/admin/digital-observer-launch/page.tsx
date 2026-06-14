import Link from "next/link";
import { AlertTriangle, Bell, Camera, CreditCard, Gauge, HeartPulse, PackageCheck, ShieldCheck, TrendingUp, Wrench } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  DIGITAL_OBSERVER_COMMERCIAL_LAUNCH_DECISIONS,
  DIGITAL_OBSERVER_LAUNCH_JOURNEY,
  DIGITAL_OBSERVER_LAUNCH_KNOWLEDGE_BASE,
  DIGITAL_OBSERVER_LAUNCH_SUPPORT_WORKFLOWS
} from "@/lib/domain/digital-observer-product";

function pill(status?: string | null) {
  const value = String(status ?? "");
  if (["launch_ready", "commercially_live", "soft_launch_ready", "commercial_launch_ready", "active", "paid_beta", "passed", "mitigated", "closed"].includes(value)) return "pill good";
  if (["internal_ready", "beta_ready", "paid_beta_ready", "needs_more_beta", "not_tested", "open", "in_progress", "medium", "low"].includes(value)) return "pill warn";
  if (["not_ready", "paused", "pause_launch", "critical", "high", "blocked", "failed"].includes(value)) return "pill bad";
  return "pill";
}

function money(value: unknown) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

export default async function AdminDigitalObserverLaunchPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("digital observer launch", async () => {
    const supabase = await createClient();
    const [status, leads, trials, customers, subscriptions, invoices, betaSites, qa, risks, blockers, analytics, health, decisions, support] = await Promise.all([
      supabase.from("digital_observer_launch_status" as any).select("*").order("updated_at", { ascending: false }).limit(1),
      supabase.from("digital_observer_leads" as any).select("id, lead_status, source, site_type, package_interest, interest_score, created_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("digital_observer_launch_trials" as any).select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_beta_customers" as any).select("id, beta_status, payment_status, package_selected").limit(500),
      supabase.from("digital_observer_beta_subscriptions" as any).select("id, subscription_status, monthly_price, annual_price, payment_mode, package_key").limit(500),
      supabase.from("digital_observer_beta_invoices" as any).select("id, invoice_status, amount, package_key").limit(500),
      supabase.from("digital_observer_beta_sites" as any).select("id, camera_count, camera_health, gateway_health, observer_health, beta_readiness").limit(500),
      supabase.from("digital_observer_launch_qa_checks" as any).select("*").order("check_area").limit(200),
      supabase.from("digital_observer_launch_risks" as any).select("*").order("severity").limit(200),
      supabase.from("digital_observer_launch_blockers" as any).select("*").order("severity").limit(200),
      supabase.from("digital_observer_launch_analytics" as any).select("*").order("metric_key").limit(100),
      supabase.from("digital_observer_customer_health_scores" as any).select("score, churn_risk_score, setup_completion_score, camera_stability_score, alert_value_score").limit(500),
      supabase.from("digital_observer_launch_decisions" as any).select("*").order("updated_at", { ascending: false }).limit(5),
      supabase.from("digital_observer_beta_support_load" as any).select("tickets_per_customer, support_cost_per_customer, status").limit(500)
    ]);
    [status, leads, trials, customers, subscriptions, invoices, betaSites, qa, risks, blockers, analytics, health, decisions, support].forEach((query, index) => logSupabaseError("digital observer launch query " + index, query.error));
    return {
      status: status.data?.[0] ?? null,
      leads: leads.data ?? [],
      trials: trials.data ?? [],
      customers: customers.data ?? [],
      subscriptions: subscriptions.data ?? [],
      invoices: invoices.data ?? [],
      betaSites: betaSites.data ?? [],
      qa: qa.data ?? [],
      risks: risks.data ?? [],
      blockers: blockers.data ?? [],
      analytics: analytics.data ?? [],
      health: health.data ?? [],
      decisions: decisions.data ?? [],
      support: support.data ?? [],
      queryError: status.error ? "לא ניתן לטעון נתוני Launch כרגע" : null
    };
  }, {
    status: null as any,
    leads: [] as any[],
    trials: [] as any[],
    customers: [] as any[],
    subscriptions: [] as any[],
    invoices: [] as any[],
    betaSites: [] as any[],
    qa: [] as any[],
    risks: [] as any[],
    blockers: [] as any[],
    analytics: [] as any[],
    health: [] as any[],
    decisions: [] as any[],
    support: [] as any[],
    queryError: null as string | null
  });

  const data = result.data;
  const launch = data.status;
  const decision = data.decisions[0];
  const activeLeads = data.leads.filter((lead) => !["lost", "rejected", "converted"].includes(String(lead.lead_status))).length;
  const demoRequests = data.leads.filter((lead) => String(lead.source).includes("demo")).length;
  const activeTrials = data.trials.filter((trial) => ["started", "active", "ending_soon"].includes(trial.trial_status)).length;
  const paidBeta = data.customers.filter((customer) => ["paid_beta", "active", "completed"].includes(customer.beta_status)).length;
  const activeSubscriptions = data.subscriptions.filter((subscription) => ["active", "active_paid_beta"].includes(subscription.subscription_status)).length;
  const connectedCameras = data.betaSites.reduce((sum, site) => sum + Number(site.camera_count ?? 0), 0);
  const revenue = data.invoices.filter((invoice) => ["issued", "sent", "paid"].includes(invoice.invoice_status)).reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);
  const openBlockers = data.blockers.filter((blocker) => ["open", "in_progress"].includes(blocker.status)).length + data.risks.filter((risk) => ["critical", "high"].includes(risk.severity) && ["open", "in_progress"].includes(risk.status)).length;
  const qaPassed = data.qa.filter((item) => item.status === "passed").length;

  return (
    <DashboardShell role="admin" title="Digital Observer Launch">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Standalone commercial launch</p>
          <h1>Digital Observer launch command center.</h1>
          <p>השקה מסחרית מבוקרת ל-Digital Observer כמוצר עצמאי, עדיין בתוך התשתית הקיימת וללא ערבוב billing או יכולות מוגבלות.</p>
        </div>
        <div className="hero-actions">
          <Link className="button primary" href="/digital-observer">Public website</Link>
          <Link className="button secondary" href="/dashboard/admin/digital-observer-production-setup">Production setup</Link>
        </div>
      </div>
      <AdminDataError message={result.error ?? data.queryError} />

      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><Gauge /><strong>{launch?.readiness_score ?? decision?.readiness_score ?? 0}/100</strong><span>launch readiness</span></article>
        <article className="metric-card"><TrendingUp /><strong>{activeLeads}</strong><span>active leads</span></article>
        <article className="metric-card"><HeartPulse /><strong>{demoRequests}</strong><span>demo requests</span></article>
        <article className="metric-card"><PackageCheck /><strong>{activeTrials}</strong><span>active trials</span></article>
        <article className="metric-card"><CreditCard /><strong>{paidBeta}</strong><span>paid beta customers</span></article>
        <article className="metric-card"><CreditCard /><strong>{activeSubscriptions}</strong><span>active subscriptions</span></article>
        <article className="metric-card"><Camera /><strong>{connectedCameras}</strong><span>cameras connected</span></article>
        <article className="metric-card"><AlertTriangle /><strong>{openBlockers}</strong><span>launch blockers</span></article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Standalone launch status</h2><p>Soft/commercial launch flags are not enabled automatically.</p></div>
          <div className="risk-list">
            <div>Status <b><span className={pill(launch?.status)}>{launch?.status ?? "not_ready"}</span></b></div>
            <div>Soft launch flag <b>{launch?.soft_launch_enabled ? "enabled" : "disabled"}</b></div>
            <div>Commercial launch flag <b>{launch?.commercial_launch_enabled ? "enabled" : "disabled"}</b></div>
            <div>Owner <b>{launch?.launch_owner ?? "unassigned"}</b></div>
          </div>
          <p>{launch?.notes ?? "Controlled launch readiness only."}</p>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Go / No-Go decision</h2><p>Decision states: {DIGITAL_OBSERVER_COMMERCIAL_LAUNCH_DECISIONS.join(" → ")}</p></div>
          <div className="risk-list">
            <div>Decision <b><span className={pill(decision?.decision_state)}>{decision?.decision_state ?? "not_ready"}</span></b></div>
            <div>Package readiness <b>{decision?.package_readiness_score ?? 0}/100</b></div>
            <div>Billing readiness <b>{decision?.billing_readiness_score ?? 0}/100</b></div>
            <div>Camera setup <b>{decision?.camera_setup_score ?? 0}/100</b></div>
            <div>Legal/capability <b>{decision?.legal_capability_score ?? 0}/100</b></div>
          </div>
          <p>{decision?.recommendation ?? "Not ready for commercial launch until blockers are cleared."}</p>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Launch customer journey</h2><p>Visitor to active customer, without creating Gan Batuach records.</p></div>
        <div className="setup-checklist">{DIGITAL_OBSERVER_LAUNCH_JOURNEY.map((step) => <span key={step}>{step}</span>)}</div>
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <Camera />
          <h2>Camera and gateway readiness</h2>
          <div className="risk-list">
            <div>Camera setup status <b>{data.betaSites.filter((site) => ["healthy", "online", "ready"].includes(site.camera_health)).length}/{data.betaSites.length}</b></div>
            <div>Gateway readiness <b>{data.betaSites.filter((site) => ["healthy", "ready"].includes(site.gateway_health)).length}/{data.betaSites.length}</b></div>
            <div>No RTSP exposure <b>required</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <Bell />
          <h2>Alert readiness</h2>
          <p>In-app, email, SMS, WhatsApp and push remain provider-gated. No mass alert sending unless provider mode is enabled.</p>
          <div className="setup-checklist"><span>recipients</span><span>severity</span><span>schedule</span><span>preferences</span><span>escalation readiness</span></div>
        </article>
        <article className="card action-panel">
          <Wrench />
          <h2>Support readiness</h2>
          <div className="setup-checklist">{DIGITAL_OBSERVER_LAUNCH_SUPPORT_WORKFLOWS.map((item) => <span key={item}>{item}</span>)}</div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <CreditCard />
          <h2>Revenue dashboard</h2>
          <div className="risk-list">
            <div>Digital Observer revenue <b>{money(revenue)}</b></div>
            <div>Active subscriptions <b>{activeSubscriptions}</b></div>
            <div>Trials <b>{activeTrials}</b></div>
            <div>Separate from Gan Batuach <b>required</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <ShieldCheck />
          <h2>Security and privacy review</h2>
          <div className="risk-list">
            <div>No credentials exposed <b>required</b></div>
            <div>No RTSP exposed <b>required</b></div>
            <div>Capability matrix enforced <b>required</b></div>
            <div>Restricted capabilities <b>not automatic</b></div>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Launch QA</h2><p>Website, demo, start monitoring, lead creation, site, camera, package, billing, alerts, dashboard, support and admin view.</p></div>
        <div className="setup-checklist"><span>QA passed: {qaPassed}/{data.qa.length}</span></div>
        <div className="procedure-list">
          {data.qa.map((item) => (
            <article className="card procedure-card" key={item.id}>
              <div>
                <span className={pill(item.status)}>{item.status}</span>
                <span className="pill">{item.check_area}</span>
                <h3>{item.route_or_flow}</h3>
                <p>{item.expected_result}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Launch risks</h2><p>Critical/high risks block commercial launch.</p></div>
          <div className="risk-list">
            {data.risks.map((risk) => <div key={risk.id}>{risk.title} <b><span className={pill(risk.severity)}>{risk.severity}</span></b></div>)}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Knowledge base</h2><p>Launch content readiness for support and self-service.</p></div>
          <div className="setup-checklist">{DIGITAL_OBSERVER_LAUNCH_KNOWLEDGE_BASE.map((item) => <span key={item}>{item}</span>)}</div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Launch analytics</h2><p>Visits, demos, starts, leads, trials, cameras, alerts, conversions and cancellations.</p></div>
        <div className="grid cols-4 dashboard-panels">
          {data.analytics.map((metric) => (
            <article className="metric-card" key={metric.id}><TrendingUp /><strong>{metric.metric_value}</strong><span>{metric.metric_label}</span></article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
