import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";
import { signIn } from "@/app/login/actions";

type PageProps = { searchParams?: Promise<{ error?: string; registered?: string; verified?: string; next?: string }> };

const loginErrors: Record<string, string> = {
  not_observer_account: "החשבון הזה אינו רשום למוצר התצפיתן הדיגיטלי.",
  observer_setup_required: "אימות המייל הצליח, אך יש להחיל את מיגרציית חשבון התצפיתן לפני ההתחברות.",
  confirmation_failed: "אימות המייל נכשל או שפג תוקף הקישור. בקשו קוד חדש."
};

export default async function DigitalObserverLoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
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
          {params?.registered === "check_email" ? (
            <div className="do-notice good">
              <ShieldCheck />
              <span>ההרשמה נקלטה. יש לאשר את כתובת הדוא״ל ואז להתחבר.</span>
            </div>
          ) : null}
          {params?.verified === "1" ? <div className="do-notice good" role="status"><ShieldCheck /><span>כתובת המייל אומתה בהצלחה. אפשר להתחבר ולהמשיך את הקמת התצפיתן.</span></div> : null}
          {params?.error ? <div className="do-notice bad" role="alert"><LockKeyhole /><span>{loginErrors[params.error] ?? "לא הצלחנו להתחבר. בדקו את הפרטים ונסו שוב."}</span></div> : null}
          <input type="hidden" name="auth_source" value="observer" />
          <input type="hidden" name="next" value={params?.next ?? "/digital-observer/dashboard"} />
          <label className="do-field"><span>דוא״ל</span><input name="email" type="email" autoComplete="email" required /></label>
          <label className="do-field"><span>סיסמה</span><input name="password" type="password" autoComplete="current-password" required /></label>
          <button className="do-button primary full" type="submit">התחברות</button>
          <Link className="do-button secondary full" href="/digital-observer/verify">אימות קוד או שליחה חוזרת</Link>
          <p className="do-auth-switch">אין לכם חשבון? <Link href="/digital-observer/register">יצירת חשבון</Link></p>
          <Link className="do-link" href="/digital-observer">חזרה לאתר התצפיתן</Link>
        </form>
      </section>
    </main>
  );
}
