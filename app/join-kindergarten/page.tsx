import Link from "next/link";
import { Bot, Building2, Camera, CheckCircle2, ClipboardList, CreditCard, FileCheck2, MapPin, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ContactAvailabilityGuard } from "@/components/contact-availability-guard";
import { createGardenLead } from "@/app/actions";
import { israeliCityStreetMap, kindergartenAgeGroups, regulatoryAcceptanceItems } from "@/lib/domain/kindergarten-onboarding";

const benefits = [
  { icon: ShieldCheck, title: "בטיחות ושקיפות", text: "תיעוד, פיקוח, מסמכים והתראות במקום אחד." },
  { icon: UsersRound, title: "הורים וצוות", text: "הזמנות הורים, צוות, הרשאות ועדכונים יומיים." },
  { icon: ClipboardList, title: "הפעלה מודרכת", text: "תהליך רציף עד 14 ימי ניסיון ודשבורד פעיל." },
  { icon: FileCheck2, title: "אמנה ומסמכים", text: "אישור תנאים, מסמכים ומעקב תפעולי במקום אחד." }
];

const managerValueBlocks = [
  { icon: ClipboardList, title: "פיקוח וביקורות", text: "ביקורות, ממצאים, תיקונים ודוחות במקום אחד." },
  { icon: ShieldCheck, title: "שקיפות ואמון", text: "הורים רואים מידע מאושר וברור בלי להציף את הצוות." },
  { icon: Bot, title: "תצפיתן AI", text: "המלצות לבדיקה אנושית בלבד, בלי החלטות אוטומטיות." },
  { icon: Camera, title: "מצלמות בהרשאה", text: "גישה לפי שעות, תפקידים ואישור מפורש של הגן." },
  { icon: FileCheck2, title: "מסמכים וציות", text: "תוקף מסמכים, הכשרות, אישורים ופעולות תיקון." },
  { icon: CreditCard, title: "תשלומים", text: "מנוי גן, תשלומי הורים, חשבוניות ודוחות הכנסה." },
  { icon: UsersRound, title: "ניהול צוות", text: "קליטת עובדים, מסמכים, משימות ונוכחות." },
  { icon: Sparkles, title: "אוטומציה", text: "פחות מעקב ידני, יותר פעולות ברורות ליום העבודה." }
];

const faq = [
  ["האם הרישום מפעיל את הגן מיד?", "לאחר השלמת אשף ההקמה הגן נכנס ל־14 ימי ניסיון ללא חיוב ביום הראשון. אין המתנה לאישור אדמין."],
  ["האם צריך מצלמות כדי להתחיל?", "לא. אפשר להתחיל בהפעלה תפעולית ולחבר מצלמות בהמשך לפי מדיניות הגן."],
  ["האם AI שולח התרעות להורים לבד?", "לא. אירועים רגישים דורשים בדיקה ואישור אנושי לפני חשיפה כלשהי."],
  ["מה קורה אחרי יצירת החשבון?", "המנהלת ממשיכה מיד לפרטי הגן, קבוצות, תמחור, הזמנות אופציונליות וסיכום תקופת הניסיון."]
];

export default async function JoinKindergartenPage({ searchParams }: { searchParams: Promise<{ lead?: string; error?: string }> }) {
  const params = await searchParams;
  const cities = Object.keys(israeliCityStreetMap);
  const streets = [...new Set(Object.values(israeliCityStreetMap).flat())].sort((a, b) => a.localeCompare(b, "he"));

  return (
    <>
      <BrandHeader />
      <main>
        <section className="page-hero acquisition-hero kindergarten-acquisition-hero">
          <div className="acquisition-copy">
            <p className="eyebrow">רישום גן ילדים</p>
            <h1>הופכים את הגן לגן בטוח, שקוף ומוכן לפיקוח.</h1>
            <p>מערכת אחת לניהול בטיחות, פיקוח, מסמכים, צוות, הורים, מצלמות, תשלומים ותפעול יומי. לא עוד עודף מסכים, אלא סטנדרט אמון שמבדל את הגן.</p>
            <div className="hero-actions">
              <Link className="button primary large" href="/app/register/kindergarten">רישום גן למערכת גן בטוח</Link>
              <Link className="button secondary large" href="/book-demo">קבע הדגמה</Link>
              <Link className="button secondary large" href="/service-charter">אמנת השירות</Link>
            </div>
            {params.lead === "sent" ? <div className="success-banner"><CheckCircle2 /> הרישום שלך התקבל בהצלחה. צוות גן בטוח יצור איתך קשר בהקדם.</div> : null}
            {params.error ? <div className="error-banner">{params.error}</div> : null}
          </div>
          <div className="acquisition-visual">
            <img src="https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1100&q=80" alt="גן ילדים בטוח ושקוף" />
            <div className="floating-proof-card">
              <strong>סטנדרט גן בטוח</strong>
              <span>פיקוח · שקיפות · תיעוד · אמון הורים</span>
            </div>
          </div>
        </section>

        <section className="section feature-grid">
          {benefits.map((item) => <article className="card trust-card" key={item.title}><item.icon size={22} /><h3>{item.title}</h3><p>{item.text}</p></article>)}
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <span className="marketing-badge">מה הגן מקבל</span>
            <h2>תפעול, שקיפות ופיקוח שמרגישים כמו מערכת אחת.</h2>
            <p>גן בטוח מחברת את כל מה שמנהלת צריכה כדי להפעיל גן אמיתי מול צוות, הורים, מסמכים, תשלומים ופיקוח.</p>
          </div>
          <div className="grid cols-4 feature-grid">
            {managerValueBlocks.map((item) => <article className="marketing-card animated-feature-card" key={item.title}><item.icon size={24} /><h3>{item.title}</h3><p>{item.text}</p></article>)}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <span className="marketing-badge">לפני ואחרי</span>
            <h2>מגן שמנוהל ידנית לגן שמוכן לצמיחה.</h2>
          </div>
          <div className="scale-comparison-table">
            <div className="scale-comparison-head"><span>תחום</span><span>לפני</span><span>עם גן בטוח</span></div>
            {[
              ["מסמכים", "קבצים מפוזרים ותוקפים שנשכחים", "מרכז מסמכים עם תוקף, תזכורות ואישור"],
              ["הורים", "הודעות מפוזרות וחוסר ודאות", "עדכונים, שקיפות ובקשות במקום אחד"],
              ["פיקוח", "דוח חד פעמי בלי מעקב", "ממצאים, תיקון, אימות וסגירת מעגל"],
              ["תפעול", "טבלאות, פתקים ושיחות", "מרכז פיקוד יומי למנהלת"]
            ].map(([area, before, after]) => (
              <div className="scale-comparison-row" key={area}><strong>{area}</strong><small>{before}</small><small>{after}</small></div>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <span className="marketing-badge">FAQ</span>
            <h2>שאלות נפוצות לפני רישום</h2>
          </div>
          <div className="faq-grid">
            {faq.map(([question, answer]) => <article className="card" key={question}><h3>{question}</h3><p>{answer}</p></article>)}
          </div>
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
            <h2>בקשת ליווי לרישום</h2>
            <p>אפשר למלא פרטים לקבלת ליווי, או לפתוח חשבון ולהשלים את כל הרישום באופן עצמאי ללא המתנה לאישור אדמין.</p>

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
            <button className="button primary large" type="submit">שליחת פרטים לקבלת ליווי</button>
          </form>
        </section>
      </main>
    </>
  );
}
