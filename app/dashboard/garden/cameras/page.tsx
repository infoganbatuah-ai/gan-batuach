import { CameraAdminManager } from "@/components/camera-ai-admin-modules";
import { DashboardShell } from "@/components/dashboard-shell";
import { RoleAppShell } from "@/components/role-app-shell";
import { SafetyCamerasPlatform } from "@/components/safety-cameras-platform";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { resolveManagementGardenContext } from "@/lib/management/active-garden-context";
import { safeIncident, toSafetyCamera } from "@/lib/management/safety-cameras";
import { createClient } from "@/lib/supabase/server";

const cameraColumns = "id,garden_id,kindergarten_id,name,area,camera_zone_label,status,stream_status,health_status,active,last_seen,last_health_check_at,last_test_at,last_test_status,gateway_registration_status,parent_view_allowed,parent_viewing_allowed,staff_view_allowed,inspector_view_allowed,inspector_access_policy,observer_enabled,recording_enabled,source_type,system_type,camera_provider_key,gateway_provider_preference,connection_method,protocol,live_preview_status,clip_readiness_status,snapshot_readiness_status,permission_model,parent_visibility_status,parent_blocked_reason,observer_review_required,observer_confidence_threshold,last_test_message,gateway_last_error,masked_connection_summary,video_gateway_stream_id,gateway_stream_id,viewing_hours,operating_hours,retention_days,archive_policy,playback_hls_ready,playback_webrtc_ready";

type SearchParams = Promise<{ view?: string; filter?: string; camera?: string; q?: string }>;
const views = new Set(["overview", "events", "setup", "policy", "readiness"]);
const filters = new Set(["all", "online", "degraded", "offline", "setup_required", "action"]);

export default async function GardenCamerasPage({ searchParams }: { searchParams: SearchParams }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const context = await resolveManagementGardenContext(profile);
  const gardenId = context.activeGarden?.id ?? profile.garden_id ?? "";
  const role = profile.role === "owner" ? "owner" : "manager";
  const result = await safeAdminData("UX16 garden safety cameras", async () => {
    const supabase = await createClient();
    const [cameraRes, gardenRes, incidentRes] = await Promise.all([
      supabase.from("camera_streams" as never).select(cameraColumns as never).eq("garden_id", gardenId).limit(120),
      supabase.from("gardens" as never).select("id,name,city" as never).eq("id", gardenId).maybeSingle(),
      supabase.from("incident_reports" as never).select("id,title,severity,status,description,created_at" as never).eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(20)
    ]);
    [cameraRes, gardenRes, incidentRes].forEach((query, index) => logSupabaseError(`UX16 garden safety ${index}`, query.error));
    const garden = gardenRes.data as unknown as { id: string; name?: string | null; city?: string | null } | null;
    return {
      rawCameras: (cameraRes.data ?? []) as unknown as Record<string, unknown>[],
      incidents: (incidentRes.data ?? []) as unknown as Record<string, unknown>[],
      garden,
      sourceError: [cameraRes.error, gardenRes.error, incidentRes.error].some(Boolean) ? "חלק מנתוני הבטיחות אינם זמינים כרגע; לא הוצגו נתונים משוערים." : null
    };
  }, { rawCameras: [] as Record<string, unknown>[], incidents: [] as Record<string, unknown>[], garden: null as { id: string; name?: string | null; city?: string | null } | null, sourceError: null as string | null });

  const gardenName = cleanSyntheticLabel(result.data.garden?.name, "הגן הפעיל");
  const cameras = result.data.rawCameras.map((camera) => toSafetyCamera({ ...camera, garden_name: gardenName }, role));
  const incidents = result.data.incidents.map((incident) => safeIncident({ ...incident, garden_name: gardenName }));
  const view = views.has(params.view ?? "") ? params.view as "events" | "setup" | "policy" | "readiness" : "overview";
  const filter = filters.has(params.filter ?? "") ? params.filter as "online" | "degraded" | "offline" | "setup_required" | "action" : "all";
  const managementSlot = (
    <CameraAdminManager
      cameras={result.data.rawCameras as any[]}
      gardens={context.gardens.map((garden) => ({ id: garden.id, name: garden.name, city: "" })) as any[]}
      gatewayConnected={Boolean(process.env.VIDEO_GATEWAY_URL)}
      defaultOpenAdd
      showHealthCenter={false}
    />
  );

  return (
    <DashboardShell role={role} title="בטיחות ומצלמות" appHome>
      <RoleAppShell role={role} activeHref="/dashboard/garden/cameras" title="בטיחות ומצלמות" subtitle="מצב, הרשאות ומוכנות לפי הגן הפעיל" profile={profile} className="safety-runtime-shell">
        <main className="dashboard-runtime-content">
          <SafetyCamerasPlatform
            role={role}
            cameras={cameras}
            incidents={incidents}
            gardenName={gardenName}
            view={view}
            filter={filter}
            selectedCameraId={params.camera ?? null}
            searchQuery={params.q ?? ""}
            sourceError={result.error ?? result.data.sourceError}
            managementSlot={managementSlot}
          />
        </main>
      </RoleAppShell>
    </DashboardShell>
  );
}
