import Link from "next/link";
import { cookies } from "next/headers";
import { KeyRound, MailCheck, RotateCw, ShieldCheck } from "lucide-react";
import { ObserverMark } from "@/components/digital-observer/observer-app-shell";
import { resendDigitalObserverVerification, verifyDigitalObserverEmailCode } from "@/app/digital-observer/auth-actions";

type PageProps = { searchParams?: Promise<{ error?: string; resent?: string }> };

const errorMessages: Record<string, string> = {
  missing_email: "לא נמצאה כתובת הדוא״ל של ההרשמה. יש להירשם מחדש.",
  invalid_code: "קוד האימות אינו תקין או שפג תוקפו. בדקו את הקוד או בקשו קוד חדש.",
  email_not_authorized: "שירות המייל המובנה של Supabase אינו מורשה לשלוח לכתובת הזו. יש לחבר SMTP מותאם לפני שליחה חוזרת.",
  email_rate_limited: "הגענו למגבלת השליחה. המתינו לפני ניסיון נוסף או חברו SMTP מותאם.",
  supabase_configuration_error: "מפתח החיבור של Supabase בסביבת האתר אינו תקין. יש לעדכן את משתני הסביבה לפני ניסיון נוסף.",
  email_delivery_failed: "Supabase קיבל את הבקשה, אך ספק המייל לא הצליח לשלוח את הקוד. יש להשלים חיבור SMTP ולנסות שוב.",
  account_setup_failed: "המייל אומת, אך הכנת חשבון התצפיתן לא הושלמה. נסו להתחבר שוב."
};

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`;
}

export default async function DigitalObserverVerifyPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const pendingEmail = cookieStore.get("do_pending_email")?.value ?? "";

  return (
    <main className="do-auth-page light" dir="rtl">
      <section className="do-auth-form-wrap wide">
        <div className="do-auth-card do-verify-card">
          <Link className="do-auth-brand dark" href="/digital-observer"><ObserverMark /><span><b>תצפיתן דיגיטלי</b><small>אימות חשבון עצמאי</small></span></Link>
          <MailCheck className="do-verify-icon" aria-hidden="true" />
          <h1>אימות כתובת הדוא״ל</h1>
          <p>{pendingEmail ? <>בקשת אימות נקלטה עבור <strong dir="ltr">{maskEmail(pendingEmail)}</strong>. הקוד יישלח רק אם זו כתובת חדשה, SMTP זמין ולא נחסמה מגבלת שליחה.</> : "הזינו את כתובת המייל ואת קוד האימות שקיבלתם."}</p>
          {params?.error ? <div className="do-notice bad" role="alert"><ShieldCheck /><span>{errorMessages[params.error] ?? errorMessages.invalid_code}</span></div> : null}
          {params?.resent === "1" ? <div className="do-notice good" role="status"><MailCheck /><span>בקשת שליחה חוזרת נקלטה. אם החשבון עדיין ממתין לאימות, השתמשו בקוד האחרון שיגיע.</span></div> : null}
          <form action={verifyDigitalObserverEmailCode} className="do-verify-form">
            {!pendingEmail ? <label className="do-field"><span>דוא״ל</span><input name="email" type="email" autoComplete="email" required /></label> : <input type="hidden" name="email" value={pendingEmail} />}
            <label className="do-field"><span>קוד אימות</span><input className="do-otp-input" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" minLength={6} maxLength={8} placeholder="000000" required /></label>
            <button className="do-button primary full" type="submit"><KeyRound /> אימות והמשך להתחברות</button>
          </form>
          <form action={resendDigitalObserverVerification}>
            {!pendingEmail ? <label className="do-field"><span>דוא״ל לשליחה חוזרת</span><input name="email" type="email" autoComplete="email" required /></label> : <input type="hidden" name="email" value={pendingEmail} />}
            <button className="do-button secondary full" type="submit"><RotateCw /> שליחת קוד חדש</button>
          </form>
          <p className="do-auth-switch">כבר אימתם? <Link href="/digital-observer/login">מעבר להתחברות</Link></p>
        </div>
      </section>
    </main>
  );
}
