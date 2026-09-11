import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Bell, ClipboardCheck, ShieldCheck } from "lucide-react";
import { KindergartenOnboardingForm, ManagerKindergartenApplicationForm } from "@/components/kindergarten-onboarding-form";
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
          <span className="teacher-icon-button" aria-label="התראות הקמת הגן" role="img">
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

export default async function KindergartenOnboardingPage({ searchParams }: { searchParams: Promise<{ gardenId?: string; new?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const query = await searchParams;
  const sessionClient = await createClient();
  const targetGardenId = query.gardenId ?? (query.new === "1" ? null : profile.garden_id);
  const supabase = isAdminClientConfigured() ? createAdminClient() : sessionClient;
  if (!targetGardenId) {
    return (
      <KindergartenOnboardingShell
        title="רישום גן ילדים"
        subtitle="משלימים את פרטי הגן ברצף, מתחילים 14 ימי ניסיון ונכנסים לדשבורד — ללא המתנה לאישור אדמין."
        badge="רישום רציף"
        badgeTone="green"
        managerName={profile.full_name}
      >
        <ManagerKindergartenApplicationForm managerName={profile.full_name} managerPhone={profile.phone} managerEmail={(profile as any).email} profileRole={profile.role} />
        <Link className="kindergarten-app-logout" href="/api/auth/logout">יציאה</Link>
      </KindergartenOnboardingShell>
    );
  }
  const authority = await sessionClient.rpc("can_edit_garden_onboarding" as never, { target_garden_id: targetGardenId } as never);
  if (authority.error || authority.data !== true) redirect("/dashboard/garden");
  const [{ data: garden }, onboardingRes] = await Promise.all([
    supabase
      .from("gardens" as any)
      .select("id, name, logo_url, image_url, address, phone, email, owner_name, public_description, approval_flow_status, admin_correction_note")
      .eq("id", targetGardenId)
      .maybeSingle(),
    supabase
      .from("kindergarten_onboarding_records" as any)
      .select("*")
      .eq("garden_id", targetGardenId)
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
  return (
    <KindergartenOnboardingShell
      title="משלימים את הקמת הגן"
      subtitle="חמישה שלבים רציפים. אפשר לדלג על הזמנת הורים וילדים ולחזור אליה מהדשבורד."
      badge={onboarding.lifecycle_status === "correction_required" ? "נדרש תיקון" : "בתהליך"}
      badgeTone={onboarding.lifecycle_status === "correction_required" ? "orange" : "green"}
      managerName={profile.full_name}
    >
        <KindergartenOnboardingForm garden={(garden ?? {}) as any} onboarding={onboarding} managerName={profile.full_name} />
        <Link className="kindergarten-app-logout" href="/api/auth/logout">יציאה</Link>
    </KindergartenOnboardingShell>
  );
}
