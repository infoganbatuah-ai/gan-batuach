import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Bell, Camera, PackageCheck, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { DIGITAL_OBSERVER_AI_GOALS, DIGITAL_OBSERVER_PACKAGES, DIGITAL_OBSERVER_SITE_TYPES } from "@/lib/domain/digital-observer-product";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Start Digital Observer Monitoring",
  description: "Start the Digital Observer standalone onboarding flow for homes, offices, businesses, warehouses, stores, parking lots and custom monitored sites.",
  alternates: { canonical: "/digital-observer/start" },
  openGraph: {
    title: "Start Digital Observer Monitoring",
    description: "Choose a site type, package and monitoring goals before entering onboarding.",
    url: "/digital-observer/start"
  }
};

function pick(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DigitalObserverStartPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const submitted = pick(params.submitted) === "1";
  const siteType = pick(params.site_type) ?? "home";
  const packageInterest = pick(params.package) ?? "home_basic";

  return (
    <>
      <BrandHeader />
      <main className="public-page digital-observer-public">
        <section className="hero-section digital-observer-hero">
          <div className="hero-content">
            <p className="eyebrow">Start monitoring</p>
            <h1>Create a standalone Digital Observer site.</h1>
            <p>Choose your site type, package and monitoring goals. If account creation is not active yet, this creates a Digital Observer lead and sends you to the onboarding readiness flow.</p>
          </div>
          <div className="observer-live-card">
            <strong>Self-service journey</strong>
            <span>Choose site type</span>
            <span>Choose package</span>
            <span>Add site and cameras</span>
            <span>Activate test mode</span>
          </div>
        </section>

        {submitted ? (
          <section className="dashboard-section">
            <div className="empty-state">
              <strong>Start request saved.</strong>
              <span>A Digital Observer lead was created. Continue to onboarding readiness or wait for admin follow-up.</span>
              <div className="hero-actions">
                <Link className="button primary" href="/digital-observer/onboarding">Continue to onboarding</Link>
                <Link className="button secondary" href="/digital-observer/dashboard">Open dashboard shell</Link>
              </div>
            </div>
          </section>
        ) : (
          <form className="dashboard-section card action-panel" action="/api/digital-observer/leads" method="post">
            <input type="hidden" name="source" value="digital_observer_start" />
            <input type="hidden" name="redirect_to" value="/digital-observer/start" />
            <input type="hidden" name="form_route" value="/digital-observer/start" />
            {["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].map((key) => (
              <input key={key} type="hidden" name={key} value={pick(params[key]) ?? ""} />
            ))}
            <div className="section-heading">
              <h2>Site owner journey</h2>
              <p>This is standalone Digital Observer onboarding, not Gan Batuach kindergarten onboarding.</p>
            </div>
            <div className="grid cols-3 dashboard-panels">
              <label>What do you want to monitor?
                <select name="site_type" defaultValue={siteType}>
                  {DIGITAL_OBSERVER_SITE_TYPES.filter((item) => !item.key.includes("future")).map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label>Choose package
                <select name="package_interest" defaultValue={packageInterest}>
                  {DIGITAL_OBSERVER_PACKAGES.map((pkg) => <option key={pkg.key} value={pkg.key}>{pkg.name}</option>)}
                </select>
              </label>
              <label>Camera count<input name="camera_count" type="number" min="0" placeholder="4" /></label>
              <label>Full name<input name="contact_name" required placeholder="Site owner" /></label>
              <label>Phone<input name="phone" required placeholder="050-0000000" /></label>
              <label>Email<input name="email" type="email" placeholder="name@example.com" /></label>
              <label>Site / business name<input name="business_name" placeholder="My site" /></label>
              <label>City<input name="city" placeholder="City" /></label>
              <label>Preferred contact
                <select name="preferred_contact_method" defaultValue="whatsapp">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="phone">Phone</option>
                  <option value="email">Email</option>
                  <option value="any">Any</option>
                </select>
              </label>
            </div>
            <div className="section-heading">
              <h2>Monitoring goals</h2>
              <p>These goals stay capability-gated. Sensitive capabilities are not enabled automatically.</p>
            </div>
            <div className="setup-checklist">
              {DIGITAL_OBSERVER_AI_GOALS.map((goal) => (
                <label key={goal}><input type="checkbox" name="monitoring_goals" value={goal} /> {goal}</label>
              ))}
            </div>
            <div className="grid cols-3 dashboard-panels">
              <article className="card compact-card"><Camera /><h3>Add cameras</h3><p>RTSP, DVR/NVR, ONVIF and demo camera readiness.</p></article>
              <article className="card compact-card"><Bell /><h3>Configure alerts</h3><p>In-app, email, SMS, WhatsApp and push readiness.</p></article>
              <article className="card compact-card"><ShieldCheck /><h3>Privacy settings</h3><p>Control who can view events, alerts and cameras.</p></article>
            </div>
            <button className="button primary" type="submit">Start setup <ArrowLeft size={18} /></button>
          </form>
        )}
      </main>
    </>
  );
}
