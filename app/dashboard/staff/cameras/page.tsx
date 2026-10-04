import { SafetyCamerasPlatform } from "@/components/safety-cameras-platform";
import { StaffAppFrame } from "@/components/staff-app-ui";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { requireOperationalRole } from "@/lib/management/operational-role";
import { toSafetyCamera } from "@/lib/management/safety-cameras";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ view?: string; filter?: string; camera?: string; q?: string }>;
const views = new Set(["overview", "events", "policy", "readiness"]);
const filters = new Set(["all", "online", "degraded", "offline", "setup_required", "action"]);

export default async function StaffCamerasPage({ searchParams }: { searchParams: SearchParams }) {
  const { profile, employment } = await requireOperationalRole(["staff"]);
  const params = await searchParams;
  const supabase = await createClient();
  const gardenId = employment?.garden_id ?? "";
  const [cameraRes, gardenRes] = await Promise.all([
    supabase.from("camera_streams" as never)
      .select("id,garden_id,kindergarten_id,name,area,camera_zone_label,status,stream_status,health_status,active,last_seen,last_health_check_at,last_test_at,last_test_status,gateway_registration_status,staff_view_allowed,observer_enabled,recording_enabled" as never)
      .eq("garden_id", gardenId).eq("active", true).eq("staff_view_allowed", true).limit(80),
    supabase.from("gardens" as never).select("name" as never).eq("id", gardenId).maybeSingle()
  ]);
  const garden = gardenRes.data as unknown as { name?: string | null } | null;
  const gardenName = cleanSyntheticLabel(garden?.name, "הגן המשויך");
  const cameras = ((cameraRes.data ?? []) as unknown as Record<string, unknown>[])
    .map((camera) => toSafetyCamera({ ...camera, garden_name: gardenName }, "staff"));
  const view = views.has(params.view ?? "") ? params.view as "events" | "policy" | "readiness" : "overview";
  const filter = filters.has(params.filter ?? "") ? params.filter as "online" | "degraded" | "offline" | "setup_required" | "action" : "all";
  return (
    <StaffAppFrame active="more" profileName={profile.full_name} avatarUrl={(profile as any).profile_image_url ?? null}>
      <SafetyCamerasPlatform
        role="staff"
        cameras={cameras}
        gardenName={gardenName}
        view={view}
        filter={filter}
        selectedCameraId={params.camera ?? null}
        searchQuery={params.q ?? ""}
        sourceError={cameraRes.error || gardenRes.error ? "נתוני הבטיחות אינם זמינים במלואם כרגע; לא הוצגו נתונים משוערים." : null}
      />
    </StaffAppFrame>
  );
}
