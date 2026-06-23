import { redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffPageHero, StaffSection } from "@/components/staff-app-ui";
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
    <StaffAppFrame mode="candidate" active="profile" avatarUrl={staff.profile_photo_url}>
        <StaffPageHero
          eyebrow="קליטת צוות"
          title="מסיימים כמה פרטים קצרים"
          text="הפרטים נשמרים, המנהלת בודקת, ואז נפתח ממשק הצוות."
          icon={ClipboardCheck}
          badge={<StatusChip tone={waiting ? "warning" : staff.onboarding_status === "correction_required" ? "danger" : "success"}>{waiting ? "ממתין לאישור" : staff.onboarding_status === "correction_required" ? "נדרש תיקון" : "בתהליך"}</StatusChip>}
        />
        {waiting ? (
          <StaffSection title="בקשה בבדיקה">
          <section className="card onboarding-waiting-card">
            <p className="eyebrow">נשלח לבדיקה</p>
            <h2>הפרטים אצל המנהלת.</h2>
            <p>נעדכן אותך כאן אם נדרש תיקון או כשהחשבון יאושר.</p>
            <div className="onboarding-progress-ring"><strong>{Number(onboarding?.progress_percent ?? 100)}%</strong><span><i style={{ width: `${Number(onboarding?.progress_percent ?? 100)}%` }} /></span></div>
          </section>
          </StaffSection>
        ) : (
          <StaffOnboardingForm staff={staff} onboarding={onboarding ?? { progress_percent: 0, missing_items: [] }} />
        )}
    </StaffAppFrame>
  );
}
