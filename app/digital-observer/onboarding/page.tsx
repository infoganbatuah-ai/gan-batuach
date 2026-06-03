import Link from "next/link";
import { Camera, Clock, MapPin, PackageCheck, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";

const siteTypes = ["בית", "עסק", "מחסן", "משרד", "חנות", "חניון", "מותאם"];
const cameraTypes = ["DVR / NVR", "ONVIF", "RTSP", "IP Camera"];

export default function DigitalObserverOnboardingPage() {
  return (
    <>
      <BrandHeader />
      <main className="public-page">
        <section className="dashboard-hero-card">
          <div>
            <p className="eyebrow">Mock onboarding readiness</p>
            <h1>הצטרפות עתידית ל-Digital Observer.</h1>
            <p>תצוגת מסע לקוח בלבד. אין כאן הפעלה מסחרית, חיוב או עיבוד וידאו אמיתי.</p>
          </div>
          <span className="pill warn">Future standalone product</span>
        </section>

        <section className="grid cols-2 dashboard-panels">
          <article className="card action-panel">
            <div className="section-heading"><h2>פרטי אתר</h2><p>הנתונים יישמרו בעתיד כטיוטת onboarding.</p></div>
            <div className="form-grid compact-form">
              <label className="form-field"><span>שם האתר</span><input placeholder="לדוגמה: הבית ברחוב הרצל" disabled /></label>
              <label className="form-field"><span>סוג אתר</span><select disabled>{siteTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label className="form-field full"><span>כתובת</span><input placeholder="עיר, רחוב, מספר" disabled /></label>
              <label className="form-field"><span>אזור זמן</span><input value="Asia/Jerusalem" disabled readOnly /></label>
              <label className="form-field"><span>מספר מצלמות משוער</span><input placeholder="4" disabled /></label>
            </div>
          </article>

          <article className="card action-panel">
            <div className="section-heading"><h2>ניטור וחבילה</h2><p>חבילות standalone עתידיות בלבד.</p></div>
            <div className="procedure-list">
              <div className="procedure-card"><Clock /><div><h3>לוח ניטור</h3><p>24/7, שעות עסק, לילה בלבד או custom schedule.</p></div></div>
              <div className="procedure-card"><Camera /><div><h3>סוג מצלמות</h3><p>{cameraTypes.join(" · ")}</p></div></div>
              <div className="procedure-card"><PackageCheck /><div><h3>בחירת חבילה</h3><p>Home Basic, Home Plus, Business, Enterprise.</p></div></div>
              <div className="procedure-card"><ShieldCheck /><div><h3>Human review</h3><p>אירועים דורשים בדיקת אדם לפני הסלמה.</p></div></div>
            </div>
          </article>
        </section>

        <section className="dashboard-section">
          <div className="section-heading">
            <h2>שלבי הפעלה</h2>
            <p>Create account → Create site → Add cameras → Choose package → Activate monitoring.</p>
          </div>
          <div className="timeline-list">
            {["יצירת חשבון", "יצירת אתר", "חיבור מצלמות", "בחירת חבילת ניטור", "הפעלת ניטור"].map((step, index) => (
              <article className="card timeline-card" key={step}>
                <span className="pill">{index + 1}</span>
                <h3>{step}</h3>
              </article>
            ))}
          </div>
          <Link className="button secondary" href="/digital-observer">חזרה לעמוד Digital Observer</Link>
        </section>
      </main>
    </>
  );
}
