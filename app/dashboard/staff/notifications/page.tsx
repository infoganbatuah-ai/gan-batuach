import { Bell } from "lucide-react";
import { NotificationCenter } from "@/components/notification-center";
import { NotificationPreferencesPanel, type NotificationPreferences } from "@/components/parent-notification-preferences";
import { StatusChip } from "@/components/gan-batuach-design-system";
import { StaffAppFrame, StaffPageHero, StaffSection } from "@/components/staff-app-ui";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";
import { managementDeliveryCapability } from "@/lib/management/external-delivery";

export default async function StaffNotificationsPage() {
  const { profile } = await requireOperationalRole(["staff"]);
  const supabase = await createClient();
  const [notificationsRes, preferencesRes, pushPreferencesRes] = await Promise.all([
    supabase.from("notifications" as any).select("*").or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id}`).order("created_at", { ascending: false }).limit(100),
    supabase.from("communication_preferences" as never).select("*").eq("profile_id", profile.id).maybeSingle(),
    supabase.from("push_category_preferences" as never).select("category,enabled").eq("profile_id", profile.id)
  ]);
  const pushCategoryPreferences = Object.fromEntries(((pushPreferencesRes.data ?? []) as Array<{ category: string; enabled: boolean }>).map((row) => [row.category, row.enabled]));
  return <StaffAppFrame active="messages"><StaffPageHero eyebrow="עדכוני צוות" title="מה חדש במשמרת?" text="משימות, הודעות מנהלת, מסמכים חסרים ואירועים שהוקצו." icon={Bell} badge={<StatusChip tone="success">צוות</StatusChip>} /><StaffSection title="מרכז התראות"><NotificationCenter notifications={(notificationsRes.data ?? []) as any[]} /></StaffSection><StaffSection title="העדפות ושעות שקט"><NotificationPreferencesPanel preferences={preferencesRes.data as NotificationPreferences | null} pushCategoryPreferences={pushCategoryPreferences} capability={managementDeliveryCapability()} audienceLabel="עדכוני הצוות שלך" /></StaffSection></StaffAppFrame>;
}
