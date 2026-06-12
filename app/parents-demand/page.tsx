import { BellRing, Camera, CheckCircle2, FileText, HeartHandshake, MessageCircle, ShieldCheck, UsersRound } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { createParentDemandLead } from "@/app/actions";

export const metadata = {
  title: "הורים דורשים גן בטוח | גן בטוח",
  description: "עמוד להורים שרוצים שקיפות, בטיחות ופיקוח טוב יותר בגן הילדים."
};

const trustItems = [
  { icon: ShieldCheck, title: "בטיחות ושקיפות", text: "הורים מקבלים תמונת מצב ברורה על מה שחשוב באמת." },
  { icon: UsersRound, title: "צוות והכשרות", text: "מעקב אחר מסמכים, הכשרות ובדיקות צוות." },
  { icon: MessageCircle, title: "תקשורת יומית", text: "עדכונים, הודעות, אישורים ותיעוד במקום אחד." },
  { icon: Camera, title: "מצלמות כשמותר", text: "צפייה רק לפי הרשאות הגן, שעות צפייה וכללי פרטיות." },
  { icon: FileText, title: "מסמכים ובדיקות", text: "רישיונות, אישורים, בדיקות ופיקוח בצורה נגישה." },
  { icon: BellRing, title: "פיקוח והתראות", text: "שכבת בקרה שמסייעת לזהות סיכונים ולהעבירם לבדיקה אנושית." }
];

export default async function ParentsDemandPage({ searchParams }: { searchParams: Promise<{ lead?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <BrandHeader />
      <main>
        <section className="page-hero registration-hero">
          <p className="eyebrow">להורים</p>
          <h1>גן הילדים שלכם עדיין לא בגן בטוח?</h1>
          <p>הורים יכולים לבקש מהגן להצטרף למערכת שמחזקת שקיפות, תקשורת, פיקוח, מסמכים ועדכונים יומיים.</p>
          <div className="hero-actions">
            <a className="button primary large" href="#parent-demand-form">הורים? לחצו כאן</a>
          </div>
          {params.lead === "sent" ? <div className="success-banner"><CheckCircle2 /> הבקשה התקבלה. צוות גן בטוח יבחן את הפרטים וימשיך קשר בצורה מכבדת.</div> : null}
          {params.error ? <div className="error-banner">{params.error}</div> : null}
        </section>
        <section className="section feature-grid">
          {trustItems.map((item) => <article className="card trust-card" key={item.title}><item.icon size={22} /><h3>{item.title}</h3><p>{item.text}</p></article>)}
        </section>
        <section className="section wizard-layout">
          <aside className="wizard-steps">
            {["הורה שולח בקשה", "גן בטוח יוצר קשר", "הגן מקבל קישור רישום", "המערכת נפתחת אחרי אישור"].map((step, index) => (
              <div className="wizard-step" key={step}><span>{index + 1}</span><HeartHandshake size={20} /><div><strong>{step}</strong><small>תהליך קצר וברור</small></div></div>
            ))}
          </aside>
          <form id="parent-demand-form" action={createParentDemandLead} className="card form wizard-form premium-step-form">
            <h2>בקשו מהגן להצטרף</h2>
            <p>נשמור את הפרטים כליד חדש ונציג אותם במרכז הלידים של האדמין.</p>
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
            <div className="choice-grid detection-grid" aria-label="קבוצות גיל">
              {[
                ["babies", "תינוקות"],
                ["toddlers", "פעוטות"],
                ["3-4", "3-4"],
                ["4-5", "4-5"],
                ["mixed", "קבוצה מעורבת"],
                ["unknown", "אני לא יודע/ת"]
              ].map(([value, label]) => <label key={value}><input type="checkbox" name="child_age_groups" value={value} /> {label}</label>)}
            </div>
            <label className="declaration-box"><input required type="checkbox" /> <span><strong>אישור קשר</strong> מותר לצוות גן בטוח ליצור איתי קשר לגבי הבקשה ולפנות לגן בצורה מכבדת.</span></label>
            <button className="button primary large" type="submit">שליחת בקשה</button>
          </form>
        </section>
      </main>
    </>
  );
}
