import Link from "next/link";
import { KeyRound } from "lucide-react";
import { AppAuthShell } from "@/components/app-auth-shell";
import { PasswordUpdateForm } from "@/components/auth/password-update-form";

export const metadata = {
  title: "קביעת סיסמה חדשה | גן בטוח",
  description: "מסך מאובטח לקביעת סיסמה חדשה באמצעות קישור חד-פעמי."
};

export default function ResetPasswordPage() {
  return (
    <AppAuthShell eyebrow="שחזור גישה" title="קביעת סיסמה חדשה" subtitle="בחרו סיסמה חדשה. לאחר השמירה קישור השחזור ייסגר ותידרשו להתחבר מחדש.">
      <section className="gb-recovery-card">
        <div className="gb-state-orb" aria-hidden="true"><KeyRound /></div>
        <PasswordUpdateForm product="gan_batuach" loginHref="/app/login" requestHref="/forgot-password" />
        <p className="gb-safe-copy">הסיסמה נשמרת בשירות Auth המאובטח ואינה מוצגת בדוחות או למנהלי המערכת.</p>
        <p><Link href="/app/login">חזרה להתחברות</Link></p>
      </section>
    </AppAuthShell>
  );
}
