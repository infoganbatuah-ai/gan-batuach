import { ObserverMark } from "@/components/digital-observer/observer-app-shell";
import { ObserverSetPasswordForm } from "@/components/digital-observer/observer-set-password-form";

export default function DigitalObserverSetPasswordPage() {
  return <main className="do-auth-page light" dir="rtl"><section className="do-auth-form-wrap wide"><div className="do-auth-card"><ObserverMark compact /><h1>הגדרת סיסמה למרכז הבקרה</h1><p>הקישור חד-פעמי. הסיסמה נשמרת ב-Supabase ואינה נכתבת בקוד או בדוחות.</p><ObserverSetPasswordForm /></div></section></main>;
}
