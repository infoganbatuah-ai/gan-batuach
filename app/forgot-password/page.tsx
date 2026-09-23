import Link from "next/link";
import { KeyRound, MailCheck, ShieldCheck } from "lucide-react";
import { AppAuthShell } from "@/components/app-auth-shell";
import { requestGanBatuachPasswordReset } from "@/app/forgot-password/actions";

export const metadata = {
  title: "שחזור סיסמה | גן בטוח",
  description: "מסך שחזור סיסמה והנחיות תמיכה למשתמשי גן בטוח."
};

type PageProps = { searchParams?: Promise<{ sent?: string; error?: string }> };

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <AppAuthShell eyebrow="שחזור גישה" title="שכחת סיסמה?" subtitle="הזינו את כתובת הדוא״ל וקבלו קישור חד־פעמי לקביעת סיסמה חדשה.">
      <section className="gb-recovery-card">
            <div className="gb-state-orb" aria-hidden="true"><KeyRound /></div>
            {params?.error === "invalid_link" ? <div className="error-banner">הקישור פג, כבר נוצל או אינו תקין. בקשו קישור חדש והשתמשו במייל האחרון בלבד.</div> : null}
            {params?.sent === "1" ? <div className="success-banner">אם קיים חשבון מתאים, נשלח אליו קישור שחזור. בדקו גם את תיקיות הספאם וקידומי המכירות.</div> : null}
            <form action={requestGanBatuachPasswordReset} className="form-grid gb-auth-single-form">
              <label className="full-width"><span>כתובת דוא״ל</span><input name="email" type="email" autoComplete="email" required dir="ltr" placeholder="name@example.com" /></label>
              <button className="button primary large" type="submit"><MailCheck size={18} /> שליחת קישור שחזור</button>
              <Link className="button secondary" href="/app/login">חזרה להתחברות</Link>
            </form>
            <p className="gb-safe-copy"><ShieldCheck /> מטעמי פרטיות, לא נגלה אם כתובת מסוימת רשומה במערכת.</p>
      </section>
    </AppAuthShell>
  );
}
