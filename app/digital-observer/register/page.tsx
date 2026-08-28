import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";
import { registerDigitalObserver } from "@/app/digital-observer/auth-actions";

type PageProps = { searchParams?: Promise<{ error?: string; type?: string }> };

const registrationErrors: Record<string, string> = {
  invalid: "יש להשלים שם, כתובת דוא״ל וסיסמה בת 8 תווים לפחות.",
  terms_required: "יש לאשר את תנאי השימוש ומדיניות הפרטיות כדי לפתוח חשבון.",
  email_not_authorized: "שירות המייל המובנה של Supabase אינו מורשה לשלוח לכתובת הזו. יש לחבר SMTP מותאם לפני רישום משתמשים חדשים.",
  email_rate_limited: "הגענו זמנית למגבלת שליחת המיילים. המתינו מספר דקות ונסו דרך 'קוד חדש והמשך הרשמה' במסך האימות.",
  supabase_configuration_error: "מפתח החיבור של Supabase בסביבת האתר אינו תקין. יש לעדכן את משתני הסביבה לפני ניסיון נוסף.",
  email_delivery_failed: "Supabase קיבל את בקשת הרישום, אך ספק המייל לא הצליח לשלוח את קוד האימות. יש להשלים חיבור SMTP ולנסות שוב.",
  existing_or_unavailable: "לא נוצר אימות חדש. אם הכתובת כבר רשומה, עברו להתחברות; אחרת בדקו את הגדרת הדוא״ל."
};

export default async function DigitalObserverRegisterPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialType = params?.type === "business" ? "business" : "home";
  return (
    <main className="do-auth-page light" dir="rtl">
      <section className="do-auth-form-wrap wide">
        <form action={registerDigitalObserver} className="do-auth-card">
          <Link className="do-auth-brand dark" href="/digital-observer"><ObserverMark /><span><b>תצפיתן דיגיטלי</b><small>יצירת חשבון חדש</small></span></Link>
          <h1>יצירת חשבון</h1>
          <p>השלימו את הפרטים ונשלח קוד אימות חד־פעמי למייל.</p>
          {params?.error ? <div className="do-notice bad" role="alert"><ShieldCheck /><span>{registrationErrors[params.error] ?? registrationErrors.email_delivery_failed}</span></div> : null}
          <input type="hidden" name="account_type" value={initialType} />
          <div className={`do-registration-route ${initialType}`}><span className="do-account-type-visual" aria-hidden="true"><Image src={initialType === "home" ? "/assets/digital-observer/account-home-v1.png" : "/assets/digital-observer/account-business-v1.png"} alt="" width={700} height={700} /></span><span><strong>{initialType === "home" ? "מסלול ביתי" : "מסלול עסקי"}</strong><small>{initialType === "home" ? "בית, משפחה, כניסות ובעלי חיים" : "אתרים, מצלמות, צוות והרשאות"}</small></span><Link href="/digital-observer/start">שינוי</Link></div>
          <div className="do-form-grid">
            <label className="do-field"><span>שם מלא</span><input name="full_name" autoComplete="name" required minLength={2} /></label>
            <label className="do-field"><span>דוא״ל</span><input name="email" type="email" autoComplete="email" required /></label>
            <label className="do-field full"><span>סיסמה</span><input name="password" type="password" autoComplete="new-password" required minLength={8} /><small>לפחות 8 תווים. הסיסמה אינה נשמרת בקוד או בדוחות.</small></label>
          </div>
          <label className="do-check"><input name="terms_consent" type="checkbox" required /><span>קראתי ואישרתי את <Link href="/digital-observer/trust" target="_blank">תנאי השימוש ומדיניות הפרטיות</Link>. זיהוי פנים, התראות חיצוניות ופעולות פיזיות דורשים הסכמה נפרדת.</span></label>
          <label className="do-check"><input name="model_improvement_consent" type="checkbox" /><span><strong>אופציונלי - שיפור המודל הכללי:</strong> אני מאשר/ת שימוש בתובנות מצומצמות ומנותקות מזהות לצורך שיפור המערכת. לא יועברו וידאו גולמי, כתובות מקור, סיסמאות או מידע ביומטרי.</span></label>
          <button className="do-button primary full" type="submit">יצירת חשבון ושליחת קוד אימות</button>
          <p className="do-auth-switch">כבר ניסיתם להירשם והמייל לא אושר? <Link href="/digital-observer/verify">שליחת קוד חדש והמשך הרשמה</Link></p>
          <p className="do-auth-switch">כבר רשומים? <Link href="/digital-observer/login">התחברות</Link></p>
          <p className="do-auth-switch">הכתובת כבר משמשת בגן בטוח? <Link href={`/digital-observer/login?type=${initialType}`}>התחברו איתה כאן</Link> וחשבון התצפיתן יישמר בנפרד.</p>
        </form>
      </section>
    </main>
  );
}
