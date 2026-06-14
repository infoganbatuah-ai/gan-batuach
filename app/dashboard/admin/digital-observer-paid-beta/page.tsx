import Link from "next/link";
import { AlertTriangle, Camera, CreditCard, Gauge, HeartPulse, PackageCheck, ShieldCheck, TrendingUp, Wrench } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  DIGITAL_OBSERVER_BILLING_STREAMS,
  DIGITAL_OBSERVER_PAID_BETA_DECISION_STATES,
  DIGITAL_OBSERVER_PAID_BETA_FUNNEL_STAGES,
  DIGITAL_OBSERVER_PAID_BETA_SUCCESS_CRITERIA
} from "@/lib/domain/digital-observer-product";

function pill(status?: string | null) {
  const value = String(status ?? "");
  if (["paid_beta", "active", "completed", "active_paid_beta", "paid", "validated", "met", "ready_for_standalone_launch", "paid_beta_validated"].includes(value)) return "pill good";
  if (["invited", "onboarding", "trial", "payment_pending", "in_progress", "needs_more_beta", "needs_adjustment", "sandbox"].includes(value)) return "pill warn";
  if (["cancelled", "churned", "failed", "overdue", "suspended", "not_ready", "critical", "high", "blocked"].includes(value)) return "pill bad";
  return "pill";
}

function scorePill(score: number) {
  if (score >= 80) return "pill good";
  if (score >= 55) return "pill warn";
  return "pill bad";
}

function money(value: unknown) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function avg(items: any[], key: string) {
  if (!items.length) return 0;
  return Math.round(items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0) / items.length);
}

export default async function AdminDigitalObserverPaidBetaPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("digital observer paid beta", async () => {
    const supabase = await createClient();
    const [customers, betaSites, subscriptions, invoices, value, checklist, setupCosts, support, health, churn, packageValidation, pricing, criteria, decisions] = await Promise.all([
      supabase.from("digital_observer_beta_customers" as any).select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_beta_sites" as any).select("*, digital_observer_beta_customers(customer_name, customer_type, beta_status)").order("created_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_beta_subscriptions" as any).select("*, digital_observer_beta_customers(customer_name)").order("created_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_beta_invoices" as any).select("*, digital_observer_beta_customers(customer_name)").order("created_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_beta_usage_value_tracking" as any).select("*, digital_observer_beta_customers(customer_name)").order("created_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_beta_onboarding_checklists" as any).select("*, digital_observer_beta_customers(customer_name)").order("updated_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_beta_camera_setup_costs" as any).select("*, digital_observer_beta_customers(customer_name)").order("updated_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_beta_support_load" as any).select("*, digital_observer_beta_customers(customer_name)").order("updated_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_customer_health_scores" as any).select("*, digital_observer_beta_customers(customer_name)").order("calculated_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_beta_churn_risks" as any).select("*, digital_observer_beta_customers(customer_name)").order("created_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_beta_package_validation" as any).select("*, digital_observer_beta_customers(customer_name)").order("created_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_beta_pricing_validation" as any).select("*, digital_observer_beta_customers(customer_name)").order("created_at", { ascending: false }).limit(200),
      supabase.from("digital_observer_beta_success_criteria" as any).select("*").order("created_at", { ascending: true }).limit(50),
      supabase.from("digital_observer_beta_launch_decisions" as any).select("*").order("updated_at", { ascending: false }).limit(10)
    ]);
    [customers, betaSites, subscriptions, invoices, value, checklist, setupCosts, support, health, churn, packageValidation, pricing, criteria, decisions].forEach((query, index) => logSupabaseError("digital observer paid beta query " + index, query.error));
    return {
      customers: customers.data ?? [],
      betaSites: betaSites.data ?? [],
      subscriptions: subscriptions.data ?? [],
      invoices: invoices.data ?? [],
      value: value.data ?? [],
      checklist: checklist.data ?? [],
      setupCosts: setupCosts.data ?? [],
      support: support.data ?? [],
      health: health.data ?? [],
      churn: churn.data ?? [],
      packageValidation: packageValidation.data ?? [],
      pricing: pricing.data ?? [],
      criteria: criteria.data ?? [],
      decisions: decisions.data ?? [],
      queryError: customers.error ? "לא ניתן לטעון נתוני paid beta כרגע" : null
    };
  }, {
    customers: [] as any[],
    betaSites: [] as any[],
    subscriptions: [] as any[],
    invoices: [] as any[],
    value: [] as any[],
    checklist: [] as any[],
    setupCosts: [] as any[],
    support: [] as any[],
    health: [] as any[],
    churn: [] as any[],
    packageValidation: [] as any[],
    pricing: [] as any[],
    criteria: [] as any[],
    decisions: [] as any[],
    queryError: null as string | null
  });

  const data = result.data;
  const paidCustomers = data.customers.filter((customer) => ["paid_beta", "active", "completed"].includes(customer.beta_status)).length;
  const activeTrials = data.customers.filter((customer) => customer.beta_status === "trial" || customer.trial_status === "active").length;
  const convertedTrials = data.customers.filter((customer) => ["paid_beta", "active"].includes(customer.beta_status)).length;
  const activeSubscriptions = data.subscriptions.filter((subscription) => subscription.subscription_status === "active_paid_beta").length;
  const invoiceRevenue = data.invoices.filter((invoice) => ["issued", "sent", "paid"].includes(invoice.invoice_status)).reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);
  const supportIssues = data.support.reduce((sum, item) => sum + Number(item.tickets_per_customer ?? 0), 0);
  const avgHealth = avg(data.health, "score");
  const avgSetup = avg(data.checklist, "completion_score");
  const avgReadiness = data.decisions[0]?.readiness_score ?? Math.round((avgHealth + avgSetup) / 2);
  const openChurn = data.churn.filter((risk) => ["open", "in_progress"].includes(risk.status)).length;
  const decision = data.decisions[0];

  return (
    <DashboardShell role="admin" title="Digital Observer Paid Beta">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Standalone revenue validation</p>
          <h1>Digital Observer paid beta command center.</h1>
          <p>בודק האם Digital Observer יכול לייצר הכנסות עצמאיות בלי לערבב גבייה של Gan Batuach או תשלומי הורים.</p>
        </div>
        <div className="hero-actions">
          <Link className="button primary" href="/dashboard/admin/digital-observer-beta-analytics">Beta analytics</Link>
          <Link className="button secondary" href="/digital-observer/billing">Owner billing</Link>
        </div>
      </div>
      <AdminDataError message={result.error ?? data.queryError} />

      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><HeartPulse /><strong>{paidCustomers}</strong><span>paid beta customers</span></article>
        <article className="metric-card"><ShieldCheck /><strong>{data.betaSites.length}</strong><span>paid beta sites</span></article>
        <article className="metric-card"><PackageCheck /><strong>{activeTrials}</strong><span>active trials</span></article>
        <article className="metric-card"><TrendingUp /><strong>{convertedTrials}</strong><span>converted trials</span></article>
        <article className="metric-card"><CreditCard /><strong>{activeSubscriptions}</strong><span>active subscriptions</span></article>
        <article className="metric-card"><CreditCard /><strong>{money(invoiceRevenue)}</strong><span>beta revenue</span></article>
        <article className="metric-card"><Wrench /><strong>{supportIssues}</strong><span>support tickets</span></article>
        <article className="metric-card"><Gauge /><strong>{avgReadiness}/100</strong><span>beta success score</span></article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Launch decision</h2><p>Decision states: {DIGITAL_OBSERVER_PAID_BETA_DECISION_STATES.join(" → ")}</p></div>
          {decision ? (
            <div className="risk-list">
              <div>Current state <b><span className={pill(decision.decision_state)}>{decision.decision_state}</span></b></div>
              <div>Revenue <b>{decision.revenue_score}/100</b></div>
              <div>Usage <b>{decision.usage_score}/100</b></div>
              <div>Setup success <b>{decision.setup_success_score}/100</b></div>
              <div>Alert quality <b>{decision.alert_quality_score}/100</b></div>
              <div>Legal/capability <b>{decision.legal_capability_score}/100</b></div>
            </div>
          ) : <div className="empty-state"><strong>No decision yet</strong><span>Seed decision appears after the paid beta migration runs.</span></div>}
          <p>{decision?.recommended_next_step ?? "Run controlled paid beta customers before standalone launch."}</p>
        </article>

        <article className="card action-panel">
          <div className="section-heading"><h2>Revenue separation</h2><p>No mixed invoices, no mixed revenue reporting.</p></div>
          <div className="procedure-list compact-list">
            {DIGITAL_OBSERVER_BILLING_STREAMS.map((stream) => (
              <div className="mini-row" key={stream.stream}>
                <span>{stream.stream}</span>
                <strong>{stream.payer}</strong>
                <small>{stream.destination}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Paid beta customers</h2><p>Home, business, office, warehouse, store, parking lot and custom customers only.</p></div>
        {data.customers.length === 0 ? (
          <div className="empty-state"><strong>No paid beta customers yet</strong><span>Convert Digital Observer leads into trial or paid beta customers.</span></div>
        ) : (
          <div className="procedure-list">
            {data.customers.map((customer) => (
              <article className="card procedure-card" key={customer.id}>
                <div>
                  <span className={pill(customer.beta_status)}>{customer.beta_status}</span>
                  <span className="pill">{customer.customer_type}</span>
                  <h3>{customer.customer_name}</h3>
                  <p>{customer.city ?? "city TBD"} · {customer.package_selected ?? "package TBD"} · payment {customer.payment_status}</p>
                  <small>{customer.contact_person ?? "contact TBD"} · {customer.email ?? customer.phone ?? "contact missing"}</small>
                </div>
                <div className="procedure-meta">
                  <span>trial {customer.trial_status}</span>
                  <span>onboarding {customer.onboarding_status}</span>
                  <span>feedback {customer.feedback_status}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Sites and cameras</h2><p>Camera setup, gateway health and observer readiness.</p></div>
          <div className="risk-list">
            {data.betaSites.length === 0 ? <div>No beta sites <b>waiting</b></div> : data.betaSites.map((site) => (
              <div key={site.id}>{site.site_name ?? site.digital_observer_beta_customers?.customer_name ?? "site"} · {site.camera_count} cameras <b>{site.beta_readiness}/100</b></div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Onboarding checklist</h2><p>Account, package, camera, gateway, schedule, alerts, payment and support.</p></div>
          <div className="risk-list">
            {data.checklist.length === 0 ? <div>No checklists <b>waiting</b></div> : data.checklist.map((item) => (
              <div key={item.id}>{item.digital_observer_beta_customers?.customer_name ?? "customer"} <b>{item.completion_score}/100</b></div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Health and churn</h2><p>Setup, stability, alert value, support, payment, satisfaction and churn.</p></div>
          <div className="risk-list">
            <div>Average customer health <b><span className={scorePill(avgHealth)}>{avgHealth}/100</span></b></div>
            <div>Open churn risks <b>{openChurn}</b></div>
            <div>Camera setup score <b>{avgSetup}/100</b></div>
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Trial to paid funnel</h2><p>Lead → demo → trial → camera setup → first alerts → feedback → package → payment → paid beta.</p></div>
          <div className="setup-checklist">
            {DIGITAL_OBSERVER_PAID_BETA_FUNNEL_STAGES.map((stage) => <span key={stage.key}>{stage.label}</span>)}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Success criteria</h2><p>Admin-configurable thresholds for paid beta validation.</p></div>
          <div className="risk-list">
            {(data.criteria.length ? data.criteria : DIGITAL_OBSERVER_PAID_BETA_SUCCESS_CRITERIA).map((item: any) => (
              <div key={item.id ?? item.metric ?? item.metric_key}>{item.label} <b>{item.current_value ?? 0}/{item.target_value ?? item.defaultTarget}</b></div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Package validation</h2><p>Selected packages, rejected packages, limit issues and upgrade interest.</p></div>
          <div className="risk-list">
            {data.packageValidation.length === 0 ? <div>No package feedback <b>waiting</b></div> : data.packageValidation.map((item) => (
              <div key={item.id}>{item.selected_package ?? "package TBD"} · upgrade {item.upgrade_interest ? "yes" : "no"} <b>{item.validation_status}</b></div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Pricing validation</h2><p>Willingness to pay, discounts, support cost and recommended pricing.</p></div>
          <div className="risk-list">
            {data.pricing.length === 0 ? <div>No pricing evidence <b>waiting</b></div> : data.pricing.map((item) => (
              <div key={item.id}>{money(item.proposed_monthly_price)} proposed · accepted {money(item.accepted_price)} <b>{item.status}</b></div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Invoices and subscriptions</h2><p>Digital Observer invoice wording only. Live charging requires explicit provider mode.</p></div>
        <div className="procedure-list">
          {data.subscriptions.map((subscription) => (
            <article className="card procedure-card" key={subscription.id}>
              <div>
                <span className={pill(subscription.subscription_status)}>{subscription.subscription_status}</span>
                <span className="pill">{subscription.payment_mode}</span>
                <h3>{subscription.digital_observer_beta_customers?.customer_name ?? subscription.package_key ?? "Subscription"}</h3>
                <p>{subscription.package_key ?? "package TBD"} · live charge {subscription.live_charge_allowed ? "allowed by config" : "blocked"}</p>
                <small>raw cards {subscription.raw_card_storage_allowed ? "blocked gap" : "not stored"} · audit {subscription.audit_required ? "required" : "missing"}</small>
              </div>
              <div className="procedure-meta"><span>{money(subscription.monthly_price)} monthly</span><span>{money(subscription.annual_price)} annual</span></div>
            </article>
          ))}
          {data.invoices.map((invoice) => (
            <article className="card procedure-card" key={invoice.id}>
              <div>
                <span className={pill(invoice.invoice_status)}>{invoice.invoice_status}</span>
                <h3>{invoice.invoice_number}</h3>
                <p>{invoice.digital_observer_beta_customers?.customer_name ?? "customer"} · {invoice.package_key ?? "package TBD"}</p>
                <small>PDF {invoice.pdf_ready ? "ready" : "not ready"} · email {invoice.email_delivery_readiness}</small>
              </div>
              <div className="procedure-meta"><strong>{money(invoice.amount)}</strong><span>{invoice.billing_cycle}</span></div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <AlertTriangle />
          <h2>Capability safety review</h2>
          <p>Sensitive capabilities such as face recognition, audio analytics, gait analytics and person identity matching remain disabled or legal-review-required unless explicitly approved by the capability matrix.</p>
        </article>
        <article className="card action-panel">
          <Camera />
          <h2>Camera setup cost</h2>
          <div className="risk-list">
            {data.setupCosts.length === 0 ? <div>No setup cost evidence <b>waiting</b></div> : data.setupCosts.map((cost) => (
              <div key={cost.id}>{cost.camera_type ?? "camera"} · {cost.setup_time_minutes} min · {cost.support_calls} calls <b>{cost.final_result}</b></div>
            ))}
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}
