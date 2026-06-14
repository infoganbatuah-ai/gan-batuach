import Link from "next/link";
import { ArrowLeft, Building2, CheckCircle2, Mail, Phone, Radar, UserPlus } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function statusClass(status?: string) {
  if (status === "converted" || status === "qualified") return "pill good";
  if (status === "new" || status === "demo_scheduled") return "pill warn";
  return "pill";
}

function date(value?: string | null) {
  if (!value) return "לא נקבע";
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminDigitalObserverLeadsPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("digital observer leads", async () => {
    const supabase = await createClient();
    const [leads, events, conversion] = await Promise.all([
      supabase
        .from("digital_observer_leads" as any)
        .select("id, product_type, source, status, lead_status, conversion_status, contact_name, contact_email, contact_phone, company_name, business_name, site_type, city, estimated_cameras, camera_count, package_interest, interest_score, preferred_contact_method, current_camera_system, assigned_owner, follow_up_at, notes, utm_source, utm_campaign, created_at")
        .eq("product_type", "digital_observer")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("digital_observer_marketing_events" as any)
        .select("event_type, source, site_type, package_interest, route, occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(120),
      supabase
        .from("digital_observer_lead_conversion_readiness" as any)
        .select("readiness_key, step_name, target_record, status, notes")
        .order("created_at", { ascending: true })
    ]);
    [leads, events, conversion].forEach((query, index) => logSupabaseError("digital observer leads query " + index, query.error));
    return {
      leads: leads.data ?? [],
      events: events.data ?? [],
      conversion: conversion.data ?? [],
      queryError: leads.error ? "לא ניתן לטעון לידים של Digital Observer כרגע" : null
    };
  }, { leads: [] as any[], events: [] as any[], conversion: [] as any[], queryError: null as string | null });
  const data = result.data;
  const newLeads = data.leads.filter((lead) => lead.lead_status === "new" || lead.status === "new").length;
  const demoRequests = data.leads.filter((lead) => lead.source === "digital_observer_demo").length;
  const qualified = data.leads.filter((lead) => lead.lead_status === "qualified" || lead.conversion_status === "qualified").length;
  const converted = data.leads.filter((lead) => lead.lead_status === "converted" || lead.conversion_status === "converted_to_observer_site").length;

  return (
    <DashboardShell role="admin" title="Digital Observer Leads">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Standalone acquisition</p>
          <h1>Digital Observer lead funnel.</h1>
          <p>לידים לבתים, עסקים, משרדים, מחסנים, חנויות וחניונים. אין יצירת גנים, ילדים, הורים או צוות במסלול הזה.</p>
        </div>
        <Link className="button primary" href="/digital-observer/request-demo">Open demo form <ArrowLeft size={18} /></Link>
      </div>
      <AdminDataError message={result.error ?? data.queryError} />

      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><UserPlus /><strong>{newLeads}</strong><span>New leads</span></article>
        <article className="metric-card"><Radar /><strong>{demoRequests}</strong><span>Demo requests</span></article>
        <article className="metric-card"><CheckCircle2 /><strong>{qualified}</strong><span>Qualified</span></article>
        <article className="metric-card"><Building2 /><strong>{converted}</strong><span>Converted readiness</span></article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>Lead queue</h2>
          <p>Admin actions are readiness actions: contact, qualify, reject, convert to observer site, assign follow-up and send onboarding link.</p>
        </div>
        {data.leads.length === 0 ? (
          <div className="empty-state"><strong>No Digital Observer leads yet</strong><span>Demo, pricing and start forms will create standalone leads here.</span></div>
        ) : (
          <div className="procedure-list">
            {data.leads.map((lead) => (
              <article className="card procedure-card" key={lead.id}>
                <div>
                  <span className={statusClass(lead.lead_status ?? lead.status)}>{lead.lead_status ?? lead.status}</span>
                  <span className="pill">{lead.site_type}</span>
                  <span className="pill">{lead.source}</span>
                  <h3>{lead.contact_name ?? "Digital Observer lead"}</h3>
                  <p>{lead.business_name ?? lead.company_name ?? "Unnamed site"} · {lead.city ?? "no city"} · {lead.camera_count ?? lead.estimated_cameras ?? 0} cameras</p>
                  <small>{lead.package_interest ?? "No package selected"} · score {lead.interest_score ?? 0}/100 · {date(lead.created_at)}</small>
                </div>
                <div className="procedure-meta">
                  <span><Phone size={14} /> {lead.contact_phone ?? "no phone"}</span>
                  <span><Mail size={14} /> {lead.contact_email ?? "no email"}</span>
                  <span>{lead.preferred_contact_method ?? "any"} · {lead.current_camera_system ?? "camera system unknown"}</span>
                  <span>UTM: {lead.utm_source ?? "none"} / {lead.utm_campaign ?? "none"}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Conversion readiness</h2><p>Leads convert into observer site records only.</p></div>
          <div className="risk-list">
            {data.conversion.map((item) => (
              <div key={item.readiness_key}>{item.step_name} <b>{item.status}</b></div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Recent funnel events</h2><p>Internal CTA and form analytics without external analytics provider.</p></div>
          <div className="risk-list">
            {data.events.length === 0 ? <div>No events yet <b>ready</b></div> : data.events.slice(0, 10).map((event, index) => (
              <div key={`${event.event_type}-${index}`}>{event.event_type} · {event.source ?? "source"} <b>{event.site_type ?? "site"}</b></div>
            ))}
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}
