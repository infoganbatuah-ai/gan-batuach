import { Heart, Mail } from "lucide-react";
import { AppAuthShell } from "@/components/app-auth-shell";
import { ContactVerificationForm } from "@/components/auth/contact-verification-form";
import { getSessionProfile } from "@/lib/auth";
import { managementContactVerification, maskContact } from "@/lib/management/contact-verification";

export const metadata = {
  title: "אימות פרטי קשר | גן בטוח",
  description: "אימות דוא״ל לחשבון גן בטוח."
};

export default async function VerifyContactPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const { user, profile } = await getSessionProfile();
  const state = user && profile ? managementContactVerification(user, profile) : null;
  const initialStatus = state ? { ...state, email: maskContact(user?.email), phone: maskContact(user?.phone) } : null;
  return (
    <AppAuthShell eyebrow="שלב 3 מתוך 4" title="אימות כתובת דוא״ל" subtitle="שלחנו קישור אימות לכתובת שלך. לחיצה על הקישור תאמת את החשבון ותאפשר להמשיך.">
      <section className="gb-email-verification-card">
        <div className="gb-mail-illustration" aria-hidden="true"><Mail /><span><Heart fill="currentColor" /></span></div>
        <ContactVerificationForm initialStatus={initialStatus} nextPath={safeNext} />
        <p className="gb-verification-policy">אימות דוא״ל מספיק להפעלת חשבון רגיל. הטלפון יכול להישאר במצב לא מאומת עד לפעולה שדורשת אימות נוסף.</p>
      </section>
    </AppAuthShell>
  );
}
