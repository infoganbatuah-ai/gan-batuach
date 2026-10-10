import Link from "next/link";
import type { ComponentProps } from "react";
import { Bell, ShieldCheck } from "lucide-react";
import { NotificationCenter } from "@/components/notification-center";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { RecruitmentTabs } from "@/components/recruitment-ui";
import { StaffAppFrame, StaffPageHero, StaffSection } from "@/components/staff-app-ui";
import { requireRole } from "@/lib/auth";
import { resolveStaffEmploymentContext } from "@/lib/management/staff-employment-context";
import { createClient } from "@/lib/supabase/server";

export default async function CandidateRecruitmentNotificationsPage() {
  const { profile } = await requireRole(["staff"]);
  const context = await resolveStaffEmploymentContext(profile);
  if (context.available && context.employments.length) {
    return <StaffAppFrame active="messages"><section className="ux08-state-card success"><ShieldCheck /><h1>ההעסקה כבר פעילה</h1><p>עדכוני העבודה זמינים במרכז ההתראות של צוות הגן.</p><Link className="button primary" href="/dashboard/staff/notifications">למרכז ההתראות</Link></section></StaffAppFrame>;
  }
  const supabase = await createClient();
  const { data } = await supabase.from("notifications" as never).select("*" as never).or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id}`).in("entity_type", ["staff_job_applications", "management_invitations", "staff_candidate_documents"]).order("created_at", { ascending: false }).limit(100);
  return <StaffAppFrame active="applications" mode="candidate" profileName={profile.full_name} avatarUrl={profile.profile_image_url}>
    <RecruitmentTabs active="applications" />
    <StaffPageHero eyebrow="עדכוני גיוס" title="מה חדש במסלול הקבלה?" text="בקשות מידע, החלטות והזמנות ששייכות לחשבון שלך בלבד." icon={Bell} badge={<StatusChip tone="info">מועמדות</StatusChip>} />
    <StaffSection title="עדכוני מועמדות והזמנות"><NotificationCenter notifications={(data ?? []) as ComponentProps<typeof NotificationCenter>["notifications"]} /></StaffSection>
  </StaffAppFrame>;
}
