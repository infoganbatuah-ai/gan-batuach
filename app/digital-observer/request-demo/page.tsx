import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Bell, Camera, Mail, Phone, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { DIGITAL_OBSERVER_PACKAGES, DIGITAL_OBSERVER_SITE_TYPES } from "@/lib/domain/digital-observer-product";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Request a Digital Observer Demo",
  description: "Request a Digital Observer demo for a home, business, office, warehouse, store, parking lot or custom monitored site.",
  alternates: { canonical: "/digital-observer/request-demo" },
  openGraph: {
    title: "Request a Digital Observer Demo",
    description: "AI-powered camera monitoring demo request for homes and businesses.",
    url: "/digital-observer/request-demo"
  }
};

function pick(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DigitalObserverRequestDemoPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {};
  const submitted = pick(params.submitted) === "1";
  const siteType = pick(params.site_type) ?? "business";
  const packageInterest = pick(params.package) ?? "";

  return (
    <>
      <BrandHeader />
      <main className="public-page digital-observer-public">
        <section className="hero-section digital-observer-hero">
          <div className="hero-content">
            <p className="eyebrow">Request demo</p>
            <h1>See how Digital Observer can monitor your site.</h1>
            <p>Tell us about your cameras and monitoring goals. We will keep the flow separate from Gan Batuach kindergarten onboarding.</p>
          </div>
          <div className="observer-live-card">
            <strong>Lead source</strong>
            <span>product_type: digital_observer</span>
            <span>source: digital_observer_demo</span>
            <span>no kindergarten records created</span>
          </div>
        </section>

        {submitted ? (
          <section className="dashboard-section">
            <div className="empty-state">
              <strong>Demo request received.</strong>
              <span>We created a Digital Observer lead and marked it for admin follow-up. Production sending remains provider-gated.</span>
              <div className="hero-actions">
                <Link className="button primary" href="/digital-observer">Back to Digital Observer</Link>
                <Link className="button secondary" href="/digital-observer/pricing">Compare packages</Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="grid cols-2 dashboard-panels">
            <form className="card action-panel" action="/api/digital-observer/leads" method="post">
              <input type="hidden" name="source" value="digital_observer_demo" />
              <input type="hidden" name="redirect_to" value="/digital-observer/request-demo" />
              <input type="hidden" name="form_route" value="/digital-observer/request-demo" />
              {["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].map((key) => (
                <input key={key} type="hidden" name={key} value={pick(params[key]) ?? ""} />
              ))}
              <h2>Demo details</h2>
              <label>Full name<input name="contact_name" required placeholder="Daniel Cohen" /></label>
              <label>Phone<input name="phone" required placeholder="050-0000000" /></label>
              <label>Email<input name="email" type="email" placeholder="name@example.com" /></label>
              <label>Site type
                <select name="site_type" defaultValue={siteType}>
                  {DIGITAL_OBSERVER_SITE_TYPES.filter((item) => !item.key.includes("future")).map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label>Business / home name<input name="business_name" placeholder="Site name" /></label>
              <label>City<input name="city" placeholder="Tel Aviv" /></label>
              <label>Number of cameras<input name="camera_count" type="number" min="0" placeholder="4" /></label>
              <label>Current camera system<input name="current_camera_system" placeholder="DVR/NVR, RTSP, ONVIF, unknown" /></label>
              <label>Preferred contact method
                <select name="preferred_contact_method" defaultValue="phone">
                  <option value="phone">Phone</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="any">Any</option>
                </select>
              </label>
              <label>Package interest
                <select name="package_interest" defaultValue={packageInterest}>
                  <option value="">Not sure yet</option>
                  {DIGITAL_OBSERVER_PACKAGES.map((pkg) => <option key={pkg.key} value={pkg.key}>{pkg.name}</option>)}
                </select>
              </label>
              <label>Notes<textarea name="notes" rows={4} placeholder="What do you want Digital Observer to monitor?" /></label>
              <button className="button primary" type="submit">Request demo <ArrowLeft size={18} /></button>
            </form>

            <article className="card action-panel">
              <ShieldCheck />
              <h2>What we prepare</h2>
              <div className="risk-list">
                <div><Camera size={14} /> Camera connection review <b>gateway first</b></div>
                <div><Bell size={14} /> Alert goals <b>configured by site</b></div>
                <div><Mail size={14} /> Follow-up templates <b>ready</b></div>
                <div><Phone size={14} /> No broad sending <b>provider-gated</b></div>
              </div>
              <p>Digital Observer leads can be converted to observer sites by admin without creating kindergarten, parent, child or staff records.</p>
            </article>
          </section>
        )}
      </main>
    </>
  );
}
