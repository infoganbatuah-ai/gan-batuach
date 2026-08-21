import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";
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
        <Link className="do-auth-brand" href="/digital-observer"><ObserverMark /><span><b>תצפיתן דיגיטלי</b><small>שקט נפשי, ברגעים החשובים</small></span></Link>
        <div><ShieldCheck /><h1>המצלמות שלך. התובנות שלך.</h1><p>חיבור מאובטח, התראות מדורגות וביקורת אנושית לפני קביעה.</p></div>
        <ul><li>פרטי מצלמה נשארים בצד השרת</li><li>אין חיוב או שליחה חיצונית בסביבת הדמו</li><li>כל אתר מופרד בהרשאות</li></ul>
      </section>
      <section className="do-auth-form-wrap">
        <ObserverLoginForm
          initialType={initialType}
          nextPath={params?.next ?? "/digital-observer/dashboard"}
          registered={params?.registered === "check_email"}
          verified={params?.verified === "1"}
          passwordUpdated={params?.password_updated === "1"}
          initialError={params?.error ? loginErrors[params.error] ?? "לא הצלחנו להתחבר. בדקו את הפרטים ונסו שוב." : undefined}
        />
      </section>
    </main>
  );
}
