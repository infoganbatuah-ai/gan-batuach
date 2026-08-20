import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Bell, Camera, Clock, PackageCheck, Radar, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { requireUser } from "@/lib/auth";
import { logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, any>;
type PageProps = {
  params: Promise<{ id: string }>;
};

async function safeSingle<T>(label: string, run: () => any) {
  try {
    const result = (await run()) as { data: T | null; error: any };
    logSupabaseError(label, result.error);
    return result.error ? null : result.data;
  } catch (error) {
    logSupabaseError(label, error);
    return null;
  }
}

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

function statusClass(status?: string | null) {
  if (["active", "online", "healthy", "confirmed", "ready"].includes(String(status))) return "pill good";
  if (["trial", "needs_review", "degraded", "reviewing", "pending"].includes(String(status))) return "pill warn";
  return "pill";
}

export default async function DigitalObserverSiteDashboardPage({ params }: PageProps) {
  const { id } = await params;
  const { profile } = await requireUser();
  const supabase = await createClient();

  const site = await safeSingle<Row>("digital observer site", () =>
    supabase
      .from("observer_sites" as any)
      .select("id, name, site_type, active, monitoring_enabled, observer_subscription_status, camera_limit, event_retention_days, owner_profile_id, created_at")
      .eq("id", id)
      .neq("site_type", "kindergarten")
      .maybeSingle()
  );
  if (!site) notFound();

  const isOwner = site.owner_profile_id === profile.id;
  const membership = isOwner ? { member_role: "owner" } : await safeSingle<Row>("digital observer site membership", () =>
    supabase
      .from("observer_site_memberships" as any)
      .select("member_role")
      .eq("observer_site_id", id)
      .eq("profile_id", profile.id)
      .eq("active", true)
      .maybeSingle()
  );
  if (!membership) notFound();

  const [cameras, signals, subscription, usage] = await Promise.all([
    safeQuery<Row>("digital observer site cameras", () => supabase.from("camera_streams" as any).select("id, name, status, ai_enabled, parent_visible").eq("observer_site_id", id).limit(80)),
    safeQuery<Row>("digital observer site signals", () => supabase.from("observer_intelligence_signals" as any).select("id, signal_type, severity, review_status, risk_score, recommended_action, created_at").eq("observer_site_id", id).order("created_at", { ascending: false }).limit(40)),
    safeSingle<Row>("digital observer site subscription", () => supabase.from("observer_site_subscriptions" as any).select("id, status, renewal_date, package_id, timezone").eq("observer_site_id", id).maybeSingle()),
    safeQuery<Row>("digital observer site usage", () => supabase.from("observer_site_usage_snapshots" as any).select("active_cameras, ai_events_count, playback_sessions, period_start, period_end").eq("observer_site_id", id).order("period_start", { ascending: false }).limit(5))
  ]);

  const openSignals = signals.filter((signal) => ["needs_review", "reviewing", "escalated"].includes(String(signal.review_status)));
  const latestUsage = usage[0] ?? {};

  return (
    <>
      <BrandHeader />
      <main className="public-page digital-observer-app">
        <section className="dashboard-hero-card observer-dashboard-hero">
          <div>
            <p className="eyebrow">Digital Observer Site</p>
            <h1>{site.name}</h1>
            <p>{site.site_type} site dashboard. No children, parents, staff, inspectors or kindergarten compliance flows are shown here.</p>
          </div>
          <div className="hero-actions">
            <Link className="button primary" href="/digital-observer/onboarding">Add camera</Link>
            <Link className="button secondary" href="/digital-observer/dashboard">All sites</Link>
          </div>
        </section>

        <section className="grid cols-4 dashboard-panels">
          <article className="metric-card"><Camera /><strong>{cameras.length}</strong><span>connected cameras</span></article>
          <article className="metric-card"><Bell /><strong>{openSignals.length}</strong><span>active alerts</span></article>
          <article className="metric-card"><ShieldCheck /><strong>{site.monitoring_enabled ? "enabled" : "setup"}</strong><span>monitoring</span></article>
          <article className="metric-card"><PackageCheck /><strong>{subscription?.status ?? site.observer_subscription_status ?? "trial"}</strong><span>package status</span></article>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel" id="cameras">
            <Camera />
            <h2>Cameras</h2>
            <div className="procedure-list compact-list">
              {cameras.length === 0 ? <p>No cameras connected yet.</p> : cameras.map((camera) => (
                <div className="mini-row" key={camera.id}>
                  <span>{camera.name ?? "Camera"}</span>
                  <strong><span className={statusClass(camera.status)}>{camera.status ?? "unknown"}</span></strong>
                  <small>{camera.ai_enabled ? "AI readiness enabled" : "AI readiness off"} · credentials never shown</small>
                </div>
              ))}
            </div>
          </article>

          <article className="card action-panel" id="alerts">
            <Radar />
            <h2>Recent events</h2>
            <div className="procedure-list compact-list">
              {signals.length === 0 ? <p>No observer events yet.</p> : signals.map((signal) => (
                <div className="mini-row" key={signal.id}>
                  <span>{signal.signal_type}</span>
                  <strong><span className={statusClass(signal.review_status)}>{signal.review_status}</span></strong>
                  <small>{signal.recommended_action ?? "Review recommended"} · risk {signal.risk_score ?? 0}/100</small>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid cols-3 dashboard-panels">
          <article className="card compact-card"><Clock /><h3>Monitoring schedule</h3><p>Business hours, night monitoring and alert rules are package and policy gated.</p></article>
          <article className="card compact-card"><AlertTriangle /><h3>Recommended actions</h3><p>Open alerts require review before operational action.</p></article>
          <article className="card compact-card"><ShieldCheck /><h3>Site health</h3><p>{latestUsage.active_cameras ?? 0} active cameras · {latestUsage.ai_events_count ?? 0} events · {latestUsage.playback_sessions ?? 0} playback sessions.</p></article>
        </section>
      </main>
    </>
  );
}
