import Link from "next/link";
import { BellRing, Camera, CheckCircle2, FileText, GraduationCap, HeartHandshake, MessageCircle, ShieldCheck, UserCheck, UsersRound } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { createParentDemandLead } from "@/app/actions";

export const metadata = {
  title: "הורים? בקשו גן בטוח | גן בטוח",
  description: "עמוד להורים שרוצים שהגן של הילד יצטרף לסטנדרט שקיפות, בטיחות, פיקוח ותקשורת יומית."
};

const parentTrustBlocks = [
  { icon: ShieldCheck, title: "שקיפות ובטיחות", text: "הורה לא צריך לנחש מה קורה בגן. מידע מאושר וברור במקום אחד." },
  { icon: FileText, title: "מסמכים ופיקוח", text: "רישיונות, אישורים, ביקורות ומעקב תיקונים בצורה נגישה." },
  { icon: UserCheck, title: "בדיקות צוות", text: "אישורים, הכשרות ומסמכי צוות מנוהלים כחלק ממוכנות הגן." },
  { icon: GraduationCap, title: "אימות הכשרות", text: "מעקב אחר הכשרות, תעודות וחובות רגולטוריות." },
  { icon: MessageCircle, title: "תקשורת יומית", text: "הודעות, עדכונים, בקשות ואישורים בלי לרדוף אחרי מידע." },
  { icon: Camera, title: "מצלמות כשמותר", text: "צפייה רק אם הגן מאפשר, בשעות מוגדרות ובהרשאות מוגנות." }
];

export default async function ParentsPage({ searchParams }: { searchParams: Promise<{ lead?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <BrandHeader />
      <main>
        <section className="page-hero acquisition-hero parent-acquisition-hero">
          <div className="acquisition-copy">
            <p className="eyebrow">להורים</p>
            <h1>הגן שלי עדיין לא בגן בטוח.</h1>
            <p>בקשה אחת שלכם יכולה לפתוח שיחה עם הגן על שקיפות, בטיחות, פיקוח, מסמכים, עדכונים יומיים ותקשורת מסודרת.</p>
            <div className="hero-actions">
              <a className="button primary large" href="#parent-demand-form">הגן שלי עדיין לא בגן בטוח</a>
              <Link className="button secondary large" href="/parent-portal">מה הורים מקבלים</Link>
            </div>
            {params.lead === "sent" ? <div className="success-banner"><CheckCircle2 /> הבקשה התקבלה. צוות גן בטוח יבחן את הפרטים וימשיך קשר בצורה מכבדת.</div> : null}
            {params.error ? <div className="error-banner">{params.error}</div> : null}
          </div>
          <div className="acquisition-visual">
            <img src="https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1100&q=80" alt="הורים וילדים סביב סביבת גן בטוחה" />
            <div className="floating-proof-card">
              <strong>הורים מבקשים שקיפות</strong>
              <span>עדכונים · פיקוח · מסמכים · תקשורת</span>
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section-head">
            <span className="marketing-badge">Parent Demand</span>
            <h2>כשהורים מבקשים, הגן מבין שיש ביקוש אמיתי.</h2>
            <p>כל בקשה נכנסת למרכז הלידים. אם כמה הורים מבקשים את אותו גן, גן בטוח מזהה ביקוש גבוה ופונה לגן בצורה מסודרת.</p>
          </div>
          <div className="grid cols-3 feature-grid">
            <article className="marketing-card animated-feature-card"><HeartHandshake size={24} /><h3>1. הורה שולח בקשה</h3><p>שם הורה, פרטי קשר, שם הגן ופרטים ידועים על המנהלת.</p></article>
            <article className="marketing-card animated-feature-card"><BellRing size={24} /><h3>2. צוות גן בטוח מטפל</h3><p>הליד מקבל סטטוס, ציון עניין ומשימת follow-up.</p></article>
            <article className="marketing-card animated-feature-card"><UsersRound size={24} /><h3>3. הגן ממשיך לרישום</h3><p>אם המנהלת מסכימה, נפתח רישום גן ותהליך Phase 139.</p></article>
          </div>
        </section>

        <section className="section feature-grid">
          {parentTrustBlocks.map((item) => <article className="card trust-card" key={item.title}><item.icon size={22} /><h3>{item.title}</h3><p>{item.text}</p></article>)}
        </section>

        <section className="section wizard-layout">
          <aside className="wizard-steps">
            {["בקשה מהורה", "זיהוי ביקוש", "פנייה לגן", "רישום מנהלת"].map((step, index) => (
              <div className="wizard-step" key={step}><span>{index + 1}</span><HeartHandshake size={20} /><div><strong>{step}</strong><small>מסלול ביקוש הורים</small></div></div>
            ))}
          </aside>
          <form id="parent-demand-form" action={createParentDemandLead} className="card form wizard-form premium-step-form">
            <h2>בקשו מהגן להצטרף</h2>
            <p>הבקשה תיכנס כליד הורים ותוצג לאדמין במרכז הלידים והצמיחה.</p>
            <div className="form-grid">
              <label>שם ההורה *<input name="parent_name" required /></label>
              <label>טלפון הורה *<input name="parent_phone" required /></label>
              <label>מייל הורה<input name="parent_email" type="email" /></label>
              <label>שם הגן *<input name="garden_name" required /></label>
              <label className="wide">כתובת הגן<input name="garden_address" /></label>
              <label>שם מנהלת אם ידוע<input name="manager_name" /></label>
              <label>טלפון מנהלת אם ידוע<input name="manager_phone" /></label>
              <label className="wide">הערה לצוות גן בטוח<textarea name="notes" rows={3} placeholder="מה חשוב לכם שהגן ידע? שקיפות, עדכונים, מצלמות, מסמכים, תקשורת..." /></label>
            </div>
            <div className="choice-grid detection-grid" aria-label="קבוצת גיל הילד">
              {[
                ["infant", "3-15 חודשים"],
                ["young_toddler", "16-24 חודשים"],
                ["mature_toddler", "25-36 חודשים"],
                ["kindergarten", "3+ שנים"],
                ["mixed", "קבוצה מעורבת"],
                ["unknown", "אני לא יודע/ת"]
              ].map(([value, label]) => <label key={value}><input type="checkbox" name="child_age_groups" value={value} /> {label}</label>)}
            </div>
            <label className="declaration-box"><input required type="checkbox" /> <span><strong>אישור קשר</strong> מותר לצוות גן בטוח ליצור איתי קשר לגבי הבקשה ולפנות לגן בצורה מכבדת.</span></label>
            <button className="button primary large" type="submit">שליחת בקשת הורים</button>
          </form>
        </section>
      </main>
    </>
  );
}
