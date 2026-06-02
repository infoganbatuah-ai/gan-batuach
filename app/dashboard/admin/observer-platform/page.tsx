import Link from "next/link";
import { Bot, Building2, Camera, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

function siteTypeLabel(type?: string) {
  return ({
    kindergarten: "גן ילדים",
    home: "בית",
    office: "משרד",
    business: "עסק",
    warehouse: "מחסן",
    store: "חנות",
    parking_lot: "חניה",
    custom: "מותאם"
  } as Record<string, string>)[type ?? ""] ?? "מותאם";
}

export default async function AdminObserverPlatformPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("observer platform overview", async () => {
    const supabase = await createClient();
    const [sites, cameras, zones, events] = await Promise.all([
      supabase.from("observer_sites" as any).select("*, gardens(name, city)").order("created_at", { ascending: false }).limit(200),
      supabase.from("camera_streams" as any).select("id, name, status, observer_site_id, garden_id").limit(500),
      supabase.from("camera_zones" as any).select("id, name, zone_type, observer_site_id, kindergarten_id, is_active").limit(500),
      supabase.from("ai_camera_events" as any).select("id, event_type, status, severity, observer_site_id, site_type, created_at").order("created_at", { ascending: false }).limit(300)
    ]);
    [sites, cameras, zones, events].forEach((query, index) => logSupabaseError("observer platform query " + index, query.error));
    return {
      sites: sites.data ?? [],
      cameras: cameras.data ?? [],
      zones: zones.data ?? [],
      events: events.data ?? [],
      queryError: sites.error ? "לא ניתן לטעון את תשתית ה-Digital Observer כרגע" : null
    };
  }, { sites: [] as any[], cameras: [] as any[], zones: [] as any[], events: [] as any[], queryError: null as string | null });
  const data = result.data;
  const siteTypeCounts = data.sites.reduce<Record<string, number>>((acc: Record<string, number>, site: any) => {
    acc[site.site_type] = (acc[site.site_type] ?? 0) + 1;
    return acc;
  }, {});
  const activeMonitoring = data.sites.filter((site: any) => site.monitoring_enabled).length;
  const camerasBySite = new Map<string, number>();
  data.cameras.forEach((camera: any) => {
    if (camera.observer_site_id) camerasBySite.set(camera.observer_site_id, (camerasBySite.get(camera.observer_site_id) ?? 0) + 1);
  });
  const eventsBySite = new Map<string, number>();
  data.events.forEach((event: any) => {
    if (event.observer_site_id) eventsBySite.set(event.observer_site_id, (eventsBySite.get(event.observer_site_id) ?? 0) + 1);
  });

  return (
    <DashboardShell role="admin" title="Observer Platform">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Digital Observer Platform</p>
          <h1>תשתית multi-site לתצפיתן הדיגיטלי.</h1>
          <p>גן בטוח נשאר מוצר הגנים: 700 ש״ח לחודש לגן, כולל תצפיתן דיגיטלי. השכבה הזו היא Future standalone product לבתים, עסקים, מחסנים, משרדים וחניונים.</p>
        </div>
        <span className="pill warn">Future standalone product</span>
      </div>
      <AdminDataError message={result.error ?? data.queryError} />
      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><Building2 /><strong>{data.sites.length}</strong><span>Sites</span></article>
        <article className="metric-card"><Camera /><strong>{data.cameras.length}</strong><span>Cameras</span></article>
        <article className="metric-card"><ShieldCheck /><strong>{data.zones.length}</strong><span>Zones</span></article>
        <article className="metric-card"><Bot /><strong>{data.events.length}</strong><span>Events</span></article>
      </section>
      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2>Site types</h2><p>גני ילדים שייכים ל-Gan Batuach ותצפיתן דיגיטלי כלול בהם. סוגים אחרים הם מוצר עצמאי עתידי בלבד.</p></div>
          <div className="tag-cloud">{Object.entries(siteTypeCounts).map(([type, count]) => <span key={type}>{siteTypeLabel(type)}: {count}</span>)}</div>
          <div className="risk-list"><div>Active monitoring <b>{activeMonitoring}</b></div><div>Standalone product mode <b>Future only</b></div><div>Gan Batuach observer <b>Included</b></div></div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2>Future APIs</h2><p>אין public APIs בשלב הזה. אלו נקודות מוכנות לתכנון.</p></div>
          <div className="risk-list"><div>Site management <b>planned</b></div><div>Camera onboarding <b>planned</b></div><div>Monitoring status <b>planned</b></div><div>Event feeds <b>planned</b></div><div>Notification feeds <b>planned</b></div></div>
        </article>
      </section>
      <section className="dashboard-section">
        <div className="section-heading"><h2>Observer sites</h2><p>Tenant → Sites → Cameras → Zones → Events → Notifications.</p><Link className="button secondary" href="/dashboard/admin/ai-events">אירועי תצפיתן</Link></div>
        {data.sites.length === 0 ? <div className="empty-state"><strong>אין observer sites</strong><span>לאחר הרצת המיגרציה ייווצר site לכל גן קיים.</span></div> : <div className="procedure-list">{data.sites.map((site: any) => <article className="card procedure-card" key={site.id}><div><span className={site.active ? "pill good" : "pill bad"}>{site.active ? "active" : "inactive"}</span><span className="pill">{siteTypeLabel(site.site_type)}</span><h3>{site.name}</h3><p>{site.address || site.gardens?.city || "כתובת לא צוינה"}</p><small>timezone {site.timezone} · retention {site.event_retention_days} days</small></div><div className="procedure-meta"><span>מצלמות: {camerasBySite.get(site.id) ?? 0}</span><span>אירועים: {eventsBySite.get(site.id) ?? 0}</span><span className={site.monitoring_enabled ? "pill good" : "pill warn"}>{site.monitoring_enabled ? "monitoring on" : "monitoring off"}</span></div></article>)}</div>}
      </section>
    </DashboardShell>
  );
}
