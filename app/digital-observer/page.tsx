import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Bell, Camera, Eye, GitBranch, HelpCircle, LockKeyhole, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import {
  DIGITAL_OBSERVER_AI_GOALS,
  DIGITAL_OBSERVER_DOMAIN_OPTIONS,
  DIGITAL_OBSERVER_NAVIGATION,
  DIGITAL_OBSERVER_PACKAGES,
  DIGITAL_OBSERVER_PRODUCT_BOUNDARIES,
  DIGITAL_OBSERVER_PUBLIC_SECTIONS,
  DIGITAL_OBSERVER_SHARED_CORE,
  DIGITAL_OBSERVER_SITE_TYPES,
  DIGITAL_OBSERVER_USE_CASES
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
        <nav className="product-switcher" aria-label="Digital Observer navigation">
          <strong>Digital Observer</strong>
          <div>
            {DIGITAL_OBSERVER_NAVIGATION.slice(0, 6).map((item) => (
              <Link key={item.href} href={item.href}>{item.label}</Link>
            ))}
          </div>
        </nav>

        <section className="hero-section digital-observer-hero">
          <div className="hero-content">
            <p className="eyebrow">Digital Observer</p>
            <h1>Digital Observer – AI Camera Monitoring for homes, businesses and organizations.</h1>
            <p>
              Connect cameras, monitor sites and receive intelligent alerts for homes, offices, warehouses, stores, parking lots and custom sites.
              Digital Observer helps monitor unusual activity and supports review without making automatic accusations or unsupported safety claims.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/digital-observer/onboarding">Start monitoring <ArrowLeft size={18} /></Link>
              <Link className="button secondary" href="/digital-observer/dashboard">Open dashboard</Link>
              <Link className="button secondary" href="/book-demo?product=digital_observer">Request demo</Link>
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
              <span>test mode first</span>
            </div>
          </div>
        </section>

        <section className="dashboard-section" id="use-cases">
          <div className="section-heading">
            <h2>Use cases</h2>
            <p>Digital Observer is product-ready for standalone monitored sites. Kindergarten deployments remain in Gan Batuach.</p>
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
            <h2>Standalone use-case pages</h2>
            <p>Reusable pages are ready for product-specific SEO and sales content.</p>
          </div>
          <div className="procedure-list">
            {DIGITAL_OBSERVER_USE_CASES.map((useCase) => (
              <article className="card procedure-card" key={useCase.key}>
                <div>
                  <span className="pill">{useCase.audience}</span>
                  <h3>{useCase.title}</h3>
                  <p>{useCase.solution}</p>
                  <small>{useCase.cameraSetup} · {useCase.packageSuggestion}</small>
                </div>
                <Link className="button secondary" href={useCase.path}>View</Link>
              </article>
            ))}
          </div>
        </section>

        <section className="dashboard-section" id="how-it-works">
          <div className="section-heading">
            <h2>How it works</h2>
            <p>One product flow for standalone monitoring, still reusing the existing observer core.</p>
          </div>
          <div className="grid cols-4 dashboard-panels">
            {DIGITAL_OBSERVER_PUBLIC_SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <article className="card compact-card" key={section.title}>
                  <Icon />
                  <h3>{section.title}</h3>
                  <p>{section.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="dashboard-section" id="camera-connection">
          <div className="section-heading">
            <h2>Camera connection</h2>
            <p>Digital Observer supports real-world camera readiness while keeping credentials and RTSP server-side.</p>
          </div>
          <div className="grid cols-3 dashboard-panels">
            <article className="card compact-card"><Camera /><h3>Home cameras</h3><p>Private camera setup through gateway readiness and test mode.</p></article>
            <article className="card compact-card"><Camera /><h3>Business DVR/NVR</h3><p>Hikvision, Dahua, RTSP and ONVIF readiness without browser exposure.</p></article>
            <article className="card compact-card"><LockKeyhole /><h3>Secure playback</h3><p>Short-lived, scoped playback tokens and audit logs remain part of the shared camera infrastructure.</p></article>
          </div>
        </section>

        <section className="dashboard-section" id="ai-monitoring">
          <div className="section-heading">
            <h2>AI monitoring</h2>
            <p>Monitoring goals stay generic and policy-gated. The system helps monitor and alert; it does not guarantee outcomes.</p>
          </div>
          <div className="setup-checklist">
            {DIGITAL_OBSERVER_AI_GOALS.map((goal) => <span key={goal}>{goal}</span>)}
          </div>
        </section>

        <section className="dashboard-section" id="core">
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

        <section className="dashboard-section" id="packages">
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

        <section className="dashboard-section" id="faq">
          <div className="section-heading">
            <h2>FAQ</h2>
            <p>Launch copy uses careful wording and avoids unsupported claims.</p>
          </div>
          <div className="grid cols-2 dashboard-panels">
            <article className="card action-panel"><HelpCircle /><h3>Does it replace security personnel?</h3><p>No. Digital Observer improves visibility and supports review. It does not replace professional judgment or emergency procedures.</p></article>
            <article className="card action-panel"><HelpCircle /><h3>Can it use existing cameras?</h3><p>Yes, through gateway readiness for DVR/NVR, RTSP, ONVIF and generic cameras. Credentials are not exposed in the browser.</p></article>
            <article className="card action-panel"><HelpCircle /><h3>Are sensitive capabilities enabled by default?</h3><p>No. Capability status is controlled per vertical as allowed, disabled, restricted, legal review required, consent required or future only.</p></article>
            <article className="card action-panel"><HelpCircle /><h3>Is this Gan Batuach?</h3><p>No. Gan Batuach remains the kindergarten product. Digital Observer is the standalone monitoring product shell.</p></article>
          </div>
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

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Start with test mode</h2>
            <p>Standalone launch readiness is prepared without activating production billing, DNS or restricted capabilities automatically.</p>
          </div>
          <div className="hero-actions">
            <Link className="button primary" href="/digital-observer/onboarding">Create observer site</Link>
            <Link className="button secondary" href="/book-demo?product=digital_observer">Request demo</Link>
            <Link className="button secondary" href="/digital-observer/dashboard">Open app shell</Link>
          </div>
        </section>
      </main>
    </>
  );
}
