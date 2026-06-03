import Link from "next/link";
import { Bell, Camera, MonitorCheck, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";

export default function DigitalObserverPublicPage() {
  return (
    <>
      <BrandHeader />
      <main className="public-page">
        <section className="hero-section">
          <div className="hero-content">
            <p className="eyebrow">Future standalone product</p>
            <h1>Digital Observer לבתים ולעסקים.</h1>
            <p>מסלול עתידי נפרד מגן בטוח לניטור מצלמות, אירועי בטיחות והתראות חכמות בבתים, עסקים, מחסנים, משרדים וחניונים.</p>
            <div className="hero-actions">
              <Link className="button primary" href="/digital-observer/onboarding">הצגת מסלול הצטרפות</Link>
              <Link className="button secondary" href="/digital-observer/dashboard">דשבורד עתידי</Link>
            </div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>מסע לקוח עתידי</h2>
            <p>המסלול הזה אינו מחליף או משנה את רישום גני הילדים ב-Gan Batuach.</p>
          </div>
          <div className="grid cols-4 dashboard-panels">
            <article className="card action-panel"><ShieldCheck /><h3>יצירת חשבון</h3><p>בעל בית, עסק, מחסן, משרד או לקוח enterprise.</p></article>
            <article className="card action-panel"><MonitorCheck /><h3>יצירת אתר</h3><p>שם האתר, סוג האתר, כתובת, אזור זמן ולוח ניטור.</p></article>
            <article className="card action-panel"><Camera /><h3>חיבור מצלמות</h3><p>DVR, NVR, RTSP, ONVIF או IP Camera דרך Gateway מאובטח.</p></article>
            <article className="card action-panel"><Bell /><h3>ניטור והתראות</h3><p>SMS, WhatsApp, Push ואימייל לפי הרשאות והעדפות.</p></article>
          </div>
        </section>
      </main>
    </>
  );
}
