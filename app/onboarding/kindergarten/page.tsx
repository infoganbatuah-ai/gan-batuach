import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Bell, ClipboardCheck, ShieldCheck } from "lucide-react";
import { KindergartenOnboardingForm, KindergartenSubscriptionActivationPanel, ManagerKindergartenApplicationForm } from "@/components/kindergarten-onboarding-form";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function KindergartenOnboardingShell({
  children,
  title,
  subtitle,
  badge,
  badgeTone = "blue",
  managerName
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
  badge: string;
  badgeTone?: "blue" | "green" | "orange" | "red";
  managerName?: string | null;
}) {
  return (
    <main className="kindergarten-app-onboarding" dir="rtl">
      <section className="kindergarten-app-onboarding-shell">
        <div className="kindergarten-app-logo" aria-label="גן בטוח">
          <Image src="/assets/company-name.png" alt="גן בטוח" width={236} height={74} />
          <Image src="/assets/company-symbol.png" alt="" width={74} height={74} />
        </div>
        <header className="kindergarten-app-onboarding-header">
          <span className="teacher-icon-button" aria-label="התראות זמינות לאחר אישור הגן" role="img">
            <Bell size={24} />
            <span />
          </span>
          <div className="teacher-app-greeting">
            <div className="teacher-avatar"><span>{managerName?.slice(0, 1) ?? "מ"}</span><i /></div>
            <div>
              <h1>בוקר טוב, {managerName?.split(" ")[0] ?? "מאיה"}</h1>
              <p>הקמת גן בטוח</p>
            </div>
          </div>
        </header>
        <section className="kindergarten-app-onboarding-hero">
          <div>
            <span className={`kindergarten-app-badge ${badgeTone}`}>{badge}</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <div className="kindergarten-app-hero-icon"><ClipboardCheck /><ShieldCheck /></div>
        </section>
        {children}
      </section>
    </main>
  );
}

export default async function KindergartenOnboardingPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = !profile.active && isAdminClientConfigured() ? createAdminClient() : await createClient();
  if (!profile.garden_id) {
    return (
      <KindergartenOnboardingShell
        title="פותחים בקשת גן מוגבלת"
        subtitle="השלב הראשון יוצר טיוטת גן בלבד. אין גישה לנתוני ילדים, צוות, הורים או מסמכים פנימיים עד אישור ותשלום."
        badge="חשבון מוגבל"
        badgeTone="orange"
        managerName={profile.full_name}
      >
        <ManagerKindergartenApplicationForm managerName={profile.full_name} managerPhone={profile.phone} managerEmail={(profile as any).email} />
        <Link className="kindergarten-app-logout" href="/api/auth/logout">יציאה</Link>
      </KindergartenOnboardingShell>
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
    <KindergartenOnboardingShell
      title="מכינים את הגן לאישור"
      subtitle="ממלאים פרטים, מוסיפים תמונות ושולחים לבדיקה קצרה."
      badge={onboarding.lifecycle_status === "correction_required" ? "נדרש תיקון" : "בתהליך"}
      badgeTone={onboarding.lifecycle_status === "correction_required" ? "orange" : "green"}
      managerName={profile.full_name}
    >
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
        <Link className="kindergarten-app-logout" href="/api/auth/logout">יציאה</Link>
    </KindergartenOnboardingShell>
  );
}
