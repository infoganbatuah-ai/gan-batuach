import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Bell, Camera, CheckCircle2, PackageCheck, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { DIGITAL_OBSERVER_PACKAGES, DIGITAL_OBSERVER_SAFE_COPY_RULES } from "@/lib/domain/digital-observer-product";

export const metadata: Metadata = {
  title: "Digital Observer Pricing – AI Camera Monitoring Packages",
  description: "Compare Digital Observer packages for homes, businesses, warehouses, offices, stores and parking lots. Pricing readiness only; production billing requires provider setup.",
  alternates: { canonical: "/digital-observer/pricing" },
  openGraph: {
    title: "Digital Observer Pricing",
    description: "Home, business and enterprise AI camera monitoring package readiness.",
    url: "/digital-observer/pricing"
  }
};

export default function DigitalObserverPricingPage() {
  return (
    <>
      <BrandHeader />
      <main className="public-page digital-observer-public">
        <section className="hero-section digital-observer-hero">
          <div className="hero-content">
            <p className="eyebrow">Digital Observer packages</p>
            <h1>Choose the monitoring package that fits your site.</h1>
            <p>Packages define camera limits, monitoring hours, retention readiness, alert channels and AI goals. Live billing stays off until a real provider mode is configured.</p>
            <div className="hero-actions">
              <Link className="button primary" href="/digital-observer/start?source=pricing">Start monitoring <ArrowLeft size={18} /></Link>
              <Link className="button secondary" href="/digital-observer/request-demo?source=pricing">Request demo</Link>
              <Link className="button secondary" href="/digital-observer/trust">Trust controls</Link>
            </div>
          </div>
          <div className="observer-live-card">
            <strong>Billing separation</strong>
            <span>Digital Observer customer → Digital Observer account</span>
            <span>Gan Batuach kindergarten billing remains separate</span>
            <span>Parent tuition never mixes here</span>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Packages</h2>
            <p>Prices are readiness values and can be finalized from the admin package center.</p>
          </div>
          <div className="grid cols-3 dashboard-panels">
            {DIGITAL_OBSERVER_PACKAGES.map((pkg) => (
              <article className="card action-panel" key={pkg.key}>
                <PackageCheck />
                <span className="pill">{pkg.type}</span>
                <h3>{pkg.name}</h3>
                <p>{pkg.cameras} cameras · {pkg.hours} · {pkg.retention}</p>
                <div className="setup-checklist">
                  <span><Camera size={14} /> {pkg.recordingRetention}</span>
                  <span><Bell size={14} /> {pkg.channels}</span>
                  <span><ShieldCheck size={14} /> human review required</span>
                </div>
                <div className="procedure-meta">
                  <strong>{pkg.monthlyPrice}</strong>
                  <span>{pkg.annualPrice}</span>
                </div>
                <div className="hero-actions">
                  <Link className="button primary" href={`/digital-observer/start?package=${pkg.key}&source=pricing`}>Choose package</Link>
                  <Link className="button secondary" href={`/digital-observer/request-demo?package=${pkg.key}&source=pricing`}>Ask about it</Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <CheckCircle2 />
            <h2>What is included</h2>
            <div className="risk-list">
              <div>Camera health readiness <b>included</b></div>
              <div>Monitoring schedule <b>included</b></div>
              <div>Alert channel readiness <b>included</b></div>
              <div>Package limits <b>prepared</b></div>
              <div>Real payment charging <b>provider-gated</b></div>
            </div>
          </article>
          <article className="card action-panel">
            <ShieldCheck />
            <h2>Copy guardrails</h2>
            <div className="risk-list">
              {DIGITAL_OBSERVER_SAFE_COPY_RULES.slice(0, 5).map((rule) => (
                <div key={rule.avoid}>{rule.avoid} <b>{rule.use}</b></div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </>
  );
}
