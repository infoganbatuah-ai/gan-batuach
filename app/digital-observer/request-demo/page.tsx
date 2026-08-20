import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Bell, Camera, Mail, Phone, ShieldCheck } from "lucide-react";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";
import { DIGITAL_OBSERVER_PACKAGES, DIGITAL_OBSERVER_SITE_TYPES } from "@/lib/domain/digital-observer-product";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: { absolute: "בקשת הדגמה | תצפיתן דיגיטלי" },
  description: "בקשת הדגמה בטוחה של התצפיתן הדיגיטלי לבית, לעסק ולאתר מנוטר.",
  alternates: { canonical: "/digital-observer/request-demo" },
  openGraph: {
    title: "בקשת הדגמה | תצפיתן דיגיטלי",
    description: "הדגמת ניטור מצלמות חכם לבית ולעסק, ללא הפעלת שירותים חיים.",
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
    <div className="do-public" dir="rtl">
      <header className="do-public-header"><Link className="do-auth-brand dark" href="/digital-observer"><ObserverMark /><span><b>תצפיתן דיגיטלי</b><small>הדגמה לבית ולעסק</small></span></Link><nav><Link href="/digital-observer">המוצר</Link><Link href="/digital-observer/pricing">חבילות</Link><Link href="/digital-observer/trust">פרטיות</Link></nav><div><Link className="do-button secondary" href="/digital-observer/login">התחברות</Link></div></header>
      <main className="public-page digital-observer-public">
        <section className="hero-section digital-observer-hero">
          <div className="hero-content">
            <p className="eyebrow">בקשת הדגמה</p>
            <h1>ראו כיצד התצפיתן יכול לנטר את המקום שלכם.</h1>
            <p>ספרו לנו על המצלמות ומטרות הניטור. התהליך נשאר נפרד לחלוטין מגן בטוח.</p>
          </div>
          <div className="observer-live-card">
            <strong>הדגמה בטוחה</strong>
            <span>ללא מצלמה אמיתית</span>
            <span>ללא חיוב או שליחה חיצונית</span>
            <span>ללא יצירת רשומות גן ילדים</span>
          </div>
        </section>

        {submitted ? (
          <section className="dashboard-section">
            <div className="empty-state">
              <strong>בקשת ההדגמה התקבלה.</strong>
              <span>הבקשה נשמרה לטיפול אדמין. לא נשלחה הודעת SMS, WhatsApp או הודעת ספק חיצונית.</span>
              <div className="hero-actions">
                <Link className="button primary" href="/digital-observer">חזרה לתצפיתן הדיגיטלי</Link>
                <Link className="button secondary" href="/digital-observer/pricing">השוואת חבילות</Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="grid cols-2 dashboard-panels">
            <form className="card action-panel" action="/api/digital-observer/leads" method="post">
              <input type="hidden" name="source" value="digital_observer_demo" />
              <input type="hidden" name="redirect_to" value="/digital-observer/request-demo" />
              <input type="hidden" name="form_route" value="/digital-observer/request-demo" />
              <label aria-hidden="true" style={{ display: "none" }}>אתר<input name="website" tabIndex={-1} autoComplete="off" /></label>
              {["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].map((key) => (
                <input key={key} type="hidden" name={key} value={pick(params[key]) ?? ""} />
              ))}
              <h2>פרטי ההדגמה</h2>
              <label>שם מלא<input name="contact_name" required placeholder="ישראל ישראלי" /></label>
              <label>טלפון<input name="phone" required placeholder="050-0000000" /></label>
              <label>דוא״ל<input name="email" type="email" placeholder="name@example.com" /></label>
              <label>סוג המקום
                <select name="site_type" defaultValue={siteType}>
                  {DIGITAL_OBSERVER_SITE_TYPES.filter((item) => !item.key.includes("future")).map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label>שם הבית או העסק<input name="business_name" placeholder="שם המקום" /></label>
              <label>עיר<input name="city" placeholder="תל אביב" /></label>
              <label>מספר מצלמות<input name="camera_count" type="number" min="0" placeholder="4" /></label>
              <label>מערכת המצלמות הקיימת<input name="current_camera_system" placeholder="DVR/NVR, RTSP, ONVIF או לא ידוע" /></label>
              <label>דרך התקשרות מועדפת
                <select name="preferred_contact_method" defaultValue="phone">
                  <option value="phone">טלפון</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">דוא״ל</option>
                  <option value="any">ללא העדפה</option>
                </select>
              </label>
              <label>חבילה שמעניינת אותך
                <select name="package_interest" defaultValue={packageInterest}>
                  <option value="">טרם החלטתי</option>
                  {DIGITAL_OBSERVER_PACKAGES.map((pkg) => <option key={pkg.key} value={pkg.key}>{pkg.name}</option>)}
                </select>
              </label>
              <label>הערות<textarea name="notes" rows={4} placeholder="מה תרצו שהתצפיתן יבדוק עבורכם?" /></label>
              <button className="button primary" type="submit">שליחת בקשה <ArrowLeft size={18} /></button>
            </form>

            <article className="card action-panel">
              <ShieldCheck />
              <h2>מה נכין להדגמה</h2>
              <div className="risk-list">
                <div><Camera size={14} /> בדיקת סוג החיבור <b>דרך Gateway מאובטח</b></div>
                <div><Bell size={14} /> מטרות התראה <b>לפי המקום והמצלמה</b></div>
                <div><Mail size={14} /> תבניות המשך <b>במצב מוכנות</b></div>
                <div><Phone size={14} /> ללא שליחה חיצונית <b>עד חיבור ספק מאושר</b></div>
              </div>
              <p>אדמין יכול להפוך את הבקשה לאתר תצפיתן עצמאי, בלי ליצור גן ילדים, הורה, ילד או איש צוות בגן בטוח.</p>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}
