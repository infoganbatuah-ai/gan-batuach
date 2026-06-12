import Link from "next/link";
import { Building2, CheckCircle2, ClipboardList, FileCheck2, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ContactAvailabilityGuard } from "@/components/contact-availability-guard";
import { createGardenLead } from "@/app/actions";
import { israeliCityStreetMap, kindergartenAgeGroups, regulatoryAcceptanceItems } from "@/lib/domain/kindergarten-onboarding";

const benefits = [
  { icon: ShieldCheck, title: "בטיחות ושקיפות", text: "תיעוד, פיקוח, מסמכים והתראות במקום אחד." },
  { icon: UsersRound, title: "הורים וצוות", text: "הזמנות הורים, צוות, הרשאות ועדכונים יומיים." },
  { icon: ClipboardList, title: "הפעלה מודרכת", text: "תהליך ברור עד אישור, תשלום והפעלה מלאה." },
  { icon: FileCheck2, title: "אמנה ומסמכים", text: "אישור תנאים, העלאת מסמכים ובדיקת אדמין." }
];

export default async function JoinKindergartenPage({ searchParams }: { searchParams: Promise<{ lead?: string; error?: string }> }) {
  const params = await searchParams;
  const cities = Object.keys(israeliCityStreetMap);
  const streets = [...new Set(Object.values(israeliCityStreetMap).flat())].sort((a, b) => a.localeCompare(b, "he"));

  return (
    <>
      <BrandHeader />
      <main>
        <section className="page-hero slim-hero registration-hero">
          <p className="eyebrow">רישום גן</p>
          <h1>רישום גן למערכת גן בטוח</h1>
          <p>מתחילים בהרשמה קצרה. אחרי אישור אדמין המנהלת תקבל פרטי כניסה חד-פעמיים ותמשיך לאשף ההפעלה.</p>
          <div className="hero-actions">
            <Link className="button primary large" href="#kindergarten-registration">התחלת רישום</Link>
            <Link className="button secondary large" href="/service-charter">אמנת השירות</Link>
          </div>
          {params.lead === "sent" ? <div className="success-banner"><CheckCircle2 /> הרישום שלך התקבל בהצלחה. צוות גן בטוח יצור איתך קשר בהקדם.</div> : null}
          {params.error ? <div className="error-banner">{params.error}</div> : null}
        </section>

        <section className="section feature-grid">
          {benefits.map((item) => <article className="card trust-card" key={item.title}><item.icon size={22} /><h3>{item.title}</h3><p>{item.text}</p></article>)}
        </section>

        <section className="section wizard-layout">
          <aside className="wizard-steps">
            {["פרטי מנהלת", "כתובת מאומתת", "קבוצות גיל", "תנאים ואמנה"].map((step, index) => (
              <div className="wizard-step" key={step}><span>{index + 1}</span><Building2 size={20} /><div><strong>{step}</strong><small>שלב חובה לרישום</small></div></div>
            ))}
          </aside>

          <form id="kindergarten-registration" action={createGardenLead} className="card form wizard-form premium-step-form">
            <input type="hidden" name="source" value="public_kindergarten_registration" />
            <input type="hidden" name="campaign" value="kindergarten_activation_flow" />
            <input type="hidden" name="funnel_stage" value="trial" />
            <input type="hidden" name="conversion_goal" value="registration_to_activation" />
            <input type="hidden" name="requested_plan" value="annual" />
            <input type="hidden" name="regulatory_terms_version" value="2026-06-13" />
            <h2>פרטי רישום ראשוניים</h2>
            <p>הגן לא יהיה פעיל עד אישור אדמין, השלמת אשף ההפעלה, הזמנת צוות והורים, מסמכים ותשלום.</p>

            <div className="form-grid">
              <label>שם מנהלת מלא *<input name="manager_name" required /></label>
              <label>טלפון מנהלת *<input name="phone" required /></label>
              <label>מייל מנהלת *<input name="email" type="email" required /></label>
              <label>שם הגן *<input name="garden_name" required /></label>
              <label>עיר *<select name="city" required><option value="">בחרו עיר</option>{cities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
              <label>רחוב *<select name="street" required><option value="">בחרו רחוב</option>{streets.map((street) => <option key={street} value={street}>{street}</option>)}</select></label>
              <label>מספר בניין *<input name="building_number" required inputMode="numeric" /></label>
              <label>שם בעלים<input name="owner_name" /></label>
            </div>
            <ContactAvailabilityGuard />

            <section className="card action-panel">
              <h3><MapPin size={18} /> קבוצות גיל קבועות</h3>
              <div className="choice-grid detection-grid">
                {kindergartenAgeGroups.map((group) => (
                  <label key={group.key}>
                    <input type="checkbox" name="age_groups" value={group.key} />
                    <strong>{group.label}</strong>
                    <span>{group.range} · עד {group.maxChildrenPerClass} ילדים · {group.rule}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="card action-panel">
              <h3>אישורי חובה</h3>
              <p>האישור נשמר עם גרסת התנאים והזמן. IP ייקלט בצד השרת אם זמין.</p>
              <div className="choice-grid detection-grid">
                {regulatoryAcceptanceItems.map((item) => (
                  <label key={item.key}><input type="checkbox" name="regulatory_acceptance" value={item.key} required /> {item.label}</label>
                ))}
              </div>
              <Link className="button secondary" href="/service-charter">קריאת אמנת השירות</Link>
            </section>

            <label className="wide">הערות ראשוניות<textarea name="notes" rows={3} placeholder="שעות פעילות, מספר ילדים משוער, מסמכים קיימים או כל פרט חשוב" /></label>
            <button className="button primary large" type="submit">שליחת רישום לאישור</button>
          </form>
        </section>
      </main>
    </>
  );
}
