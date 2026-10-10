import { AdminAppFrame } from "@/components/admin-app-ui";
import { CameraAdminManager } from "@/components/camera-ai-admin-modules";
import { SafetyCamerasPlatform } from "@/components/safety-cameras-platform";
import { requireRole } from "@/lib/auth";
import { logSupabaseError, safeAdminData } from "@/lib/admin-safe";
import { cleanSyntheticLabel } from "@/lib/domain/display-label";
import { safeIncident, toSafetyCamera } from "@/lib/management/safety-cameras";
import { createClient } from "@/lib/supabase/server";

const cameraColumns = "id,garden_id,kindergarten_id,name,area,camera_zone_label,status,stream_status,health_status,active,last_seen,last_health_check_at,last_test_at,last_test_status,gateway_registration_status,parent_view_allowed,parent_viewing_allowed,staff_view_allowed,inspector_view_allowed,inspector_access_policy,observer_enabled,recording_enabled,source_type,system_type,camera_provider_key,gateway_provider_preference,connection_method,protocol,live_preview_status,clip_readiness_status,snapshot_readiness_status,permission_model,parent_visibility_status,parent_blocked_reason,observer_review_required,observer_confidence_threshold,last_test_message,gateway_last_error,masked_connection_summary,video_gateway_stream_id,gateway_stream_id,viewing_hours,operating_hours,retention_days,archive_policy,playback_hls_ready,playback_webrtc_ready";
type SearchParams = Promise<{ view?: string; filter?: string; camera?: string; q?: string }>;
const views = new Set(["overview", "events", "setup", "policy", "readiness"]);
const filters = new Set(["all", "online", "degraded", "offline", "setup_required", "action"]);

export default async function AdminCamerasPage({ searchParams }: { searchParams: SearchParams }) {
  const { profile } = await requireRole(["admin"]);
  const params = await searchParams;
  const result = await safeAdminData("UX16 admin safety cameras", async () => {
    const supabase = await createClient();
    const [cameraRes, gardenRes, incidentRes] = await Promise.all([
      supabase.from("camera_streams" as never).select(cameraColumns as never).limit(220),
      supabase.from("gardens" as never).select("id,name,city" as never).limit(300),
      supabase.from("incident_reports" as never).select("id,garden_id,title,severity,status,description,created_at" as never).order("created_at", { ascending: false }).limit(40)
    ]);
    [cameraRes, gardenRes, incidentRes].forEach((query, index) => logSupabaseError(`UX16 admin safety ${index}`, query.error));
    return {
      rawCameras: (cameraRes.data ?? []) as unknown as Record<string, unknown>[],
      gardens: (gardenRes.data ?? []) as unknown as Array<{ id: string; name?: string | null; city?: string | null }>,
      incidents: (incidentRes.data ?? []) as unknown as Record<string, unknown>[],
      sourceError: [cameraRes.error, gardenRes.error, incidentRes.error].some(Boolean) ? "חלק מנתוני הבטיחות אינם זמינים; אין השלמה בנתונים משוערים." : null
    };
  }, { rawCameras: [] as Record<string, unknown>[], gardens: [] as Array<{ id: string; name?: string | null; city?: string | null }>, incidents: [] as Record<string, unknown>[], sourceError: null as string | null });
  const gardenNames = new Map(result.data.gardens.map((garden) => [garden.id, cleanSyntheticLabel(garden.name, "גן")]));
  const cameras = result.data.rawCameras.map((camera) => toSafetyCamera({ ...camera, garden_name: gardenNames.get(String(camera.garden_id ?? camera.kindergarten_id ?? "")) ?? "גן" }, "admin"));
  const incidents = result.data.incidents.map((incident) => safeIncident({ ...incident, garden_name: gardenNames.get(String(incident.garden_id ?? "")) ?? "גן" }));
  const view = views.has(params.view ?? "") ? params.view as "events" | "setup" | "policy" | "readiness" : "overview";
  const filter = filters.has(params.filter ?? "") ? params.filter as "online" | "degraded" | "offline" | "setup_required" | "action" : "all";
  const managementSlot = <CameraAdminManager cameras={result.data.rawCameras as any[]} gardens={result.data.gardens as any[]} gatewayConnected={Boolean(process.env.VIDEO_GATEWAY_URL)} defaultOpenAdd showHealthCenter={false} />;
  return (
    <AdminAppFrame profile={profile} activeHref="/dashboard/admin/cameras" title="בטיחות ומצלמות" subtitle="מצב פלטפורמה, הרשאות ומוכנות ללא חשיפת תשתית" badge="Capability truth">
      <SafetyCamerasPlatform
        role="admin"
        cameras={cameras}
        incidents={incidents}
        gardenName={`${result.data.gardens.length} גנים במבט מורשה`}
        view={view}
        filter={filter}
        selectedCameraId={params.camera ?? null}
        searchQuery={params.q ?? ""}
        sourceError={result.error ?? result.data.sourceError}
        managementSlot={managementSlot}
      />
    </AdminAppFrame>
  );
}
