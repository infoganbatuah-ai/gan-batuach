import Link from "next/link";
import { Bell, ShieldCheck, UserCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { DIGITAL_OBSERVER_NAVIGATION } from "@/lib/domain/digital-observer-product";

export default function DigitalObserverAlertsPage() {
  return (
    <>
      <BrandHeader />
      <main className="public-page digital-observer-app">
        <nav className="product-switcher" aria-label="Digital Observer alerts navigation">
          <strong>Digital Observer</strong>
          <div>{DIGITAL_OBSERVER_NAVIGATION.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</div>
        </nav>
        <section className="dashboard-hero-card observer-dashboard-hero">
          <div><p className="eyebrow">Alerts</p><h1>Review-first observer alerts.</h1><p>Alert readiness for camera offline, motion after hours, restricted area, obstruction and unusual activity.</p></div>
          <Link className="button primary" href="/digital-observer/dashboard">Open dashboard</Link>
        </section>
        <section className="grid cols-3 dashboard-panels">
          <article className="card action-panel"><Bell /><h2>Configured goals</h2><p>Only enabled monitoring goals should generate alerts.</p></article>
          <article className="card action-panel"><UserCheck /><h2>Human review</h2><p>No automatic accusations, enforcement or emergency actions.</p></article>
          <article className="card action-panel"><ShieldCheck /><h2>Capability gated</h2><p>Sensitive capabilities stay disabled or legal-review-required until approved.</p></article>
        </section>
      </main>
    </>
  );
}
