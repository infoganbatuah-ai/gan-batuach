import Link from "next/link";
import { Bell, CreditCard, Settings, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { DIGITAL_OBSERVER_NAVIGATION } from "@/lib/domain/digital-observer-product";

export default function DigitalObserverSettingsPage() {
  return (
    <>
      <BrandHeader />
      <main className="public-page digital-observer-app">
        <nav className="product-switcher" aria-label="Digital Observer settings navigation">
          <strong>Digital Observer</strong>
          <div>{DIGITAL_OBSERVER_NAVIGATION.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</div>
        </nav>
        <section className="dashboard-hero-card observer-dashboard-hero">
          <div><p className="eyebrow">Settings</p><h1>Digital Observer settings readiness.</h1><p>Product settings for alerts, billing, privacy, packages and support routing.</p></div>
          <Link className="button primary" href="/digital-observer/billing">Billing</Link>
        </section>
        <section className="grid cols-4 dashboard-panels">
          <article className="card action-panel"><Settings /><h2>Product mode</h2><p>Route-only by default until standalone flags are approved.</p></article>
          <article className="card action-panel"><Bell /><h2>Alert channels</h2><p>In-app, email, SMS, WhatsApp and push readiness.</p></article>
          <article className="card action-panel"><CreditCard /><h2>Billing</h2><p>Digital Observer subscriptions only.</p></article>
          <article className="card action-panel"><ShieldCheck /><h2>Privacy</h2><p>Site owner and camera controls stay separate from Gan Batuach.</p></article>
        </section>
      </main>
    </>
  );
}
