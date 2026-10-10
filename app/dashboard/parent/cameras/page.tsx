import { DashboardShell } from "@/components/dashboard-shell";
import { ParentAppFrame } from "@/components/parent-app-ui";
import { SafetyCamerasPlatform } from "@/components/safety-cameras-platform";
import { requireRole } from "@/lib/auth";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { getParentCameraListForProfile } from "@/lib/domain/parent-camera-list";
import { toSafetyCamera } from "@/lib/management/safety-cameras";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ view?: string; filter?: string; camera?: string; q?: string }>;
const views = new Set(["overview", "events", "policy", "readiness"]);
const filters = new Set(["all", "online", "degraded", "offline", "setup_required", "action"]);

export default async function ParentCamerasPage({ searchParams }: { searchParams: SearchParams }) {
  const { profile } = await requireRole(["parent"]);
  const params = await searchParams;
  const supabase = await createClient();
  const result = await getParentCameraListForProfile(supabase as any, profile);
  const gardenNames = new Map<string, string>();
  for (const child of result.scope.children as Array<Record<string, any>>) {
    const gardenId = String(child.garden_id ?? child.kindergarten_id ?? "");
    if (gardenId) gardenNames.set(gardenId, cleanSyntheticLabel(child.gardens?.name, "הגן המשויך"));
  }
  const cameras = result.cameras.map((camera) => toSafetyCamera({
    ...camera,
    parent_view_allowed: true,
    garden_name: gardenNames.get(String(camera.camera_garden_id ?? "")) ?? "הגן המשויך"
  }, "parent"));
  const gardenName = gardenNames.size === 1 ? [...gardenNames.values()][0] : gardenNames.size > 1 ? `${gardenNames.size} גנים מקושרים` : null;
  const view = views.has(params.view ?? "") ? params.view as "events" | "policy" | "readiness" : "overview";
  const filter = filters.has(params.filter ?? "") ? params.filter as "online" | "degraded" | "offline" | "setup_required" | "action" : "all";

  return (
    <DashboardShell role="parent" title="בטיחות ומצלמות" appHome>
      <ParentAppFrame active="dashboard" profileName={profile.full_name} avatarUrl={(profile as any).profile_image_url ?? null}>
        <p className="sr-only">אין שידור חי ללא אימות יכולת והרשאה למדיניות המצלמה הפעילה.</p>
        <SafetyCamerasPlatform
          role="parent"
          cameras={cameras}
          gardenName={gardenName}
          view={view}
          filter={filter}
          selectedCameraId={params.camera ?? null}
          searchQuery={params.q ?? ""}
        />
      </ParentAppFrame>
    </DashboardShell>
  );
}
