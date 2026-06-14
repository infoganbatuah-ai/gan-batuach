import Link from "next/link";
import { Camera, EyeOff, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { DIGITAL_OBSERVER_NAVIGATION } from "@/lib/domain/digital-observer-product";

export default function DigitalObserverCamerasPage() {
  return (
    <>
      <BrandHeader />
      <main className="public-page digital-observer-app">
        <nav className="product-switcher" aria-label="Digital Observer camera navigation">
          <strong>Digital Observer</strong>
          <div>{DIGITAL_OBSERVER_NAVIGATION.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}</div>
        </nav>
        <section className="dashboard-hero-card observer-dashboard-hero">
          <div><p className="eyebrow">Cameras</p><h1>Secure camera setup readiness.</h1><p>Prepare RTSP, DVR/NVR, ONVIF and demo camera setup without exposing credentials or raw RTSP URLs.</p></div>
          <Link className="button primary" href="/digital-observer/onboarding">Add camera</Link>
        </section>
        <section className="grid cols-3 dashboard-panels">
          <article className="card action-panel"><Camera /><h2>Gateway first</h2><p>Playback should use gateway and short-lived tokens.</p></article>
          <article className="card action-panel"><EyeOff /><h2>No secret exposure</h2><p>RTSP URLs, usernames, passwords and gateway secrets stay server-side.</p></article>
          <article className="card action-panel"><ShieldCheck /><h2>Audit ready</h2><p>Viewing and setup actions should be logged before production cutover.</p></article>
        </section>
      </main>
    </>
  );
}
