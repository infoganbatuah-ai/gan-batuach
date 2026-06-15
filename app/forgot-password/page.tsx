import Link from "next/link";
import { MailCheck, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";

export const metadata = {
  title: "שחזור סיסמה | גן בטוח",
  description: "מסך שחזור סיסמה והנחיות תמיכה למשתמשי גן בטוח."
};

export default function ForgotPasswordPage() {
  return (
    <>
      <BrandHeader />
      <main className="section login-journey-page">
        <section className="login-hero compact-auth-hero">
          <div>
            <p className="eyebrow">שחזור גישה</p>
            <h1>שכחת סיסמה?</h1>
            <p>שחזור סיסמה מאובטח יופעל דרך ספק המייל של המערכת. אם עדיין לא הוגדר ספק מייל, פנו למנהל המערכת או לצוות התמיכה.</p>
            <div className="profile-actions">
              <Link className="button primary" href="/login">חזרה להתחברות</Link>
              <Link className="button secondary" href="/app">כניסה למערכת</Link>
            </div>
          </div>
          <div className="card action-panel auth-readiness-card">
            <MailCheck />
            <h2>מוכן להפעלה עם ספק מייל</h2>
            <p>לא נשלח מייל אמיתי אם ספק ההודעות לא מוגדר במצב ייצור.</p>
            <span className="pill warn"><ShieldCheck size={14} /> Provider readiness</span>
          </div>
        </section>
      </main>
    </>
  );
}
