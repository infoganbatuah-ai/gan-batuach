import { Camera, FileHeart, HeartPulse, IdCard, ShieldCheck, UserRoundCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";

const steps = [
  { icon: IdCard, title: "פרטי הורה", text: "לפחות תעודת זהות אחת של הורה נדרשת לזיהוי ואחריות." },
  { icon: FileHeart, title: "פרטי ילד", text: "שם, תאריך לידה, קופה, כתובת ופרטים בסיסיים." },
  { icon: HeartPulse, title: "בריאות", text: "אלרגיות, רגישויות, תרופות קבועות והצהרת בריאות." },
  { icon: UserRoundCheck, title: "מורשי איסוף", text: "רק אנשים מורשים יכולים להופיע בתהליך איסוף." },
  { icon: Camera, title: "הסכמות", text: "צילום, מערכת, פרטיות וצפייה במצלמות אם רלוונטי." },
  { icon: ShieldCheck, title: "אישור גננת", text: "הילד פעיל רק לאחר בדיקה ואישור מנהלת הגן." }
];

export default function ParentOnboardingPage() {
  return (
    <>
      <BrandHeader />
      <main>
        <section className="page-hero slim-hero">
          <p className="eyebrow">רישום ילד</p>
          <h1>אשף רישום רגוע וברור להורים.</h1>
          <p>המטרה היא לאסוף מידע חיוני בלי להציף את ההורה, ולהעביר למנהלת הגן בקשה מסודרת לאישור.</p>
        </section>
        <section className="section wizard-layout">
          <aside className="wizard-steps progress-rail">
            {steps.map((step, index) => (
              <div className="wizard-step" key={step.title}>
                <span>{index + 1}</span>
                <step.icon size={20} />
                <div><strong>{step.title}</strong><small>{step.text}</small></div>
              </div>
            ))}
          </aside>
          <form className="card form wizard-form">
            <div className="progress-bar"><span style={{ width: "38%" }} /></div>
            <h2>פרטי ילד ובריאות</h2>
            <p>המידע גלוי רק לגורמי הגן המורשים, לאדמין לפי הרשאה ולפקח במידת הצורך.</p>
            <div className="form-grid"><label>שם ילד מלא<input required /></label><label>תאריך לידה<input type="date" /></label><label>תעודת זהות ילד אם קיימת<input /></label><label>קופת חולים<input /></label><label>אלרגיות<input placeholder="אם אין, כתבו אין" /></label><label>תרופות קבועות<input placeholder="שם התרופה ומינון" /></label><label className="wide">הערות רפואיות<textarea rows={3} /></label></div>
            <h3>פרטי הורים ואנשי קשר</h3>
            <div className="form-grid"><label>שם אם<input /></label><label>ת.ז אם<input /></label><label>טלפון אם<input /></label><label>שם אב<input /></label><label>ת.ז אב<input /></label><label>טלפון אב<input /></label><label className="wide">איש קשר חירום<textarea rows={2} placeholder="שם, קרבה, טלפון" /></label></div>
            <h3>הסכמות</h3>
            <div className="consent-grid"><label><input type="checkbox" /> אישור שימוש במערכת</label><label><input type="checkbox" /> הסכמת פרטיות</label><label><input type="checkbox" /> אישור צילום</label><label><input type="checkbox" /> אישור צפייה במצלמות אם רלוונטי</label><label><input type="checkbox" /> הצהרת בריאות</label></div>
            <button className="button primary large" type="button">שליחה לאישור מנהלת הגן</button>
          </form>
        </section>
      </main>
    </>
  );
}
