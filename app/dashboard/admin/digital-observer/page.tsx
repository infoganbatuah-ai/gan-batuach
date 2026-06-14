import Link from "next/link";
import { Bell, Camera, CreditCard, Gauge, ShieldCheck, TrendingUp } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";

export default async function AdminDigitalObserverOverviewPage() {
  await requireRole(["admin"]);

  return (
    <DashboardShell role="admin" title="Digital Observer">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Product context: Digital Observer</p>
          <h1>Digital Observer admin overview.</h1>
          <p>מרכז אדמיני נפרד לאתרי Observer, leads, subscriptions, packages, camera health, support, revenue readiness ו־launch status.</p>
        </div>
        <div className="hero-actions">
          <Link className="button primary" href="/dashboard/admin/digital-observer-production-setup">Production setup</Link>
          <Link className="button secondary" href="/dashboard/admin/digital-observer-paid-beta">Paid beta</Link>
        </div>
      </div>

      <section className="grid cols-3 dashboard-panels">
        <Link className="card action-panel" href="/dashboard/admin/digital-observer-leads"><TrendingUp /><h2>Leads</h2><p>Digital Observer lead queue and conversion readiness.</p></Link>
        <Link className="card action-panel" href="/dashboard/admin/observer-packages"><CreditCard /><h2>Packages</h2><p>Home and business package readiness.</p></Link>
        <Link className="card action-panel" href="/dashboard/admin/observer-billing"><CreditCard /><h2>Subscriptions</h2><p>Standalone observer billing, separate from Gan Batuach.</p></Link>
        <Link className="card action-panel" href="/dashboard/admin/camera-gateway"><Camera /><h2>Camera health</h2><p>Gateway and stream readiness.</p></Link>
        <Link className="card action-panel" href="/dashboard/admin/digital-observer-beta-analytics"><Bell /><h2>Alerts and beta analytics</h2><p>Alert value, support load and PMF signals.</p></Link>
        <Link className="card action-panel" href="/dashboard/admin/digital-observer-separation"><ShieldCheck /><h2>Launch status</h2><p>Separation decision and extraction readiness.</p></Link>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <Gauge />
          <h2>Product boundary</h2>
          <p>This admin view is for Digital Observer only. Kindergarten, parent, staff and inspector workflows stay in Gan Batuach dashboards.</p>
        </article>
        <article className="card action-panel">
          <ShieldCheck />
          <h2>Safety note</h2>
          <p>Do not enable separate domains, separate billing or separate Supabase until production setup gates are reviewed.</p>
        </article>
      </section>
    </DashboardShell>
  );
}
