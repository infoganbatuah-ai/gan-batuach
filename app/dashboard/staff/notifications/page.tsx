import { Bell } from "lucide-react";
import { NotificationCenter } from "@/components/notification-center";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffPageHero, StaffSection } from "@/components/staff-app-ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function StaffNotificationsPage() {
  const { profile } = await requireRole(["staff"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications" as any)
    .select("*")
    .or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id}`)
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <StaffAppFrame active="messages">
      <StaffPageHero eyebrow="עדכוני צוות" title="מה חדש במשמרת?" text="משימות, הודעות מנהלת, מסמכים חסרים ואירועים שהוקצו." icon={Bell} badge={<StatusChip tone="success">צוות</StatusChip>} />
      <StaffSection title="מרכז התראות">
        <NotificationCenter notifications={(data ?? []) as any[]} />
      </StaffSection>
    </StaffAppFrame>
  );
}
