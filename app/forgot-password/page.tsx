import Link from "next/link";
import { KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { requestGanBatuachPasswordReset } from "@/app/forgot-password/actions";

export const metadata = {
  title: "שחזור סיסמה | גן בטוח",
  description: "מסך שחזור סיסמה והנחיות תמיכה למשתמשי גן בטוח."
};

type PageProps = { searchParams?: Promise<{ sent?: string; error?: string }> };

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <>
      <BrandHeader />
      <main className="section login-journey-page">
        <section className="login-hero compact-auth-hero">
          <div>
            <p className="eyebrow">שחזור גישה</p>
            <h1>שכחת סיסמה?</h1>
            <p>הזינו את כתובת הדוא״ל וקבלו קישור חד-פעמי לקביעת סיסמה חדשה.</p>
            {params?.error === "invalid_link" ? <div className="error-banner">הקישור פג, כבר נוצל או אינו תקין. בקשו קישור חדש והשתמשו במייל האחרון בלבד.</div> : null}
            {params?.sent === "1" ? <div className="success-banner">אם קיים חשבון מתאים, נשלח אליו קישור שחזור. בדקו גם את תיקיות הספאם וקידומי המכירות.</div> : null}
            <form action={requestGanBatuachPasswordReset} className="form-grid">
              <label className="full-width"><span>דוא״ל</span><input name="email" type="email" autoComplete="email" required /></label>
              <button className="button primary" type="submit"><MailCheck size={18} /> שליחת קישור שחזור</button>
              <Link className="button secondary" href="/login">חזרה להתחברות</Link>
            </form>
          </div>
          <div className="card action-panel auth-readiness-card">
            <KeyRound />
            <h2>קישור אישי וחד-פעמי</h2>
            <p>מטעמי פרטיות המסך אינו מגלה אם כתובת מסוימת רשומה במערכת.</p>
            <span className="pill good"><ShieldCheck size={14} /> Supabase Auth</span>
          </div>
        </section>
      </main>
    </>
  );
}
