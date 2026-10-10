import { InspectorAppFrame } from "@/components/inspector-app-ui";
import { SafetyCamerasPlatform } from "@/components/safety-cameras-platform";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { safeIncident, toSafetyCamera } from "@/lib/management/safety-cameras";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ view?: string; filter?: string; camera?: string; q?: string }>;
const views = new Set(["overview", "events", "policy", "readiness"]);
const filters = new Set(["all", "online", "degraded", "offline", "setup_required", "action"]);

export default async function InspectorCamerasPage({ searchParams }: { searchParams: SearchParams }) {
  const { profile } = await requireOperationalRole(["inspector"]);
  const params = await searchParams;
  const supabase = await createClient();
  const [inspectorRes, gardensRes] = await Promise.all([
    supabase.from("inspectors" as never).select("profile_photo_url" as never).eq("id", profile.id).maybeSingle(),
    supabase.from("gardens" as never).select("id,name,city" as never).eq("inspector_id", profile.id).limit(100)
  ]);
  const gardens = (gardensRes.data ?? []) as unknown as Array<{ id: string; name?: string | null; city?: string | null }>;
  const gardenIds = gardens.map((garden) => garden.id);
  const [cameraRes, incidentRes] = gardenIds.length ? await Promise.all([
    supabase.from("camera_streams" as never)
      .select("id,garden_id,kindergarten_id,name,area,camera_zone_label,status,stream_status,health_status,active,last_seen,last_health_check_at,last_test_at,last_test_status,gateway_registration_status,inspector_view_allowed,inspector_access_policy,observer_enabled,recording_enabled" as never)
      .in("garden_id", gardenIds).limit(120),
    supabase.from("incident_reports" as never).select("id,garden_id,title,severity,status,description,created_at" as never).in("garden_id", gardenIds).order("created_at", { ascending: false }).limit(20)
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  const gardenNames = new Map(gardens.map((garden) => [garden.id, cleanSyntheticLabel(garden.name, "גן משויך")]));
  const cameras = ((cameraRes.data ?? []) as unknown as Record<string, unknown>[]).map((camera) => toSafetyCamera({ ...camera, garden_name: gardenNames.get(String(camera.garden_id ?? camera.kindergarten_id ?? "")) ?? "גן משויך" }, "inspector"));
  const incidents = ((incidentRes.data ?? []) as unknown as Record<string, unknown>[]).map((incident) => safeIncident({ ...incident, garden_name: gardenNames.get(String(incident.garden_id ?? "")) ?? "גן משויך" }));
  const inspector = inspectorRes.data as unknown as { profile_photo_url?: string | null } | null;
  const profileForUi = { ...profile, profile_image_url: inspector?.profile_photo_url ?? (profile as any).profile_image_url };
  const view = views.has(params.view ?? "") ? params.view as "events" | "policy" | "readiness" : "overview";
  const filter = filters.has(params.filter ?? "") ? params.filter as "online" | "degraded" | "offline" | "setup_required" | "action" : "all";
  return (
    <InspectorAppFrame profile={profileForUi} activeHref="/dashboard/inspector/cameras" title="בטיחות ומצלמות" subtitle="גישה מוגבלת לפי שיוך פיקוח" badge="ראיות בלבד">
      <SafetyCamerasPlatform
        role="inspector"
        cameras={cameras}
        incidents={incidents}
        gardenName={gardens.length === 1 ? gardenNames.get(gardens[0].id) : `${gardens.length} גנים משויכים`}
        view={view}
        filter={filter}
        selectedCameraId={params.camera ?? null}
        searchQuery={params.q ?? ""}
        sourceError={gardensRes.error || cameraRes.error || incidentRes.error ? "חלק מנתוני הבטיחות אינם זמינים; לא הוצגו נתונים מחוץ לשיוך המאומת." : null}
      />
    </InspectorAppFrame>
  );
}
