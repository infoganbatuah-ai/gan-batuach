import { redirect } from "next/navigation";
import { ClipboardCheck, UserCheck } from "lucide-react";
import { BrandHeader } from "@/components/brand-header";
import { PremiumDashboardHero } from "@/components/premium-dashboard";
import { StaffOnboardingForm } from "@/components/staff-onboarding-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffOnboardingPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const { data: staff } = await supabase
    .from("staff" as any)
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (!staff) redirect("/login");
  const { data: onboarding } = await supabase
    .from("staff_onboarding_records" as any)
    .select("*")
    .eq("staff_id", staff.id)
    .maybeSingle();
  if (staff.approved_to_work || staff.onboarding_status === "active") redirect("/dashboard/staff");
  const waiting = staff.onboarding_status === "pending_verification";

  return (
    <>
      <BrandHeader />
      <main className="section kindergarten-onboarding-page">
        <PremiumDashboardHero
          eyebrow="קליטת צוות"
          title="מסיימים כמה פרטים קצרים."
          subtitle="הפרטים נשמרים, המנהלת בודקת, ואז נפתח ממשק הצוות."
          badge={waiting ? "ממתין לאישור" : staff.onboarding_status === "correction_required" ? "נדרש תיקון" : "בתהליך"}
          badgeTone={waiting ? "warn" : "good"}
        >
          <div className="onboarding-hero-icon"><ClipboardCheck /><UserCheck /></div>
        </PremiumDashboardHero>
        {waiting ? (
          <section className="card onboarding-waiting-card">
            <p className="eyebrow">נשלח לבדיקה</p>
            <h2>הפרטים אצל המנהלת.</h2>
            <p>נעדכן אותך כאן אם נדרש תיקון או כשהחשבון יאושר.</p>
            <div className="onboarding-progress-ring"><strong>{Number(onboarding?.progress_percent ?? 100)}%</strong><span><i style={{ width: `${Number(onboarding?.progress_percent ?? 100)}%` }} /></span></div>
          </section>
        ) : (
          <StaffOnboardingForm staff={staff} onboarding={onboarding ?? { progress_percent: 0, missing_items: [] }} />
        )}
      </main>
    </>
  );
}
