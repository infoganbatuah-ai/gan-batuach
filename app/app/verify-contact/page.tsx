import { ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { ContactVerificationForm } from "@/components/auth/contact-verification-form";
import { getSessionProfile } from "@/lib/auth";
import { managementContactVerification, maskContact } from "@/lib/management/contact-verification";

export const metadata = {
  title: "אימות פרטי קשר | גן בטוח",
  description: "אימות דוא״ל וטלפון לחשבון גן בטוח."
};

export default async function VerifyContactPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const { user, profile } = await getSessionProfile();
  const state = user && profile ? managementContactVerification(user, profile) : null;
  const initialStatus = state ? { ...state, email: maskContact(user?.email), phone: maskContact(user?.phone) } : null;
  return <><BrandHeader /><main className="section login-journey-page"><section className="login-hero compact-auth-hero"><div><p className="eyebrow">אבטחת החשבון</p><h1>אימות דוא״ל וטלפון</h1><p>אימות שני פרטי הקשר נדרש לפני פתיחת גישה תפעולית לחשבונות חדשים.</p><ContactVerificationForm initialStatus={initialStatus} nextPath={safeNext} /></div><div className="card action-panel auth-readiness-card"><ShieldCheck /><h2>גישה לפי זהות מאומתת</h2><p>הקודים נבדקים בשרת באמצעות Supabase Auth. המערכת אינה שומרת קוד חד־פעמי ואינה חושפת אם כתובת לא מוכרת רשומה.</p></div></section></main></>;
}
