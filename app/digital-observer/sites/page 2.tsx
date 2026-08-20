import Link from "next/link";
import { Building2, Camera, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { DIGITAL_OBSERVER_NAVIGATION } from "@/lib/domain/digital-observer-product";

export default function DigitalObserverSitesPage() {
  return (
    <>
      <BrandHeader />
      <main className="public-page digital-observer-app">
        <nav className="product-switcher" aria-label="Digital Observer sites navigation">
          <strong>Digital Observer</strong>
          <div>{DIGITAL_OBSERVER_NAVIGATION.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</div>
        </nav>
        <section className="dashboard-hero-card observer-dashboard-hero">
          <div><p className="eyebrow">Sites</p><h1>Observer site readiness.</h1><p>Create and manage home, business, office, warehouse, store, parking lot and custom monitored sites.</p></div>
          <Link className="button primary" href="/digital-observer/onboarding">Create site</Link>
        </section>
        <section className="grid cols-3 dashboard-panels">
          <article className="card action-panel"><Building2 /><h2>Site details</h2><p>Site type, address/city, owner and package readiness.</p></article>
          <article className="card action-panel"><Camera /><h2>Cameras</h2><p>Camera count, gateway readiness and secure playback readiness.</p></article>
          <article className="card action-panel"><ShieldCheck /><h2>Product boundary</h2><p>No child, parent, staff or kindergarten-only data belongs here.</p></article>
        </section>
      </main>
    </>
  );
}
