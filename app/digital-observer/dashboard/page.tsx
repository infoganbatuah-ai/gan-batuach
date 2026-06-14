import Link from "next/link";
import { AlertTriangle, BarChart3, Bell, Camera, CheckCircle2, CreditCard, HeartPulse, PackageCheck, Radar, ShieldCheck, UserRound } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { requireUser } from "@/lib/auth";
import { logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { DIGITAL_OBSERVER_ADMIN_OVERVIEW, DIGITAL_OBSERVER_NAVIGATION, DIGITAL_OBSERVER_SETUP_ACTIONS } from "@/lib/domain/digital-observer-product";

type Row = Record<string, any>;

async function safeQuery<T>(label: string, run: () => any) {
  try {
    const result = (await run()) as { data: T[] | null; error: any; count?: number | null };
    logSupabaseError(label, result.error);
    return result.error ? { data: [] as T[], count: 0 } : { data: result.data ?? [], count: result.count ?? result.data?.length ?? 0 };
  } catch (error) {
    logSupabaseError(label, error);
    return { data: [] as T[], count: 0 };
  }
}

function statusTone(status?: string | null) {
  if (["active", "resolved", "confirmed", "ready", "healthy"].includes(String(status))) return "pill good";
  if (["trial", "needs_review", "reviewing", "pending_payment", "degraded"].includes(String(status))) return "pill warn";
  return "pill";
}

export default async function DigitalObserverOwnerDashboardPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();
  const [ownedSitesRes, membershipsRes, packagesRes] = await Promise.all([
    safeQuery<Row>("observer owned sites", () => supabase.from("observer_sites" as any).select("id, name, site_type, active, monitoring_enabled, observer_subscription_status, camera_limit, event_retention_days, created_at").eq("owner_profile_id", profile.id).neq("site_type", "kindergarten").limit(50)),
    safeQuery<Row>("observer memberships", () => supabase.from("observer_site_memberships" as any).select("observer_site_id, member_role, observer_sites(id, name, site_type, active, monitoring_enabled, observer_subscription_status, camera_limit, event_retention_days, created_at)").eq("profile_id", profile.id).eq("active", true).limit(50)),
    safeQuery<Row>("observer packages", () => supabase.from("observer_monitoring_packages" as any).select("id, name, package_type, camera_limit, monthly_price, annual_price, monitoring_mode, event_retention_days, ai_event_types_enabled").eq("active", true).order("sort_order").limit(20))
  ]);
  const memberSites = membershipsRes.data.map((membership) => membership.observer_sites).filter(Boolean);
  const siteMap = new Map<string, Row>();
  [...ownedSitesRes.data, ...memberSites].forEach((site) => {
    if (site?.id && site.site_type !== "kindergarten") siteMap.set(site.id, site);
  });
  const sites = Array.from(siteMap.values());
  const siteIds = sites.map((site) => site.id).filter(Boolean);

  const [camerasRes, signalsRes, subscriptionsRes, usageRes, billingUsageRes] = siteIds.length
    ? await Promise.all([
        safeQuery<Row>("observer cameras", () => supabase.from("camera_streams" as any).select("id, name, observer_site_id, status, parent_visible, ai_enabled").in("observer_site_id", siteIds).limit(200)),
        safeQuery<Row>("observer signals", () => supabase.from("observer_intelligence_signals" as any).select("id, observer_site_id, signal_type, severity, review_status, risk_score, recommended_action, created_at").in("observer_site_id", siteIds).order("created_at", { ascending: false }).limit(80)),
        safeQuery<Row>("observer subscriptions", () => supabase.from("observer_site_subscriptions" as any).select("id, observer_site_id, status, subscription_status, renewal_date, trial_start, trial_end, billing_cycle, monthly_price, annual_price, timezone, package_id").in("observer_site_id", siteIds).limit(80)),
        safeQuery<Row>("observer usage", () => supabase.from("observer_site_usage_snapshots" as any).select("id, observer_site_id, active_cameras, ai_events_count, playback_sessions, alerts_sent, users_invited, failed_camera_checks, period_start, period_end").in("observer_site_id", siteIds).order("period_start", { ascending: false }).limit(80)),
        safeQuery<Row>("observer billing usage", () => supabase.from("observer_usage_tracking" as any).select("id, observer_site_id, active_cameras, ai_events_count, storage_used_mb, monitoring_hours_used, alerts_sent, playback_sessions, users_invited, failed_camera_checks, package_limit_status, period_start, period_end").in("observer_site_id", siteIds).order("period_start", { ascending: false }).limit(80))
      ])
    : [{ data: [], count: 0 }, { data: [], count: 0 }, { data: [], count: 0 }, { data: [], count: 0 }, { data: [], count: 0 }];

  const activeSites = sites.filter((site) => site.active).length;
  const cameras = camerasRes.data;
  const signals = signalsRes.data;
  const openSignals = signals.filter((signal) => ["needs_review", "reviewing", "escalated"].includes(String(signal.review_status)));
  const unhealthyCameras = cameras.filter((camera) => !["online", "active", "ready"].includes(String(camera.status)));
  const subscriptions = subscriptionsRes.data;
  const latestUsage = usageRes.data[0];
  const latestBillingUsage = billingUsageRes.data[0] ?? latestUsage ?? {};
  const activeSubscriptions = subscriptions.filter((item) => ["active", "trial"].includes(String(item.subscription_status ?? item.status))).length;
  const billingIssues = subscriptions.filter((item) => ["pending_payment", "overdue", "expired", "suspended"].includes(String(item.subscription_status ?? item.status))).length;
  const setupProgress = sites.length ? Math.round(((sites.filter((site) => site.monitoring_enabled).length + (cameras.length ? 1 : 0) + (subscriptions.length ? 1 : 0)) / (sites.length + 2)) * 100) : 0;
  const [analyticsRes, leadsRes] = await Promise.all([
    safeQuery<Row>("digital observer analytics readiness", () => supabase.from("digital_observer_analytics_events" as any).select("event_type, count_value, status, source, site_type, package_key").order("occurred_at", { ascending: false }).limit(40)),
    safeQuery<Row>("digital observer leads readiness", () => supabase.from("digital_observer_leads" as any).select("source, status, site_type, package_interest, estimated_cameras").order("created_at", { ascending: false }).limit(40))
  ]);

  return (
    <>
      <BrandHeader />
      <main className="public-page digital-observer-app">
        <nav className="product-switcher" aria-label="Digital Observer application navigation">
          <strong>Digital Observer</strong>
          <div>
            {DIGITAL_OBSERVER_NAVIGATION.map((item) => (
              <Link key={item.href} href={item.href}>{item.label}</Link>
            ))}
          </div>
        </nav>

        <section className="dashboard-hero-card observer-dashboard-hero">
          <div>
            <p className="eyebrow">Digital Observer Dashboard</p>
            <h1>Welcome, {profile.full_name ?? "site owner"}.</h1>
            <p>Standalone site monitoring for homes, businesses and organizations. Gan Batuach kindergarten data stays in Gan Batuach dashboards.</p>
          </div>
          <div className="hero-actions">
            <Link className="button primary" href="/digital-observer/onboarding">Create observer site</Link>
            <Link className="button secondary" href="/dashboard/security-settings">Security settings</Link>
          </div>
        </section>

        <section className="grid cols-4 dashboard-panels">
          <article className="metric-card"><UserRound /><strong>{sites.length}</strong><span>monitored sites</span></article>
          <article className="metric-card"><Camera /><strong>{cameras.length}</strong><span>cameras</span></article>
          <article className="metric-card"><Bell /><strong>{openSignals.length}</strong><span>open observer alerts</span></article>
          <article className="metric-card"><ShieldCheck /><strong>{activeSites ? "active" : "setup"}</strong><span>site health</span></article>
          <article className="metric-card"><PackageCheck /><strong>{activeSubscriptions}</strong><span>active/trial subscriptions</span></article>
          <article className="metric-card"><BarChart3 /><strong>{latestBillingUsage.ai_events_count ?? 0}</strong><span>AI events this month</span></article>
          <article className="metric-card"><CreditCard /><strong>{billingIssues}</strong><span>billing issues</span></article>
          <article className="metric-card"><CheckCircle2 /><strong>{setupProgress}%</strong><span>setup progress</span></article>
        </section>

        <section className="grid cols-2 dashboard-panels" id="setup">
          <article className="card action-panel">
            <div className="section-heading">
              <h2>Setup actions</h2>
              <p>Keep Digital Observer setup separate from kindergarten onboarding.</p>
            </div>
            <div className="procedure-list">
              {DIGITAL_OBSERVER_SETUP_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <div className="procedure-card" key={action.title}>
                    <Icon />
                    <div><h3>{action.title}</h3><p>{action.text}</p></div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="card action-panel">
            <div className="section-heading">
              <h2>Readiness snapshot</h2>
              <p>Uses shared observer core tables, scoped to standalone observer sites.</p>
            </div>
            <div className="setup-checklist">
              <span>{subscriptions.length} subscription records</span>
              <span>{unhealthyCameras.length} cameras need attention</span>
              <span>{signals.length} recent signals</span>
              <span>{latestBillingUsage.active_cameras ?? latestUsage?.active_cameras ?? 0} active cameras this month</span>
              <span>{latestBillingUsage.monitoring_hours_used ?? 0} monitoring hours used</span>
              <span>{latestBillingUsage.alerts_sent ?? 0} alerts sent</span>
              <span>Human review required</span>
              <span>No parent/child flows</span>
            </div>
          </article>
        </section>

        <section className="dashboard-section" id="sites">
          <div className="section-heading">
            <h2>My observer sites</h2>
            <p>Homes, businesses, offices, warehouses, stores and parking lots only. Kindergartens use Gan Batuach.</p>
            <Link className="button secondary" href="/digital-observer/onboarding">Add site</Link>
          </div>
          {sites.length === 0 ? (
            <div className="empty-state">
              <strong>No standalone Digital Observer sites yet</strong>
              <span>Create a setup draft to connect cameras and activate test mode when ready.</span>
            </div>
          ) : (
            <div className="procedure-list">
              {sites.map((site) => {
                const siteCameras = cameras.filter((camera) => camera.observer_site_id === site.id);
                const siteSignals = openSignals.filter((signal) => signal.observer_site_id === site.id);
                const subscription = subscriptions.find((item) => item.observer_site_id === site.id);
                return (
                  <article className="card procedure-card" key={site.id}>
                    <div>
                      <span className={statusTone(site.active ? "active" : "inactive")}>{site.active ? "active" : "inactive"}</span>
                      <span className="pill">{site.site_type}</span>
                      <h3>{site.name}</h3>
                      <p>{site.monitoring_enabled ? "Monitoring enabled" : "Monitoring waiting for setup"} · subscription {subscription?.subscription_status ?? subscription?.status ?? site.observer_subscription_status ?? "trial"}</p>
                      <Link className="button secondary" href={`/digital-observer/sites/${site.id}`}>Open site</Link>
                    </div>
                    <div className="procedure-meta">
                      <span>{siteCameras.length} cameras</span>
                      <span>{siteSignals.length} alerts</span>
                      <span>{site.event_retention_days ?? 30} days retention</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid cols-2 dashboard-panels" id="alerts">
          <article className="card action-panel">
            <Radar />
            <h2>Recent observer events</h2>
            {signals.length === 0 ? <p>No observer events yet. Events will appear after camera and shadow-mode setup.</p> : (
              <div className="procedure-list compact-list">
                {signals.slice(0, 8).map((signal) => (
                  <div className="mini-row" key={signal.id}>
                    <span>{signal.signal_type}</span>
                    <strong><span className={statusTone(signal.review_status)}>{signal.review_status}</span></strong>
                    <small>{signal.recommended_action ?? "Review recommended"} · risk {signal.risk_score ?? 0}/100</small>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="card action-panel" id="billing">
            <PackageCheck />
            <h2>Package readiness</h2>
            {packagesRes.data.length === 0 ? <p>Package records may be admin-only or pending migration.</p> : (
              <div className="procedure-list compact-list">
                {packagesRes.data.slice(0, 6).map((pkg) => (
                  <div className="mini-row" key={pkg.id}>
                    <span>{pkg.name}</span>
                    <strong>{pkg.camera_limit ?? "custom"} cameras</strong>
                    <small>{pkg.monitoring_mode} · {pkg.event_retention_days} days · {pkg.monthly_price ?? 0} ILS readiness</small>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Recommended actions</h2>
            <p>Digital Observer commercial actions stay separate from kindergarten billing and parent tuition.</p>
          </div>
          <div className="grid cols-4 dashboard-panels">
            <Link className="premium-action-card" href="/digital-observer/onboarding"><Camera /><strong>Add cameras</strong><span>Use gateway readiness; never expose RTSP or credentials.</span></Link>
            <Link className="premium-action-card" href="/digital-observer/billing"><CreditCard /><strong>Review billing</strong><span>Package, trial, usage, invoices and upgrade readiness.</span></Link>
            <Link className="premium-action-card" href="/digital-observer/onboarding#goals"><Radar /><strong>Monitoring goals</strong><span>Select generic goals through capability policy.</span></Link>
            <Link className="premium-action-card" href="/dashboard/security-settings"><ShieldCheck /><strong>Security settings</strong><span>Keep account and device security current.</span></Link>
          </div>
        </section>

        <section className="grid cols-3 dashboard-panels" id="cameras">
          <article className="card compact-card"><CheckCircle2 /><h3>AI readiness</h3><p>Observer goals are advisory and require human review before action.</p></article>
          <article className="card compact-card"><AlertTriangle /><h3>Restricted capabilities</h3><p>Audio, face, biometric and legal-review features are controlled by the capability matrix.</p></article>
          <article className="card compact-card"><HeartPulse /><h3>Site health</h3><p>Camera health, gateway status, alerts and subscriptions share existing infrastructure.</p></article>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <BarChart3 />
            <h2>Analytics readiness</h2>
            <div className="procedure-list compact-list">
              {analyticsRes.data.length === 0 ? <p>Analytics events are readiness-only until tracking is connected.</p> : analyticsRes.data.map((event) => (
                <div className="mini-row" key={`${event.event_type}-${event.source}-${event.package_key}`}>
                  <span>{event.event_type}</span>
                  <strong>{event.count_value}</strong>
                  <small>{event.source ?? "source TBD"} · {event.site_type ?? "all sites"} · {event.status}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="card action-panel">
            <UserRound />
            <h2>Lead flow readiness</h2>
            <div className="procedure-list compact-list">
              {leadsRes.data.length === 0 ? <p>Digital Observer leads will be tracked separately from kindergarten leads.</p> : leadsRes.data.map((lead, index) => (
                <div className="mini-row" key={`${lead.source}-${lead.site_type}-${index}`}>
                  <span>{lead.source}</span>
                  <strong><span className={statusTone(lead.status)}>{lead.status}</span></strong>
                  <small>{lead.site_type} · {lead.estimated_cameras} cameras · {lead.package_interest ?? "package TBD"}</small>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Admin product overview readiness</h2>
            <p>Admins can distinguish Gan Batuach gardens from Digital Observer sites and shared core infrastructure.</p>
          </div>
          <div className="grid cols-4 dashboard-panels">
            {DIGITAL_OBSERVER_ADMIN_OVERVIEW.map((item) => (
              <article className="card compact-card" key={item.label}>
                <ShieldCheck />
                <h3>{item.label}</h3>
                <p>{item.note}</p>
                <span className="pill">{item.source}</span>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
