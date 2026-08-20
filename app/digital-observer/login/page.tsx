import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";
import { signIn } from "@/app/login/actions";

function shouldSkipDigitalObserverEmailConfirmation() {
  return (
    process.env.DIGITAL_OBSERVER_SKIP_EMAIL_CONFIRMATION === "true" &&
    process.env.NODE_ENV !== "production"
  ) || process.env.NEXT_PUBLIC_SANDBOX_MODE === "true" || process.env.APP_ENV === "demo" || process.env.APP_ENV === "local";
}

type PageProps = { searchParams?: Promise<{ error?: string; registered?: string; next?: string }> };

export default async function DigitalObserverLoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const skipEmailConfirmation = shouldSkipDigitalObserverEmailConfirmation();
  return (
    <main className="do-auth-page" dir="rtl">
      <section className="do-auth-visual">
        <Link className="do-auth-brand" href="/digital-observer"><ObserverMark /><span><b>תצפיתן דיגיטלי</b><small>שקט נפשי, ברגעים החשובים</small></span></Link>
        <div><ShieldCheck /><h1>המצלמות שלך. התובנות שלך.</h1><p>חיבור מאובטח, התראות מדורגות וביקורת אנושית לפני קביעה.</p></div>
        <ul><li>פרטי מצלמה נשארים בצד השרת</li><li>אין חיוב או שליחה חיצונית בסביבת הדמו</li><li>כל אתר מופרד בהרשאות</li></ul>
      </section>
      <section className="do-auth-form-wrap">
        <form action={signIn} className="do-auth-card">
          <ObserverMark compact />
          <h2>ברוכים הבאים</h2>
          <p>היכנסו לחשבון התצפיתן הדיגיטלי שלכם</p>
          {params?.registered === "check_email" && !skipEmailConfirmation ? (
            <div className="do-notice good">
              <ShieldCheck />
              <span>ההרשמה נקלטה. יש לאשר את כתובת הדוא״ל ואז להתחבר.</span>
            </div>
          ) : null}
          {params?.error ? <div className="do-notice bad" role="alert"><LockKeyhole /><span>לא הצלחנו להתחבר. בדקו את הפרטים ונסו שוב.</span></div> : null}
          <input type="hidden" name="auth_source" value="observer" />
          <input type="hidden" name="next" value={params?.next ?? "/digital-observer/dashboard"} />
          <label className="do-field"><span>דוא״ל</span><input name="email" type="email" autoComplete="email" required /></label>
          <label className="do-field"><span>סיסמה</span><input name="password" type="password" autoComplete="current-password" required /></label>
          <button className="do-button primary full" type="submit">התחברות</button>
          <p className="do-auth-switch">אין לכם חשבון? <Link href="/digital-observer/register">יצירת חשבון</Link></p>
          <Link className="do-link" href="/digital-observer">חזרה לאתר התצפיתן</Link>
        </form>
      </section>
    </main>
  );
}
