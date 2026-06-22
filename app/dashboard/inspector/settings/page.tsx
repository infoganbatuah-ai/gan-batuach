import { MapPin, Settings, ShieldCheck, UserRound } from "lucide-react";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InspectorAppFrame, InspectorHero, InspectorMetricCard, InspectorMetricGrid, InspectorSection } from "@/components/inspector-app-ui";

export default async function InspectorSettingsPage() {
  const { profile } = await requireRole(["inspector"]);
  const supabase = await createClient();
  const [inspectorRes, gardensRes] = await Promise.all([
    supabase.from("inspectors" as any).select("id, service_cities, profile_photo_url").eq("id", profile.id).maybeSingle(),
    supabase.from("gardens" as any).select("id, name").eq("inspector_id", profile.id)
  ]);
  const inspector = inspectorRes.data as any;
  const gardens = (gardensRes.data ?? []) as any[];
  const profileWithInspectorPhoto = { ...profile, profile_image_url: inspector?.profile_photo_url ?? profile.profile_image_url };

  return (
    <InspectorAppFrame profile={profileWithInspectorPhoto} activeHref="/dashboard/inspector/settings" title="פרופיל מפקח" subtitle="פרטים, אזורים ושיוכים" badge="הגדרות">
      <InspectorHero eyebrow="הגדרות" title={`שלום, ${profile.full_name ?? "מפקח"}`} subtitle="עדכון פרטים, תמונת פרופיל, התראות ואבטחה." artwork={<Settings />} />
      <InspectorMetricGrid columns={3}>
        <InspectorMetricCard label="אזורים" value={Array.isArray(inspector?.service_cities) ? inspector.service_cities.length : 0} hint={Array.isArray(inspector?.service_cities) && inspector.service_cities.length ? inspector.service_cities.join(", ") : "לא הוגדרו"} icon={MapPin} />
        <InspectorMetricCard label="גנים משויכים" value={gardens.length} hint={gardens.map((garden: any) => garden.name).join(", ") || "אין שיוך גנים"} icon={ShieldCheck} />
        <InspectorMetricCard label="תפקיד" value="מפקח" hint="גישה לפי שיוך" icon={UserRound} tone="success" />
      </InspectorMetricGrid>
      <InspectorSection title="פרטים אישיים" subtitle="הטופס הקיים נשמר כדי לא לשנות שמירת פרופיל" icon={UserRound}>
        <ProfileSettingsForm profile={profileWithInspectorPhoto} garden={null} roleLabel="מפקח" includeGarden={false} requireProfilePhoto />
      </InspectorSection>
    </InspectorAppFrame>
  );
}
