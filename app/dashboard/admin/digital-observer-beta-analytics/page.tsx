import Link from "next/link";
import { BarChart3, Bell, Camera, CreditCard, Gauge, HeartPulse, PackageCheck, TrendingUp, Wrench } from "lucide-react";
import { AdminDataError } from "@/components/admin-data-state";
import { DashboardShell } from "@/components/dashboard-shell";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function countBy(items: any[], key: string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = String(item[key] ?? "unknown");
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function avg(items: any[], key: string) {
  if (!items.length) return 0;
  return Math.round(items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0) / items.length);
}

function money(value: unknown) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function pill(score: number) {
  if (score >= 80) return "pill good";
  if (score >= 55) return "pill warn";
  return "pill bad";
}

export default async function AdminDigitalObserverBetaAnalyticsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("digital observer beta analytics", async () => {
    const supabase = await createClient();
    const [customers, funnel, pricing, packageValidation, usage, alertFeedback, setupCosts, support, health, pmf, churn, decisions] = await Promise.all([
      supabase.from("digital_observer_beta_customers" as any).select("customer_type, site_type, package_selected, beta_status, trial_status, payment_status, city").limit(500),
      supabase.from("digital_observer_beta_funnel_stages" as any).select("stage, status, occurred_at").limit(1000),
      supabase.from("digital_observer_beta_pricing_validation" as any).select("proposed_monthly_price, accepted_price, rejected_price, discount_offered, status, recommended_discount_policy").limit(500),
      supabase.from("digital_observer_beta_package_validation" as any).select("selected_package, rejected_package, camera_limit_issue, monitoring_hours_issue, alert_channel_issue, retention_issue, upgrade_interest, validation_status").limit(500),
      supabase.from("digital_observer_beta_usage_value_tracking" as any).select("cameras_connected, alerts_generated, alerts_reviewed, alerts_confirmed_useful, camera_offline_alerts, monitoring_hours, playback_sessions, support_interactions, days_active").limit(500),
      supabase.from("digital_observer_beta_alert_value_feedback" as any).select("feedback, sensitivity_recommendation").limit(500),
      supabase.from("digital_observer_beta_camera_setup_costs" as any).select("setup_time_minutes, support_calls, camera_type, failed_attempts, final_success, final_result").limit(500),
      supabase.from("digital_observer_beta_support_load" as any).select("tickets_per_customer, tickets_per_camera, average_resolution_hours, onboarding_friction, camera_setup_friction, billing_friction, alert_friction, support_cost_per_customer, status").limit(500),
      supabase.from("digital_observer_customer_health_scores" as any).select("score, setup_completion_score, camera_stability_score, alert_value_score, usage_frequency_score, support_load_score, payment_status_score, satisfaction_score, churn_risk_score").limit(500),
      supabase.from("digital_observer_product_market_fit_signals" as any).select("willingness_to_pay_score, repeated_usage_score, strong_use_case_score, low_support_burden_score, referral_interest_score, upgrade_interest_score, more_cameras_interest_score, product_market_fit_readiness_score").limit(500),
      supabase.from("digital_observer_beta_churn_risks" as any).select("risk_type, risk_level, status").limit(500),
      supabase.from("digital_observer_beta_launch_decisions" as any).select("*").order("updated_at", { ascending: false }).limit(10)
    ]);
    [customers, funnel, pricing, packageValidation, usage, alertFeedback, setupCosts, support, health, pmf, churn, decisions].forEach((query, index) => logSupabaseError("digital observer beta analytics query " + index, query.error));
    return {
      customers: customers.data ?? [],
      funnel: funnel.data ?? [],
      pricing: pricing.data ?? [],
      packageValidation: packageValidation.data ?? [],
      usage: usage.data ?? [],
      alertFeedback: alertFeedback.data ?? [],
      setupCosts: setupCosts.data ?? [],
      support: support.data ?? [],
      health: health.data ?? [],
      pmf: pmf.data ?? [],
      churn: churn.data ?? [],
      decisions: decisions.data ?? [],
      queryError: customers.error ? "לא ניתן לטעון אנליטיקת paid beta כרגע" : null
    };
  }, {
    customers: [] as any[],
    funnel: [] as any[],
    pricing: [] as any[],
    packageValidation: [] as any[],
    usage: [] as any[],
    alertFeedback: [] as any[],
    setupCosts: [] as any[],
    support: [] as any[],
    health: [] as any[],
    pmf: [] as any[],
    churn: [] as any[],
    decisions: [] as any[],
    queryError: null as string | null
  });

  const data = result.data;
  const activeCustomers = data.customers.filter((customer) => ["paid_beta", "active", "completed"].includes(customer.beta_status)).length;
  const trialCustomers = data.customers.filter((customer) => customer.beta_status === "trial" || customer.trial_status === "active").length;
  const conversionRate = data.customers.length ? Math.round((activeCustomers / data.customers.length) * 100) : 0;
  const acceptedPricing = data.pricing.filter((item) => item.status === "accepted" || Number(item.accepted_price ?? 0) > 0).length;
  const pricingAcceptance = data.pricing.length ? Math.round((acceptedPricing / data.pricing.length) * 100) : 0;
  const cameraSuccess = data.setupCosts.length ? Math.round((data.setupCosts.filter((item) => item.final_success || item.final_result === "success").length / data.setupCosts.length) * 100) : 0;
  const usefulAlerts = data.alertFeedback.filter((item) => item.feedback === "useful").length + data.usage.reduce((sum, item) => sum + Number(item.alerts_confirmed_useful ?? 0), 0);
  const alertTotal = data.alertFeedback.length + data.usage.reduce((sum, item) => sum + Number(item.alerts_reviewed ?? 0), 0);
  const alertUsefulness = alertTotal ? Math.round((usefulAlerts / alertTotal) * 100) : 0;
  const supportCost = data.support.reduce((sum, item) => sum + Number(item.support_cost_per_customer ?? 0), 0);
  const revenueAccepted = data.pricing.reduce((sum, item) => sum + Number(item.accepted_price ?? 0), 0);
  const pmfScore = avg(data.pmf, "product_market_fit_readiness_score");
  const launchScore = Number(data.decisions[0]?.readiness_score ?? Math.round((conversionRate + pricingAcceptance + cameraSuccess + alertUsefulness + pmfScore) / 5));
  const funnelCounts = countBy(data.funnel, "stage");
  const packageCounts = countBy(data.customers, "package_selected");
  const packageValidationCounts = countBy(data.packageValidation, "validation_status");
  const churnCounts = countBy(data.churn, "risk_level");

  return (
    <DashboardShell role="admin" title="Digital Observer Beta Analytics">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Paid beta analytics</p>
          <h1>Revenue, setup, alert value and product-market fit.</h1>
          <p>אנליטיקה ל-paid beta בלבד: conversion, package acceptance, camera setup, support load ו-launch readiness.</p>
        </div>
        <Link className="button primary" href="/dashboard/admin/digital-observer-paid-beta">Paid beta center</Link>
      </div>
      <AdminDataError message={result.error ?? data.queryError} />

      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><HeartPulse /><strong>{activeCustomers}</strong><span>paid beta customers</span></article>
        <article className="metric-card"><TrendingUp /><strong>{conversionRate}%</strong><span>trial/customer conversion</span></article>
        <article className="metric-card"><PackageCheck /><strong>{pricingAcceptance}%</strong><span>pricing acceptance</span></article>
        <article className="metric-card"><Camera /><strong>{cameraSuccess}%</strong><span>camera setup success</span></article>
        <article className="metric-card"><Bell /><strong>{alertUsefulness}%</strong><span>alert usefulness</span></article>
        <article className="metric-card"><Wrench /><strong>{money(supportCost)}</strong><span>support cost estimate</span></article>
        <article className="metric-card"><CreditCard /><strong>{money(revenueAccepted)}</strong><span>accepted monthly revenue</span></article>
        <article className="metric-card"><Gauge /><strong>{launchScore}/100</strong><span>launch readiness</span></article>
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Funnel metrics</h2><p>Lead through paid beta.</p></div>
          <div className="risk-list">
            {Object.entries(funnelCounts).length === 0 ? <div>No funnel data <b>waiting</b></div> : Object.entries(funnelCounts).map(([stage, count]) => <div key={stage}>{stage} <b>{count}</b></div>)}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Package conversion</h2><p>Selected packages and validation status.</p></div>
          <div className="risk-list">
            {Object.entries(packageCounts).length === 0 ? <div>No package data <b>waiting</b></div> : Object.entries(packageCounts).map(([pkg, count]) => <div key={pkg}>{pkg} <b>{count}</b></div>)}
            {Object.entries(packageValidationCounts).map(([status, count]) => <div key={status}>{status} validations <b>{count}</b></div>)}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Churn risk</h2><p>No camera, no alerts reviewed, false alerts, failed payment and support gaps.</p></div>
          <div className="risk-list">
            {Object.entries(churnCounts).length === 0 ? <div>No churn risks <b>good</b></div> : Object.entries(churnCounts).map(([risk, count]) => <div key={risk}>{risk} <b>{count}</b></div>)}
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Pricing evidence</h2><p>Willingness to pay, rejected prices, discounts and recommended policy.</p></div>
          <div className="procedure-list compact-list">
            {data.pricing.length === 0 ? <div className="mini-row"><span>No pricing interviews</span><strong>waiting</strong><small>Collect proposed and accepted price per beta customer.</small></div> : data.pricing.map((item, index) => (
              <div className="mini-row" key={`${item.status}-${index}`}>
                <span>{money(item.proposed_monthly_price)} proposed</span>
                <strong>{money(item.accepted_price)}</strong>
                <small>{item.status} · discount {money(item.discount_offered)}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Support load</h2><p>Tickets, resolution time, friction and support cost per customer.</p></div>
          <div className="procedure-list compact-list">
            {data.support.length === 0 ? <div className="mini-row"><span>No support cost data</span><strong>waiting</strong><small>Track support per customer and per camera.</small></div> : data.support.map((item, index) => (
              <div className="mini-row" key={`${item.status}-${index}`}>
                <span>{item.tickets_per_customer} tickets</span>
                <strong>{money(item.support_cost_per_customer)}</strong>
                <small>{item.average_resolution_hours}h resolution · camera friction {item.camera_setup_friction}/100</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Customer health</h2><p>Setup, cameras, value, usage, support, payment, satisfaction and churn.</p></div>
          <div className="risk-list">
            <div>Average score <b><span className={pill(avg(data.health, "score"))}>{avg(data.health, "score")}/100</span></b></div>
            <div>Setup completion <b>{avg(data.health, "setup_completion_score")}/100</b></div>
            <div>Camera stability <b>{avg(data.health, "camera_stability_score")}/100</b></div>
            <div>Alert value <b>{avg(data.health, "alert_value_score")}/100</b></div>
            <div>Payment status <b>{avg(data.health, "payment_status_score")}/100</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Product-market fit</h2><p>Willingness to pay, repeated use, strong use case, referral and upgrade interest.</p></div>
          <div className="risk-list">
            <div>PMF readiness <b><span className={pill(pmfScore)}>{pmfScore}/100</span></b></div>
            <div>Willingness to pay <b>{avg(data.pmf, "willingness_to_pay_score")}/100</b></div>
            <div>Repeated usage <b>{avg(data.pmf, "repeated_usage_score")}/100</b></div>
            <div>Referral interest <b>{avg(data.pmf, "referral_interest_score")}/100</b></div>
            <div>More cameras interest <b>{avg(data.pmf, "more_cameras_interest_score")}/100</b></div>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Launch readiness</h2><p>Standalone launch remains blocked until revenue, setup success, support load, alert quality, pricing and capability safety are proven.</p></div>
        <div className="procedure-list">
          {data.decisions.length === 0 ? (
            <article className="card procedure-card"><div><span className="pill warn">needs_more_beta</span><h3>No launch decision yet</h3><p>Run the paid beta decision process after collecting real customer evidence.</p></div></article>
          ) : data.decisions.map((decision) => (
            <article className="card procedure-card" key={decision.id}>
              <div>
                <span className={pill(Number(decision.readiness_score ?? 0))}>{decision.readiness_score}/100</span>
                <h3>{decision.decision_state}</h3>
                <p>{decision.recommended_next_step ?? "No next step recorded"}</p>
                <small>{decision.blocker_summary ?? "No blocker summary"}</small>
              </div>
              <div className="procedure-meta">
                <span>revenue {decision.revenue_score}/100 · usage {decision.usage_score}/100</span>
                <span>alert {decision.alert_quality_score}/100 · legal {decision.legal_capability_score}/100</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
