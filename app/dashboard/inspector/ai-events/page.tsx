import { Eye, ShieldCheck } from "lucide-react";
import { AiCameraEventsReview } from "@/components/ai-camera-events-review";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InspectorAppFrame, InspectorHero, InspectorMetricCard, InspectorMetricGrid, InspectorSection } from "@/components/inspector-app-ui";

export default async function InspectorAiEventsPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, gardensRes] = await Promise.all([
    supabase.from("inspectors" as any).select("profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("gardens" as any).select("id").eq("inspector_id", profile.id)
  ]);
  const gardenIds = (gardensRes.data ?? []).map((garden: any) => garden.id);
  const eventsRes = gardenIds.length
    ? await supabase.from("ai_camera_events" as any).select("id, kindergarten_id, event_type, severity, status, created_at, gardens(name), camera_streams(name, area)").in("kindergarten_id", gardenIds).order("created_at", { ascending: false }).limit(80)
    : { data: [] };
  const events = (eventsRes.data ?? []) as any[];
  const profileForUi = { ...profile, profile_image_url: (inspectorRes.data as any)?.profile_photo_url ?? profile.profile_image_url };

  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/reports" title="התראות תצפיתן" subtitle="בדיקה אנושית בלבד" badge="AI">
      <InspectorHero eyebrow="התראות בטיחות" title="אירועים שדורשים בדיקה אנושית" subtitle="מוצגות רק התראות מגנים שבאחריותך. אין פעולה אוטומטית בלי בדיקה והחלטה של אדם." artwork={<Eye />} />
      <InspectorMetricGrid columns={3}>
        <InspectorMetricCard label="אירועים" value={events.length} hint="לטיפול" icon={Eye} />
        <InspectorMetricCard label="גנים" value={gardenIds.length} hint="משויכים בלבד" icon={ShieldCheck} />
        <InspectorMetricCard label="מדיניות" value="אדם מחליט" hint="אין פעולה אוטומטית" icon={ShieldCheck} tone="success" />
      </InspectorMetricGrid>
      <InspectorSection title="תור סקירה" subtitle="הקומפוננטה הקיימת נשמרה כדי לא לשנות לוגיקת סקירה" icon={Eye}>
        <AiCameraEventsReview events={events} role="inspector" />
      </InspectorSection>
    </InspectorAppFrame>
  );
}
