import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { KindergartenOnboardingForm, KindergartenSubscriptionActivationPanel, ManagerKindergartenApplicationForm } from "@/components/kindergarten-onboarding-form";
import { PremiumDashboardHero } from "@/components/premium-dashboard";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export default async function KindergartenOnboardingPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = !profile.active && isAdminClientConfigured() ? createAdminClient() : await createClient();
  if (!profile.garden_id) {
    return (
      <>
        <BrandHeader />
        <main className="section kindergarten-onboarding-page">
          <PremiumDashboardHero
            eyebrow="רישום מנהלת"
            title="פותחים בקשת גן מוגבלת."
            subtitle="השלב הראשון יוצר טיוטת גן בלבד. אין גישה לנתוני ילדים, צוות, הורים או מסמכים פנימיים עד אישור ותשלום."
            badge="חשבון מוגבל"
            badgeTone="warn"
            actions={<Link className="button secondary" href="/api/auth/logout">יציאה</Link>}
          >
            <div className="onboarding-hero-icon"><ClipboardCheck /><ShieldCheck /></div>
          </PremiumDashboardHero>
          <ManagerKindergartenApplicationForm managerName={profile.full_name} managerPhone={profile.phone} managerEmail={(profile as any).email} />
        </main>
      </>
    );
  }
  const [{ data: garden }, onboardingRes] = await Promise.all([
    supabase
      .from("gardens" as any)
      .select("id, name, logo_url, image_url, address, phone, email, owner_name, public_description, approval_flow_status, admin_correction_note")
      .eq("id", profile.garden_id)
      .maybeSingle(),
    supabase
      .from("kindergarten_onboarding_records" as any)
      .select("*")
      .eq("garden_id", profile.garden_id)
      .maybeSingle()
  ]);
  const onboarding = (onboardingRes.data ?? {
    lifecycle_status: garden?.approval_flow_status ?? "credentials_sent",
    progress_percent: 0,
    missing_fields: [],
    profile_data: {},
    correction_note: garden?.admin_correction_note ?? null
  }) as any;

  if (onboarding.lifecycle_status === "active" || garden?.approval_flow_status === "active") {
    redirect("/dashboard/garden");
  }
  const isWaitingForAdmin = ["onboarding_submitted", "pending_final_approval"].includes(String(onboarding.lifecycle_status ?? garden?.approval_flow_status ?? ""));
  const isPaymentPending = String(onboarding.lifecycle_status ?? garden?.approval_flow_status ?? "") === "payment_pending";

  if (isPaymentPending) {
    return <KindergartenSubscriptionActivationPanel gardenName={garden?.name} managerName={profile.full_name} monthlyAmount={Number(onboarding.subscription_monthly_amount ?? onboarding.profile_data?.subscription_monthly_amount ?? 800)} />;
  }

  return (
    <>
      <BrandHeader />
      <main className="section kindergarten-onboarding-page">
        <PremiumDashboardHero
          eyebrow="השלמת גן"
          title="מכינים את הגן לאישור."
          subtitle="ממלאים פרטים, מוסיפים תמונות ושולחים לבדיקה קצרה."
          badge={onboarding.lifecycle_status === "correction_required" ? "נדרש תיקון" : "בתהליך"}
          badgeTone={onboarding.lifecycle_status === "correction_required" ? "warn" : "good"}
          actions={<Link className="button secondary" href="/api/auth/logout">יציאה</Link>}
        >
          <div className="onboarding-hero-icon"><ClipboardCheck /><ShieldCheck /></div>
        </PremiumDashboardHero>
        {isWaitingForAdmin ? (
          <section className="card onboarding-waiting-card">
            <p className="eyebrow">נשלח לאישור</p>
            <h2>הפרופיל אצל האדמין.</h2>
            <p>נעדכן אותך כאן ברגע שהגן יאושר או אם יהיה צורך בתיקון.</p>
            <div className="onboarding-progress-ring"><strong>{Number(onboarding.progress_percent ?? 100)}%</strong><span><i style={{ width: `${Number(onboarding.progress_percent ?? 100)}%` }} /></span></div>
          </section>
        ) : (
          <KindergartenOnboardingForm garden={(garden ?? {}) as any} onboarding={onboarding} managerName={profile.full_name} />
        )}
      </main>
    </>
  );
}
