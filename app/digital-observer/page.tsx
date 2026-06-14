import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Bell, Camera, Eye, GitBranch, LockKeyhole, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import {
  DIGITAL_OBSERVER_AI_GOALS,
  DIGITAL_OBSERVER_DOMAIN_OPTIONS,
  DIGITAL_OBSERVER_PACKAGES,
  DIGITAL_OBSERVER_PRODUCT_BOUNDARIES,
  DIGITAL_OBSERVER_SHARED_CORE,
  DIGITAL_OBSERVER_SITE_TYPES
} from "@/lib/domain/digital-observer-product";

export const metadata: Metadata = {
  title: "Digital Observer – AI Camera Monitoring Platform",
  description: "AI-powered digital observer for homes, businesses and organizations. A standalone product shell that reuses Gan Batuach observer core infrastructure without kindergarten-specific flows.",
  alternates: { canonical: "/digital-observer" },
  openGraph: {
    title: "Digital Observer – AI Camera Monitoring Platform",
    description: "AI-powered digital observer for homes, businesses and organizations.",
    url: "/digital-observer"
  }
};

export default function DigitalObserverPublicPage() {
  return (
    <>
      <BrandHeader />
      <main className="public-page digital-observer-public">
        <section className="hero-section digital-observer-hero">
          <div className="hero-content">
            <p className="eyebrow">Digital Observer</p>
            <h1>AI-powered digital observer for homes, businesses and organizations.</h1>
            <p>
              A standalone monitoring product surface for cameras, alerts, site health and human-reviewed observer intelligence.
              Kindergarten deployments stay inside Gan Batuach and remain governed by Israeli regulatory mode.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/digital-observer/onboarding">Start monitoring <ArrowLeft size={18} /></Link>
              <Link className="button secondary" href="/digital-observer/dashboard">Open dashboard</Link>
            </div>
          </div>
          <div className="observer-visual-panel" aria-label="Digital Observer product signals">
            <div className="observer-signal-map">
              <span className="signal-node active"><Camera size={18} /> Gateway</span>
              <span className="signal-node"><Radar size={18} /> Motion</span>
              <span className="signal-node"><Eye size={18} /> Review</span>
              <span className="signal-node active"><Bell size={18} /> Alerts</span>
            </div>
            <div className="observer-live-card">
              <strong>Site Health</strong>
              <span>8 cameras ready</span>
              <span>3 goals monitored</span>
              <span>0 automatic decisions</span>
            </div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Built for multiple verticals</h2>
            <p>Digital Observer is product-ready for standalone sites while Gan Batuach remains the regulated kindergarten implementation.</p>
          </div>
          <div className="grid cols-4 dashboard-panels">
            {DIGITAL_OBSERVER_SITE_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <article className="card action-panel" key={type.key}>
                  <Icon />
                  <h3>{type.label}</h3>
                  <p>{type.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Observer core, not duplicate code</h2>
            <p>The product shell reuses the existing camera, AI, observer, audit, workflow and analytics infrastructure.</p>
          </div>
          <div className="grid cols-4 dashboard-panels">
            {DIGITAL_OBSERVER_SHARED_CORE.slice(0, 8).map((item) => (
              <article className="card compact-card" key={item.table}>
                <GitBranch />
                <h3>{item.name}</h3>
                <p>{item.note}</p>
                <span className="pill">{item.table}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Packages readiness</h2>
            <p>Billing is not activated here. Packages define limits, retention, monitoring hours and alert readiness.</p>
          </div>
          <div className="procedure-list">
            {DIGITAL_OBSERVER_PACKAGES.map((pkg) => (
              <article className="card procedure-card" key={pkg.key}>
                <div>
                  <span className="pill">{pkg.type}</span>
                  <h3>{pkg.name}</h3>
                  <p>{pkg.cameras} cameras · {pkg.hours} · {pkg.retention}</p>
                  <small>{pkg.ai.join(" · ")} · {pkg.channels}</small>
                </div>
                <strong>{pkg.price}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <ShieldCheck />
            <h2>Product separation</h2>
            <p>Gan Batuach keeps child, parent, staff, inspector and Israeli kindergarten compliance flows. Digital Observer keeps standalone observer sites, cameras, owners, members, packages and monitoring goals.</p>
            <div className="setup-checklist">
              {DIGITAL_OBSERVER_PRODUCT_BOUNDARIES.digitalObserver.map((item) => <span key={item}>{item}</span>)}
            </div>
          </article>
          <article className="card action-panel">
            <LockKeyhole />
            <h2>Policy gated capabilities</h2>
            <p>Capabilities remain controlled per vertical: enabled, disabled, legal review required, consent required or future only.</p>
            <div className="setup-checklist">
              {DIGITAL_OBSERVER_AI_GOALS.map((goal) => <span key={goal}>{goal}</span>)}
            </div>
          </article>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Domain readiness</h2>
            <p>Current route works inside this project. Future domains require manual Vercel and DNS setup.</p>
          </div>
          <div className="grid cols-4 dashboard-panels">
            <article className="card compact-card"><BadgeCheck /><h3>Now</h3><p>gan-batuach.vercel.app/digital-observer</p></article>
            {DIGITAL_OBSERVER_DOMAIN_OPTIONS.map((domain) => (
              <article className="card compact-card" key={domain}><Sparkles /><h3>Future</h3><p>{domain}</p></article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
