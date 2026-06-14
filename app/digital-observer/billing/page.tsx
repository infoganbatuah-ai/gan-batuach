import Link from "next/link";
import { AlertTriangle, CreditCard, FileText, PackageCheck, RefreshCcw, ShieldCheck, TrendingUp } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { requireUser } from "@/lib/auth";
import { logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { DIGITAL_OBSERVER_BILLING_STREAMS, DIGITAL_OBSERVER_NAVIGATION, DIGITAL_OBSERVER_PACKAGES, DIGITAL_OBSERVER_PAYMENT_PROVIDERS } from "@/lib/domain/digital-observer-product";

type Row = Record<string, any>;

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

function money(value: unknown) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function statusClass(status?: string | null) {
  if (["active", "paid", "ready", "healthy"].includes(String(status))) return "pill good";
  if (["trial", "pending_payment", "ready_for_review", "sandbox_ready", "draft"].includes(String(status))) return "pill warn";
  return "pill";
}

function dateText(value?: string | null) {
  if (!value) return "not set";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export default async function DigitalObserverBillingPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();
  const profileEmail = (profile as any).email ?? (profile as any).contact_email ?? null;
  const [ownedSites, memberships, packageRows] = await Promise.all([
    safeQuery<Row>("observer owned billing sites", () => supabase.from("observer_sites" as any).select("id, name, site_type, active, monitoring_enabled, owner_profile_id").eq("owner_profile_id", profile.id).neq("site_type", "kindergarten").limit(50)),
    safeQuery<Row>("observer billing memberships", () => supabase.from("observer_site_memberships" as any).select("observer_site_id, member_role, observer_sites(id, name, site_type, active, monitoring_enabled)").eq("profile_id", profile.id).eq("active", true).in("member_role", ["owner", "admin", "billing"]).limit(50)),
    safeQuery<Row>("observer billing packages", () => supabase.from("observer_monitoring_packages" as any).select("id, name, package_key, package_type, camera_limit, monitoring_mode, event_retention_days, recording_retention_days, live_view_enabled, alert_channels, multi_user_access, advanced_analytics, human_review_required, monthly_price, annual_price, active, sort_order").eq("active", true).order("sort_order").limit(30))
  ]);
  const memberSites = memberships.map((membership) => membership.observer_sites).filter(Boolean);
  const siteMap = new Map<string, Row>();
  [...ownedSites, ...memberSites].forEach((site) => {
    if (site?.id && site.site_type !== "kindergarten") siteMap.set(site.id, site);
  });
  const sites = Array.from(siteMap.values());
  const siteIds = sites.map((site) => site.id).filter(Boolean);

  const [subscriptions, usage, invoices, changes, providers] = siteIds.length
    ? await Promise.all([
        safeQuery<Row>("observer billing subscriptions", () => supabase.from("observer_site_subscriptions" as any).select("id, observer_site_id, package_id, status, subscription_status, trial_start, trial_end, renewal_date, billing_cycle, monthly_price, annual_price, suspended_at, cancelled_at, cancellation_reason, grace_period_ends_at, pending_package_id, pending_change_effective_at").in("observer_site_id", siteIds).limit(80)),
        safeQuery<Row>("observer billing usage tracking", () => supabase.from("observer_usage_tracking" as any).select("id, observer_site_id, package_id, active_cameras, ai_events_count, storage_used_mb, monitoring_hours_used, alerts_sent, playback_sessions, users_invited, failed_camera_checks, package_limit_status, period_start, period_end").in("observer_site_id", siteIds).order("period_start", { ascending: false }).limit(80)),
        safeQuery<Row>("observer invoices", () => supabase.from("observer_invoices" as any).select("id, invoice_number, observer_site_id, package_id, amount, currency, billing_cycle, status, pdf_ready, issued_at, due_at, paid_at").in("observer_site_id", siteIds).order("created_at", { ascending: false }).limit(80)),
        safeQuery<Row>("observer subscription changes", () => supabase.from("observer_subscription_change_requests" as any).select("id, observer_site_id, current_package_id, requested_package_id, change_type, status, prorated_billing_ready, effective_at, reason").in("observer_site_id", siteIds).order("created_at", { ascending: false }).limit(80)),
        safeQuery<Row>("observer payment provider readiness", () => supabase.from("observer_payment_provider_readiness" as any).select("provider_key, provider_name, status, mode, raw_card_storage_allowed, supported_flows, missing_configuration").order("provider_name").limit(20))
      ])
    : [[], [], [], [], await safeQuery<Row>("observer payment provider readiness", () => supabase.from("observer_payment_provider_readiness" as any).select("provider_key, provider_name, status, mode, raw_card_storage_allowed, supported_flows, missing_configuration").order("provider_name").limit(20))];

  const betaCustomers = profileEmail
    ? await safeQuery<Row>("digital observer beta customer billing", () => supabase.from("digital_observer_beta_customers" as any).select("id, customer_name, customer_type, site_type, package_selected, trial_status, payment_status, beta_status, onboarding_status, feedback_status, email").eq("email", profileEmail).limit(10))
    : [];
  const betaCustomerIds = betaCustomers.map((customer) => customer.id).filter(Boolean);
  const betaSitesByCustomer = betaCustomerIds.length
    ? await safeQuery<Row>("digital observer beta sites by customer", () => supabase.from("digital_observer_beta_sites" as any).select("id, observer_site_id, customer_id, site_name, site_type, camera_count, package_key, camera_health, gateway_health, observer_health, support_status, beta_readiness, payment_mode").in("customer_id", betaCustomerIds).limit(20))
    : [];
  const betaSitesByObserverSite = siteIds.length
    ? await safeQuery<Row>("digital observer beta sites by observer site", () => supabase.from("digital_observer_beta_sites" as any).select("id, observer_site_id, customer_id, site_name, site_type, camera_count, package_key, camera_health, gateway_health, observer_health, support_status, beta_readiness, payment_mode").in("observer_site_id", siteIds).limit(20))
    : [];
  const betaSiteMap = new Map<string, Row>();
  [...betaSitesByCustomer, ...betaSitesByObserverSite].forEach((site) => {
    if (site?.id) betaSiteMap.set(site.id, site);
  });
  const betaSites = Array.from(betaSiteMap.values());
  const betaSiteIds = betaSites.map((site) => site.id).filter(Boolean);
  const betaFilterParts = [
    betaSiteIds.length ? `beta_site_id.in.(${betaSiteIds.join(",")})` : null,
    betaCustomerIds.length ? `customer_id.in.(${betaCustomerIds.join(",")})` : null
  ].filter(Boolean);
  const betaFilter = betaFilterParts.join(",");
  const [betaSubscriptions, betaInvoices, betaHealth] = betaSiteIds.length || betaCustomerIds.length
    ? await Promise.all([
        safeQuery<Row>("digital observer beta subscriptions billing", () => supabase.from("digital_observer_beta_subscriptions" as any).select("id, customer_id, beta_site_id, subscription_status, payment_mode, provider, package_key, trial_start, trial_end, next_charge_at, monthly_price, annual_price, live_charge_allowed, raw_card_storage_allowed, separation_verified").or(betaFilter).limit(20)),
        safeQuery<Row>("digital observer beta invoices billing", () => supabase.from("digital_observer_beta_invoices" as any).select("id, invoice_number, customer_id, beta_site_id, package_key, billing_cycle, amount, currency, tax_readiness, invoice_status, pdf_ready, email_delivery_readiness, issued_at, due_at, paid_at").or(betaFilter).order("created_at", { ascending: false }).limit(20)),
        safeQuery<Row>("digital observer beta health billing", () => supabase.from("digital_observer_customer_health_scores" as any).select("id, customer_id, beta_site_id, score, setup_completion_score, camera_stability_score, alert_value_score, support_load_score, payment_status_score, churn_risk_score, status").or(betaFilter).order("calculated_at", { ascending: false }).limit(20))
      ])
    : [[], [], []];

  const activeSubscription = subscriptions.find((item) => ["active", "trial"].includes(String(item.subscription_status ?? item.status))) ?? subscriptions[0];
  const activeBetaSubscription = betaSubscriptions.find((item) => ["trial", "active_paid_beta"].includes(String(item.subscription_status))) ?? betaSubscriptions[0];
  const currentPackage = packageRows.find((pkg) => pkg.id === activeSubscription?.package_id) ?? packageRows[0];
  const currentUsage = usage[0] ?? {};
  const betaHealthScore = betaHealth[0]?.score ?? 0;
  const cameraLimit = Number(currentPackage?.camera_limit ?? 0);
  const activeCameras = Number(currentUsage.active_cameras ?? 0);
  const cameraUsageText = cameraLimit ? `${activeCameras}/${cameraLimit}` : `${activeCameras}/custom`;

  return (
    <>
      <BrandHeader />
      <main className="public-page digital-observer-app">
        <nav className="product-switcher" aria-label="Digital Observer billing navigation">
          <strong>Digital Observer</strong>
          <div>
            {DIGITAL_OBSERVER_NAVIGATION.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
          </div>
        </nav>

        <section className="dashboard-hero-card observer-dashboard-hero">
          <div>
            <p className="eyebrow">Digital Observer Billing</p>
            <h1>Standalone subscription and usage readiness.</h1>
            <p>Digital Observer billing is separate from Gan Batuach kindergarten subscriptions and parent tuition payments.</p>
          </div>
          <div className="hero-actions">
            <Link className="button primary" href="/digital-observer/onboarding">Start trial</Link>
            <Link className="button secondary" href="/digital-observer/dashboard">Dashboard</Link>
          </div>
        </section>

        <section className="grid cols-4 dashboard-panels">
          <article className="metric-card"><PackageCheck /><strong>{currentPackage?.name ?? "No package"}</strong><span>current package</span></article>
          <article className="metric-card"><CreditCard /><strong>{activeBetaSubscription?.subscription_status ?? activeSubscription?.subscription_status ?? activeSubscription?.status ?? "setup"}</strong><span>subscription status</span></article>
          <article className="metric-card"><TrendingUp /><strong>{cameraUsageText}</strong><span>camera usage</span></article>
          <article className="metric-card"><FileText /><strong>{invoices.length + betaInvoices.length}</strong><span>invoices</span></article>
        </section>

        {(betaCustomers.length > 0 || betaSites.length > 0 || activeBetaSubscription) && (
          <section className="grid cols-2 dashboard-panels">
            <article className="card action-panel">
              <ShieldCheck />
              <h2>Paid beta status</h2>
              <div className="procedure-list compact-list">
                <div className="mini-row"><span>Beta customer</span><strong>{betaCustomers[0]?.customer_name ?? "not linked"}</strong><small>{betaCustomers[0]?.beta_status ?? "status pending"} · {betaCustomers[0]?.customer_type ?? "type TBD"}</small></div>
                <div className="mini-row"><span>Beta site</span><strong>{betaSites[0]?.site_name ?? "site pending"}</strong><small>{betaSites[0]?.camera_count ?? 0} cameras · readiness {betaSites[0]?.beta_readiness ?? 0}/100</small></div>
                <div className="mini-row"><span>Payment mode</span><strong>{activeBetaSubscription?.payment_mode ?? betaSites[0]?.payment_mode ?? "disabled"}</strong><small>Live charging only when explicitly configured.</small></div>
                <div className="mini-row"><span>Customer health</span><strong>{betaHealthScore}/100</strong><small>Setup, camera stability, alert value, support, payment and churn.</small></div>
              </div>
            </article>
            <article className="card action-panel">
              <CreditCard />
              <h2>Paid beta billing</h2>
              <div className="procedure-list compact-list">
                <div className="mini-row"><span>Package</span><strong>{activeBetaSubscription?.package_key ?? betaCustomers[0]?.package_selected ?? "package TBD"}</strong><small>Digital Observer package only.</small></div>
                <div className="mini-row"><span>Next charge</span><strong>{dateText(activeBetaSubscription?.next_charge_at)}</strong><small>{activeBetaSubscription?.live_charge_allowed ? "Provider allows charge" : "Charge blocked until provider is configured"}</small></div>
                <div className="mini-row"><span>Monthly</span><strong>{money(activeBetaSubscription?.monthly_price)}</strong><small>Accepted beta price or readiness value.</small></div>
                <div className="mini-row"><span>Separation</span><strong>{activeBetaSubscription?.separation_verified === false ? "needs review" : "verified"}</strong><small>Not Gan Batuach billing, not parent tuition.</small></div>
              </div>
            </article>
          </section>
        )}

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <PackageCheck />
            <h2>Current package</h2>
            <div className="setup-checklist">
              <span>{currentPackage?.monitoring_mode ?? "mode TBD"}</span>
              <span>{currentPackage?.event_retention_days ?? 0} event retention days</span>
              <span>{currentPackage?.recording_retention_days ?? 0} recording days readiness</span>
              <span>{currentPackage?.live_view_enabled ? "live view ready" : "live view off"}</span>
              <span>{currentPackage?.multi_user_access ? "multi-user ready" : "single-user"}</span>
              <span>{currentPackage?.advanced_analytics ? "advanced analytics ready" : "basic analytics"}</span>
              <span>{currentPackage?.human_review_required ? "human review required" : "review policy missing"}</span>
            </div>
          </article>

          <article className="card action-panel">
            <CreditCard />
            <h2>Trial and renewal</h2>
            <div className="procedure-list compact-list">
              <div className="mini-row"><span>Trial start</span><strong>{dateText(activeSubscription?.trial_start)}</strong><small>Trial does not enable unrestricted production monitoring.</small></div>
              <div className="mini-row"><span>Trial end</span><strong>{dateText(activeSubscription?.trial_end)}</strong><small>Reminder readiness stored with subscription.</small></div>
              <div className="mini-row"><span>Renewal</span><strong>{dateText(activeSubscription?.renewal_date)}</strong><small>{activeSubscription?.billing_cycle ?? "monthly"} billing readiness</small></div>
              <div className="mini-row"><span>Grace period</span><strong>{dateText(activeSubscription?.grace_period_ends_at)}</strong><small>Monitoring may be paused if expired or suspended.</small></div>
            </div>
          </article>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <TrendingUp />
            <h2>Usage vs limits</h2>
            <div className="procedure-list compact-list">
              <div className="mini-row"><span>Active cameras</span><strong>{cameraUsageText}</strong><small>Cannot add beyond package limit when enforcement is enabled.</small></div>
              <div className="mini-row"><span>AI events this month</span><strong>{currentUsage.ai_events_count ?? 0}</strong><small>Human review remains required.</small></div>
              <div className="mini-row"><span>Monitoring hours</span><strong>{currentUsage.monitoring_hours_used ?? 0}</strong><small>Schedule modes: 24/7, night, business hours, custom or event-only.</small></div>
              <div className="mini-row"><span>Alerts sent</span><strong>{currentUsage.alerts_sent ?? 0}</strong><small>Channels are limited by package and provider mode.</small></div>
              <div className="mini-row"><span>Playback sessions</span><strong>{currentUsage.playback_sessions ?? 0}</strong><small>Playback remains token-scoped and audited.</small></div>
            </div>
          </article>

          <article className="card action-panel">
            <RefreshCcw />
            <h2>Upgrade / downgrade readiness</h2>
            {changes.length === 0 ? <p>No package changes requested. Future changes can be scheduled for renewal or approved manually.</p> : (
              <div className="procedure-list compact-list">
                {changes.map((change) => (
                  <div className="mini-row" key={change.id}>
                    <span>{change.change_type}</span>
                    <strong><span className={statusClass(change.status)}>{change.status}</span></strong>
                    <small>effective {dateText(change.effective_at)} · prorated {change.prorated_billing_ready ? "ready" : "not ready"}</small>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Package feature matrix</h2>
            <p>Billing is readiness-only until a provider is explicitly configured. No raw card data is stored.</p>
          </div>
          <div className="procedure-list">
            {DIGITAL_OBSERVER_PACKAGES.map((pkg) => (
              <article className="card procedure-card" key={pkg.key}>
                <div>
                  <span className="pill">{pkg.type}</span>
                  <h3>{pkg.name}</h3>
                  <p>{pkg.cameras} · {pkg.hours} · {pkg.retention}</p>
                  <small>{pkg.channels} · {pkg.recordingRetention} · {pkg.advancedAnalytics ? "advanced analytics" : "basic analytics"}</small>
                </div>
                <div className="procedure-meta">
                  <strong>{pkg.monthlyPrice}</strong>
                  <span>{pkg.annualPrice}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <FileText />
            <h2>Invoices</h2>
            {invoices.length === 0 ? <p>Invoice readiness exists, but no Digital Observer invoices have been issued yet.</p> : (
              <div className="procedure-list compact-list">
                {invoices.map((invoice) => (
                  <div className="mini-row" key={invoice.id}>
                    <span>{invoice.invoice_number}</span>
                    <strong><span className={statusClass(invoice.status)}>{invoice.status}</span></strong>
                    <small>{money(invoice.amount)} · due {dateText(invoice.due_at)} · PDF {invoice.pdf_ready ? "ready" : "not ready"}</small>
                  </div>
                ))}
              </div>
            )}
            {betaInvoices.length > 0 && (
              <div className="procedure-list compact-list">
                {betaInvoices.map((invoice) => (
                  <div className="mini-row" key={invoice.id}>
                    <span>{invoice.invoice_number}</span>
                    <strong><span className={statusClass(invoice.invoice_status)}>{invoice.invoice_status}</span></strong>
                    <small>{money(invoice.amount)} · paid beta · PDF {invoice.pdf_ready ? "ready" : "not ready"}</small>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="card action-panel">
            <ShieldCheck />
            <h2>Billing separation</h2>
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

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <AlertTriangle />
            <h2>Payment provider readiness</h2>
            <div className="procedure-list compact-list">
              {(providers.length ? providers : DIGITAL_OBSERVER_PAYMENT_PROVIDERS.map((provider) => ({ provider_key: provider.toLowerCase(), provider_name: provider, status: "not_configured", mode: "sandbox", raw_card_storage_allowed: false }))).map((provider) => (
                <div className="mini-row" key={provider.provider_key ?? provider.provider_name}>
                  <span>{provider.provider_name}</span>
                  <strong><span className={statusClass(provider.status)}>{provider.status}</span></strong>
                  <small>{provider.mode} · raw cards {provider.raw_card_storage_allowed ? "not allowed gap" : "not stored"}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="card action-panel">
            <AlertTriangle />
            <h2>Cancellation / suspension readiness</h2>
            <p>If suspended, monitoring should pause while billing and support remain accessible. Historical data remains governed by retention policy.</p>
            <div className="hero-actions">
              <Link className="button secondary" href="/digital-observer/dashboard">Back to dashboard</Link>
              <Link className="button secondary" href="/dashboard/privacy">Privacy requests</Link>
            </div>
          </article>
        </section>
      </main>
    </>
  );
}
