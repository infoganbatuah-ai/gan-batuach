import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Eye, LockKeyhole, Radar, ShieldCheck, UserCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { DIGITAL_OBSERVER_SAFE_COPY_RULES } from "@/lib/domain/digital-observer-product";

export const metadata: Metadata = {
  title: "Digital Observer Trust & Privacy",
  description: "Digital Observer trust, privacy and control readiness: secure camera tokens, audit logs, permissions, data separation and ISO readiness.",
  alternates: { canonical: "/digital-observer/trust" },
  openGraph: {
    title: "Digital Observer Trust & Privacy",
    description: "Privacy controls, secure camera access and audit readiness for Digital Observer.",
    url: "/digital-observer/trust"
  }
};

export default function DigitalObserverTrustPage() {
  return (
    <>
      <BrandHeader />
      <main className="public-page digital-observer-public">
        <section className="hero-section digital-observer-hero">
          <div className="hero-content">
            <p className="eyebrow">Trust and privacy</p>
            <h1>Monitoring with control, separation and review.</h1>
            <p>Digital Observer is prepared with camera access controls, short-lived tokens, audit logs, user permissions and ISO readiness language. It does not claim certification until external certification exists.</p>
            <div className="hero-actions">
              <Link className="button primary" href="/digital-observer/request-demo?source=trust">Request demo</Link>
              <Link className="button secondary" href="/digital-observer/pricing">Packages</Link>
            </div>
          </div>
          <div className="observer-live-card">
            <strong>Trust copy</strong>
            <span>ISO readiness, not ISO certified</span>
            <span>secure tokens, not public camera URLs</span>
            <span>review support, not automatic conclusions</span>
          </div>
        </section>

        <section className="grid cols-3 dashboard-panels">
          <article className="card action-panel"><LockKeyhole /><h2>Camera access controls</h2><p>Playback should use scoped, short-lived tokens. RTSP URLs and credentials stay out of the browser.</p></article>
          <article className="card action-panel"><UserCheck /><h2>User permissions</h2><p>Site owners, admins, viewers and reviewers receive scoped access. Gan Batuach parent and child flows stay separate.</p></article>
          <article className="card action-panel"><Eye /><h2>Audit logs</h2><p>Viewing, configuration and sensitive actions are designed to be logged for review.</p></article>
          <article className="card action-panel"><Radar /><h2>Capability policy</h2><p>Face, audio, gait and other sensitive capabilities are not marketed as active unless approved for a vertical.</p></article>
          <article className="card action-panel"><ShieldCheck /><h2>Data separation</h2><p>Standalone observer sites use observer_site_id and do not create kindergarten, child or parent records.</p></article>
          <article className="card action-panel"><BadgeCheck /><h2>ISO readiness</h2><p>The platform can show ISO readiness evidence, but must not claim ISO certification without an external certificate.</p></article>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Safe wording</h2>
            <p>Public copy avoids exaggerated security or AI claims.</p>
          </div>
          <div className="risk-list">
            {DIGITAL_OBSERVER_SAFE_COPY_RULES.map((rule) => (
              <div key={rule.avoid}>Avoid "{rule.avoid}" <b>Use "{rule.use}"</b></div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
