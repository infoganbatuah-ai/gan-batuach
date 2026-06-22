import { Bell, ClipboardCheck } from "lucide-react";
import { NotificationCenter } from "@/components/notification-center";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InspectorAppFrame, InspectorHero, InspectorMetricCard, InspectorMetricGrid, InspectorSection } from "@/components/inspector-app-ui";

export default async function InspectorNotificationsPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, notificationsRes] = await Promise.all([
    supabase.from("inspectors" as any).select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase
      .from("notifications" as any)
      .select("*")
      .or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id}`)
      .order("created_at", { ascending: false })
      .limit(100)
  ]);
  const notifications = (notificationsRes.data ?? []) as any[];
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as any)?.profile_photo_url ?? profile.profile_image_url };

  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/settings" title="התראות מפקח" subtitle="פיקוחים, ליקויים ואירועים שדורשים פעולה" badge="התראות">
      <InspectorHero eyebrow="מרכז התראות" title="כל העדכונים החשובים במקום אחד" subtitle="התראות לפי גנים משויכים בלבד: פיקוח קרוב, איחורים, ליקויים, מצלמות ואירועי גן." artwork={<Bell />} />
      <InspectorMetricGrid columns={3}>
        <InspectorMetricCard label="התראות" value={notifications.length} hint="נטענו" icon={Bell} />
        <InspectorMetricCard label="מקור" value="מפקח" hint="לפי הרשאה" icon={ClipboardCheck} />
        <InspectorMetricCard label="טווח" value="גנים משויכים" hint="בלבד" icon={Bell} tone="success" />
      </InspectorMetricGrid>
      <InspectorSection title="רשימת התראות" subtitle="המרכז הקיים נשמר, רק עטוף בעיצוב האפליקציה החדש" icon={Bell}>
        <NotificationCenter notifications={notifications} />
      </InspectorSection>
    </InspectorAppFrame>
  );
}
