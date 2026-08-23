import Link from "next/link";
import { LockKeyhole, MapPinned, ShieldCheck } from "lucide-react";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";
import { ObserverAuthDevicePreview } from "@/components/digital-observer/observer-auth-device-preview";
import { ObserverLoginForm } from "@/components/digital-observer/observer-login-form";

type PageProps = { searchParams?: Promise<{ error?: string; registered?: string; verified?: string; password_updated?: string; next?: string; type?: string }> };

const loginErrors: Record<string, string> = {
  not_observer_account: "החשבון הזה אינו רשום למוצר התצפיתן הדיגיטלי.",
  observer_setup_required: "אימות המייל הצליח, אך הכנת חשבון התצפיתן טרם הושלמה. נסו להתחבר שוב; אם התקלה חוזרת, פנו לתמיכה.",
  email_not_confirmed: "כתובת המייל עדיין לא אומתה. אשרו את הקוד או את הקישור שנשלח למייל ואז נסו שוב.",
  invalid_login: "פרטי ההתחברות אינם נכונים. בדקו את כתובת המייל והסיסמה ונסו שוב.",
  confirmation_failed: "אימות המייל נכשל או שפג תוקף הקישור. בקשו קוד חדש."
};

export default async function DigitalObserverLoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialType = params?.type === "business" ? "business" : "home";
  return (
    <main className="do-auth-page" dir="rtl">
      <section className="do-auth-visual">
        <header className="do-auth-site-head">
          <Link className="do-auth-brand" href="/digital-observer"><ObserverMark /><span><b>תצפיתן דיגיטלי</b><small>שקט נפשי, ברגעים החשובים</small></span></Link>
          <nav aria-label="ניווט כניסה"><Link href="/digital-observer/pricing">מחיר ודוגמה</Link><Link href="/digital-observer/trust">אודות</Link><Link href="/digital-observer/trust#support">מרכז עזרה</Link></nav>
        </header>
        <div className="do-auth-hero-copy"><ObserverMark /><h1>תצפיתן דיגיטלי</h1><h2>שקט נפשי, בכל רגע</h2><p><span className="do-auth-copy-desktop">פלטפורמת מצלמות חכמה עם בינה מלאכותית להגנה על הבית והעסק.</span><span className="do-auth-copy-mobile">הבית שלכם, בשליטה מלאה.</span></p></div>
      </section>
      <section className="do-auth-form-wrap">
        <ObserverLoginForm
          initialType={initialType}
          nextPath={params?.next ?? "/digital-observer/dashboard"}
          registered={params?.registered === "check_email"}
          verified={params?.verified === "1"}
          passwordUpdated={params?.password_updated === "1"}
          verificationRequired={params?.registered === "check_email" || params?.error === "email_not_confirmed" || params?.error === "confirmation_failed"}
          initialError={params?.error ? loginErrors[params.error] ?? "לא הצלחנו להתחבר. בדקו את הפרטים ונסו שוב." : undefined}
        />
      </section>
      <section className="do-auth-benefits" aria-label="עקרונות המוצר"><span><MapPinned /><b>שליטה מכל מקום</b><small>גישה מאובטחת מכל מכשיר</small></span><span><LockKeyhole /><b>פרטיות מלאה</b><small>המידע נשאר בשליטתכם</small></span><span><ShieldCheck /><b>הגנה חכמה</b><small>ביקורת אנושית לפני החלטה</small></span></section>
      <footer className="do-auth-security-footer"><ShieldCheck /><span><b>האבטחה והפרטיות שלכם בראש סדר העדיפויות שלנו</b><small>פרטי חיבור רגישים אינם נשמרים בדפדפן, ושירותים חיים מופעלים רק לאחר חיבור מאושר.</small></span></footer>
      <ObserverAuthDevicePreview screen="login" />
    </main>
  );
}
