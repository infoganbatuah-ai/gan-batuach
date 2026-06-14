import Link from "next/link";
import { BarChart3, Bell, Camera, LineChart, MapPin, PackageCheck, TrendingUp } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function countBy<T extends Record<string, any>>(items: T[], key: keyof T) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = String(item[key] ?? "unknown");
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

export default async function AdminDigitalObserverGrowthPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("digital observer growth", async () => {
    const supabase = await createClient();
    const [leads, events, demoContent, templates] = await Promise.all([
      supabase.from("digital_observer_leads" as any).select("source, site_type, city, package_interest, interest_score, lead_status, created_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("digital_observer_marketing_events" as any).select("event_type, source, site_type, package_interest, route, occurred_at").order("occurred_at", { ascending: false }).limit(500),
      supabase.from("digital_observer_demo_content" as any).select("demo_key, site_type, title, status, uses_real_people, uses_real_credentials").order("site_type", { ascending: true }),
      supabase.from("digital_observer_followup_templates" as any).select("template_key, channel, title, provider_mode, status").order("channel", { ascending: true })
    ]);
    [leads, events, demoContent, templates].forEach((query, index) => logSupabaseError("digital observer growth query " + index, query.error));
    return {
      leads: leads.data ?? [],
      events: events.data ?? [],
      demoContent: demoContent.data ?? [],
      templates: templates.data ?? [],
      queryError: leads.error ? "לא ניתן לטעון נתוני צמיחה של Digital Observer כרגע" : null
    };
  }, { leads: [] as any[], events: [] as any[], demoContent: [] as any[], templates: [] as any[], queryError: null as string | null });
  const data = result.data;
  const sourceDemand = countBy(data.leads, "source");
  const siteDemand = countBy(data.leads, "site_type");
  const cityDemand = countBy(data.leads, "city");
  const eventCounts = countBy(data.events, "event_type");
  const avgScore = data.leads.length ? Math.round(data.leads.reduce((sum, lead) => sum + Number(lead.interest_score ?? 0), 0) / data.leads.length) : 0;

  return (
    <DashboardShell role="admin" title="Digital Observer Growth">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Marketing analytics</p>
          <h1>Digital Observer acquisition and conversion readiness.</h1>
          <p>Visits readiness, leads, source demand, package interest, city demand, demo requests and onboarding starts. No external analytics provider required.</p>
        </div>
        <Link className="button primary" href="/dashboard/admin/digital-observer-leads">Lead queue</Link>
      </div>
      <AdminDataError message={result.error ?? data.queryError} />

      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><TrendingUp /><strong>{data.leads.length}</strong><span>Leads</span></article>
        <article className="metric-card"><BarChart3 /><strong>{data.events.length}</strong><span>Tracked events</span></article>
        <article className="metric-card"><LineChart /><strong>{avgScore}/100</strong><span>Avg interest score</span></article>
        <article className="metric-card"><PackageCheck /><strong>{data.templates.length}</strong><span>Follow-up templates</span></article>
      </section>

      <section className="grid cols-3 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Lead source demand</h2><p>Campaign and page attribution readiness.</p></div>
          <div className="risk-list">
            {Object.entries(sourceDemand).length === 0 ? <div>No source data <b>ready</b></div> : Object.entries(sourceDemand).map(([key, value]) => <div key={key}>{key} <b>{value}</b></div>)}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Site type demand</h2><p>Home, business, warehouse, store, office, parking and custom demand.</p></div>
          <div className="risk-list">
            {Object.entries(siteDemand).length === 0 ? <div>No site data <b>ready</b></div> : Object.entries(siteDemand).map(([key, value]) => <div key={key}>{key} <b>{value}</b></div>)}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>City demand</h2><p>Useful for regional outreach and sales follow-up.</p></div>
          <div className="risk-list">
            {Object.entries(cityDemand).length === 0 ? <div>No city data <b>ready</b></div> : Object.entries(cityDemand).slice(0, 10).map(([key, value]) => <div key={key}><MapPin size={14} /> {key} <b>{value}</b></div>)}
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>CTA and funnel events</h2><p>Homepage, pricing, demo, start and package selection events.</p></div>
          <div className="risk-list">
            {Object.entries(eventCounts).length === 0 ? <div>No event data <b>ready</b></div> : Object.entries(eventCounts).map(([key, value]) => <div key={key}>{key} <b>{value}</b></div>)}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Safe demo content</h2><p>Demo data must stay synthetic.</p></div>
          <div className="risk-list">
            {data.demoContent.length === 0 ? <div>No demo content <b>missing</b></div> : data.demoContent.map((item) => (
              <div key={item.demo_key}><Camera size={14} /> {item.title} <b>{item.uses_real_people || item.uses_real_credentials ? "blocked" : item.status}</b></div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>Follow-up templates</h2>
          <p>Email, WhatsApp, SMS, push and in-app readiness. Real sending remains controlled by provider mode.</p>
        </div>
        <div className="procedure-list">
          {data.templates.map((template) => (
            <article className="card procedure-card" key={template.template_key}>
              <div>
                <span className="pill">{template.channel}</span>
                <span className="pill">{template.provider_mode}</span>
                <h3>{template.title}</h3>
                <p>{template.template_key}</p>
              </div>
              <div className="procedure-meta"><span><Bell size={14} /> {template.status}</span></div>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
