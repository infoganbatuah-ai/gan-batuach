import Link from "next/link";
import { KeyRound } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { PasswordUpdateForm } from "@/components/auth/password-update-form";

export const metadata = {
  title: "קביעת סיסמה חדשה | גן בטוח",
  description: "מסך מאובטח לקביעת סיסמה חדשה באמצעות קישור חד-פעמי."
};

export default function ResetPasswordPage() {
  return <><BrandHeader /><main className="section login-journey-page"><section className="login-hero compact-auth-hero"><div><p className="eyebrow">שחזור גישה</p><h1>קביעת סיסמה חדשה</h1><p>בחרו סיסמה חדשה. לאחר השמירה הפעלת השחזור תיסגר ותידרשו להתחבר מחדש.</p><PasswordUpdateForm product="gan_batuach" loginHref="/login" requestHref="/forgot-password" /><p><Link href="/login">חזרה להתחברות</Link></p></div><div className="card action-panel auth-readiness-card"><KeyRound /><h2>קישור חד-פעמי</h2><p>הסיסמה נשמרת ב-Supabase ואינה מוצגת לקודקס, בדוחות או למנהל המערכת.</p></div></section></main></>;
}
