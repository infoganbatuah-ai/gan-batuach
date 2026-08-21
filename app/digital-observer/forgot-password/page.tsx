import Link from "next/link";
import { KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import { requestDigitalObserverPasswordReset } from "@/app/digital-observer/auth-actions";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";

type PageProps = { searchParams?: Promise<{ sent?: string; error?: string }> };

export default async function DigitalObserverForgotPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sent = params?.sent === "1";
  const invalidLink = params?.error === "invalid_link";

  return (
    <main className="do-auth-page light" dir="rtl">
      <section className="do-auth-form-wrap wide">
        <div className="do-auth-card do-verify-card">
          <Link className="do-auth-brand dark" href="/digital-observer"><ObserverMark /><span><b>תצפיתן דיגיטלי</b><small>שחזור גישה מאובטח</small></span></Link>
          <KeyRound className="do-verify-icon" aria-hidden="true" />
          <h1>איפוס סיסמה</h1>
          <p>הזינו את כתובת הדוא״ל. מטעמי פרטיות נקבל תמיד את הבקשה באותה צורה, בלי לחשוף אם קיים חשבון.</p>
          {invalidLink ? <div className="do-notice warn" role="alert"><ShieldCheck /><span>הקישור פג, כבר נוצל או אינו תקין. בקשו קישור חדש והשתמשו במייל האחרון בלבד.</span></div> : null}
          {sent ? <div className="do-notice good" role="status"><MailCheck /><span>אם קיים חשבון מתאים, נשלח אליו קישור חד-פעמי. בדקו גם את תיקיות הספאם וקידומי המכירות.</span></div> : null}
          <form action={requestDigitalObserverPasswordReset} className="do-verify-form">
            <label className="do-field"><span>דוא״ל</span><input name="email" type="email" autoComplete="email" required /></label>
            <button className="do-button primary full" type="submit"><MailCheck /> שליחת קישור חדש</button>
          </form>
          <div className="do-notice info"><ShieldCheck /><span>הקישור מיועד לשימוש חד-פעמי ומוביל רק למסך קביעת הסיסמה של התצפיתן.</span></div>
          <p className="do-auth-switch"><Link href="/digital-observer/login">חזרה להתחברות</Link></p>
        </div>
      </section>
    </main>
  );
}
