import Link from "next/link";
import { KeyRound, ShieldAlert } from "lucide-react";

export const metadata = {
  title: "קישור שחזור אינו תקף",
  robots: { index: false, follow: false }
};

export default function RecoveryInvalidPage() {
  return (
    <main className="do-auth-page light" dir="rtl">
      <section className="do-auth-form-wrap wide">
        <div className="do-auth-card do-verify-card">
          <ShieldAlert className="do-verify-icon" aria-hidden="true" />
          <h1>קישור השחזור אינו זמין</h1>
          <p>הקישור כבר נוצל, פג תוקף או אינו תקין. בחרו את המוצר שבו נרשמתם כדי לקבל קישור חד-פעמי חדש.</p>
          <div className="do-page-stack">
            <Link className="do-button primary full" href="/digital-observer/forgot-password?error=invalid_link"><KeyRound /> שחזור בתצפיתן הדיגיטלי</Link>
            <Link className="do-button secondary full" href="/forgot-password?error=invalid_link">שחזור בגן בטוח</Link>
          </div>
          <div className="do-notice info"><span>המערכת אינה חושפת באיזה מוצר קיים החשבון ואינה מעבירה משתמש אוטומטית בין המוצרים.</span></div>
        </div>
      </section>
    </main>
  );
}
