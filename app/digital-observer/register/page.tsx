import Link from "next/link";
import { Building2, Home, ShieldCheck } from "lucide-react";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";
import { registerDigitalObserver } from "@/app/digital-observer/auth-actions";

type PageProps = { searchParams?: Promise<{ error?: string; type?: string }> };

const registrationErrors: Record<string, string> = {
  invalid: "יש להשלים שם, כתובת דוא״ל וסיסמה בת 8 תווים לפחות.",
  email_not_authorized: "Supabase חסם את כתובת הנמען. יש לחבר SMTP מותאם או לבדוק עם כתובת של חבר צוות בפרויקט.",
  email_rate_limited: "הגענו למגבלת שליחת המיילים של Supabase. המתינו לפני ניסיון נוסף או חברו SMTP מותאם.",
  email_delivery_failed: "Supabase לא הצליח להתחיל את שליחת האימות. יש לבדוק את יומן Auth ואת הגדרת ה-SMTP.",
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
          <h1>איזה מקום תרצו לנטר?</h1>
          <p>בחרו מסלול פשוט לבית או ניהול מתקדם לעסק.</p>
          {params?.error ? <div className="do-notice bad" role="alert"><ShieldCheck /><span>{registrationErrors[params.error] ?? registrationErrors.email_delivery_failed}</span></div> : null}
          <div className="do-choice-grid">
            <label className="do-choice"><input type="radio" name="account_type" value="home" defaultChecked={initialType === "home"} /><Home /><strong>בית פרטי</strong><span>ממשק רגוע למשפחה, ילדים, בעלי חיים וכניסה לבית</span></label>
            <label className="do-choice"><input type="radio" name="account_type" value="business" defaultChecked={initialType === "business"} /><Building2 /><strong>עסק</strong><span>אתרים, מצלמות, צוות, כללים ודוחות</span></label>
          </div>
          <div className="do-form-grid">
            <label className="do-field"><span>שם מלא</span><input name="full_name" autoComplete="name" required minLength={2} /></label>
            <label className="do-field"><span>דוא״ל</span><input name="email" type="email" autoComplete="email" required /></label>
            <label className="do-field full"><span>סיסמה</span><input name="password" type="password" autoComplete="new-password" required minLength={8} /><small>לפחות 8 תווים. הסיסמה אינה נשמרת בקוד או בדוחות.</small></label>
          </div>
          <label className="do-check"><input type="checkbox" required /><span>קראתי את תנאי השימוש ומדיניות הפרטיות הזמניים. זיהוי פנים והתראות חיצוניות דורשים הסכמה נפרדת.</span></label>
          <button className="do-button primary full" type="submit">יצירת חשבון ושליחת קוד אימות</button>
          <p className="do-auth-switch">כבר רשומים? <Link href="/digital-observer/login">התחברות</Link></p>
        </form>
      </section>
    </main>
  );
}
