import Link from "next/link";
import { Bell, Camera, CheckCircle2, ClipboardCheck, Eye, LockKeyhole, MapPin, PackageCheck, Radar, Settings2, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { DIGITAL_OBSERVER_AI_GOALS, DIGITAL_OBSERVER_NAVIGATION, DIGITAL_OBSERVER_PACKAGES, DIGITAL_OBSERVER_SITE_OWNER_JOURNEY, DIGITAL_OBSERVER_SITE_TYPES } from "@/lib/domain/digital-observer-product";

const cameraTypes = ["home camera", "business DVR/NVR", "RTSP", "ONVIF", "generic camera", "Hikvision", "Dahua"];
const onboardingSteps = [
  { title: "Choose site type", text: "Home, office, business, warehouse, store, parking lot, future school or custom.", icon: MapPin },
  { title: "Add site details", text: "Name, address, timezone, owner and estimated camera count.", icon: ClipboardCheck },
  { title: "Choose package", text: "Set camera limits, monitoring hours, retention and alert channels.", icon: PackageCheck },
  { title: "Add camera source", text: "Connect through gateway readiness only. RTSP and credentials stay server-side.", icon: Camera },
  { title: "Configure observer goals", text: "Select what should be watched and keep human review enabled.", icon: Radar },
  { title: "Configure alert channels", text: "Choose in-app, email, SMS, WhatsApp or push readiness through provider safety modes.", icon: Bell },
  { title: "Review privacy settings", text: "Capabilities are gated per vertical and legal review status.", icon: LockKeyhole },
  { title: "Activate test mode", text: "Run in controlled test mode before production monitoring.", icon: ShieldCheck }
];

export default function DigitalObserverOnboardingPage() {
  return (
    <>
      <BrandHeader />
      <main className="public-page digital-observer-app">
        <nav className="product-switcher" aria-label="Digital Observer onboarding navigation">
          <strong>Digital Observer</strong>
          <div>
            {DIGITAL_OBSERVER_NAVIGATION.slice(0, 7).map((item) => (
              <Link key={item.href} href={item.href}>{item.label}</Link>
            ))}
          </div>
        </nav>

        <section className="dashboard-hero-card observer-dashboard-hero">
          <div>
            <p className="eyebrow">Digital Observer Onboarding</p>
            <h1>Create a standalone observer site.</h1>
            <p>This flow is for homes, businesses and organizations. Kindergarten activation remains inside Gan Batuach and uses its own regulatory onboarding.</p>
          </div>
          <span className="pill warn">test mode first</span>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Eight-step setup flow</h2>
            <p>Prepared as shell readiness. No real billing, DNS or camera activation happens automatically.</p>
          </div>
          <div className="timeline-list">
            {onboardingSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <article className="card timeline-card" key={step.title}>
                  <span className="pill">{index + 1}</span>
                  <Icon />
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Site owner journey</h2>
            <p>A commercial path for Digital Observer customers, separate from Gan Batuach manager onboarding.</p>
          </div>
          <div className="setup-checklist">
            {DIGITAL_OBSERVER_SITE_OWNER_JOURNEY.map((step) => <span key={step}>{step}</span>)}
          </div>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel" id="settings">
            <div className="section-heading"><h2>Site details</h2><p>Standalone observer site draft. Not a Gan Batuach kindergarten.</p></div>
            <div className="form-grid compact-form">
              <label className="form-field"><span>Site name</span><input placeholder="Example: Herzl Street Office" disabled /></label>
              <label className="form-field"><span>Site type</span><select disabled>{DIGITAL_OBSERVER_SITE_TYPES.filter((type) => !type.key.includes("future")).map((type) => <option key={type.key}>{type.label}</option>)}</select></label>
              <label className="form-field full"><span>Address</span><input placeholder="City, street, number" disabled /></label>
              <label className="form-field"><span>Timezone</span><input value="Asia/Jerusalem" disabled readOnly /></label>
              <label className="form-field"><span>Estimated cameras</span><input placeholder="4" disabled /></label>
              <label className="form-field"><span>Mode</span><input value="test_mode" disabled readOnly /></label>
            </div>
          </article>

          <article className="card action-panel" id="cameras">
            <div className="section-heading"><h2>Camera source</h2><p>All camera traffic goes through the gateway layer. No direct RTSP in browser.</p></div>
            <div className="setup-checklist">
              {cameraTypes.map((type) => <span key={type}>{type}</span>)}
            </div>
            <div className="procedure-list">
              <div className="procedure-card"><Camera /><div><h3>Gateway registration</h3><p>Build candidate server-side, test gateway health, register source, then issue scoped playback token.</p></div></div>
              <div className="procedure-card"><LockKeyhole /><div><h3>Credential boundary</h3><p>Camera usernames, passwords and RTSP paths are masked and never returned to the client.</p></div></div>
            </div>
          </article>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel" id="packages">
            <div className="section-heading"><h2>Package selection</h2><p>Pricing and real billing remain provider-gated readiness.</p></div>
            <div className="procedure-list compact-list">
              {DIGITAL_OBSERVER_PACKAGES.map((pkg) => (
                <div className="mini-row" key={pkg.key}>
                  <span>{pkg.name}</span>
                  <strong>{pkg.cameras}</strong>
                  <small>{pkg.hours} · {pkg.retention} · {pkg.monthlyPrice}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="card action-panel" id="goals">
            <div className="section-heading"><h2>Observer goals</h2><p>Site owners choose goals; policy decides which capabilities can run.</p></div>
            <div className="setup-checklist">
              {DIGITAL_OBSERVER_AI_GOALS.map((goal) => <span key={goal}>{goal}</span>)}
            </div>
            <div className="procedure-list">
              <div className="procedure-card"><Eye /><div><h3>Human review</h3><p>Observer may recommend; it does not accuse, discipline or trigger irreversible actions automatically.</p></div></div>
              <div className="procedure-card"><Bell /><div><h3>Alert channels</h3><p>Email, SMS, WhatsApp and push readiness use existing provider safety modes.</p></div></div>
            </div>
          </article>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Activation gate</h2>
            <p>Before production monitoring, the site must pass privacy, capability, camera and subscription checks.</p>
          </div>
          <div className="grid cols-4 dashboard-panels">
            <article className="card compact-card"><CheckCircle2 /><h3>Test mode</h3><p>Default activation starts in controlled test mode.</p></article>
            <article className="card compact-card"><Settings2 /><h3>Capability matrix</h3><p>Enabled, disabled, legal review, consent or future only.</p></article>
            <article className="card compact-card"><ShieldCheck /><h3>Privacy settings</h3><p>No kindergarten child/parent flows in standalone observer sites.</p></article>
            <article className="card compact-card"><PackageCheck /><h3>Subscription readiness</h3><p>Real billing requires provider configuration and admin approval.</p></article>
          </div>
          <div className="hero-actions">
            <Link className="button primary" href="/digital-observer/dashboard">Open dashboard shell</Link>
            <Link className="button secondary" href="/digital-observer">Back to Digital Observer</Link>
          </div>
        </section>
      </main>
    </>
  );
}
