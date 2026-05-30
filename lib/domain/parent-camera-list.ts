import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import {
  evaluateParentCameraAccess,
  getCameraGardenId,
  resolveParentCameraScope,
  type ParentCameraAccessDecision
} from "@/lib/domain/parent-camera-access";

const safeCameraColumns = [
  "id",
  "garden_id",
  "kindergarten_id",
  "name",
  "area",
  "age_group",
  "class_group",
  "camera_type",
  "source_type",
  "protocol",
  "status",
  "active",
  "parent_view_allowed",
  "parent_viewing_allowed",
  "hls_playback_url",
  "sample_hls_url",
  "webrtc_playback_url",
  "video_gateway_stream_id",
  "gateway_stream_id",
  "viewing_hours",
  "last_health_check_at"
].join(", ");

function uniqById(rows: any[]) {
  return rows.filter((row, index, all) => row?.id && all.findIndex((item) => item?.id === row.id) === index);
}

function sanitizeCamera(camera: any) {
  return {
    id: camera.id,
    garden_id: camera.garden_id ?? null,
    kindergarten_id: camera.kindergarten_id ?? null,
    camera_garden_id: getCameraGardenId(camera),
    name: camera.name ?? "מצלמה",
    area: camera.area ?? null,
    age_group: camera.age_group ?? null,
    class_group: camera.class_group ?? null,
    camera_type: camera.camera_type ?? null,
    source_type: camera.source_type ?? null,
    protocol: camera.protocol ?? null,
    status: camera.status ?? null,
    active: camera.active ?? null,
    parent_view_allowed: camera.parent_view_allowed ?? null,
    parent_viewing_allowed: camera.parent_viewing_allowed ?? null,
    hls_playback_url: camera.hls_playback_url ?? null,
    sample_hls_url: camera.sample_hls_url ?? null,
    webrtc_playback_url: camera.webrtc_playback_url ?? null,
    video_gateway_stream_id: camera.video_gateway_stream_id ?? null,
    gateway_stream_id: camera.gateway_stream_id ?? null,
    viewing_hours: camera.viewing_hours ?? null,
    last_health_check_at: camera.last_health_check_at ?? null
  };
}

export type ParentCameraListResult = {
  cameras: ReturnType<typeof sanitizeCamera>[];
  decisions: ParentCameraAccessDecision[];
  scope: Awaited<ReturnType<typeof resolveParentCameraScope>>;
  debug: {
    serviceRoleConfigured: boolean;
    dataSource: "service_role" | "user_rls";
    allowedKindergartenIds: string[];
    gardenIdQueryCount: number;
    kindergartenIdQueryCount: number;
    candidateCamerasCount: number;
    candidateCameraIds: string[];
    allowedCamerasCount: number;
    allowedCameraIds: string[];
    missingPlaybackSourceCount: number;
    hiddenBecauseStatus: number;
    hiddenBecauseParentViewingFlag: number;
    queryErrors: Array<{ query: string; message: string }>;
  };
};

export async function getParentCameraListForProfile(userSupabase: SupabaseClient<any, any, any>, profile: any): Promise<ParentCameraListResult> {
  const serviceRoleConfigured = isAdminClientConfigured();
  const dataSupabase = serviceRoleConfigured ? createAdminClient() : userSupabase;
  const scope = await resolveParentCameraScope(dataSupabase as any, profile);
  const queryErrors: Array<{ query: string; message: string }> = [];

  if (!scope.kindergartenIds.length) {
    return {
      cameras: [],
      decisions: [],
      scope,
      debug: {
        serviceRoleConfigured,
        dataSource: serviceRoleConfigured ? "service_role" : "user_rls",
        allowedKindergartenIds: [],
        gardenIdQueryCount: 0,
        kindergartenIdQueryCount: 0,
        candidateCamerasCount: 0,
        candidateCameraIds: [],
        allowedCamerasCount: 0,
        allowedCameraIds: [],
        missingPlaybackSourceCount: 0,
        hiddenBecauseStatus: 0,
        hiddenBecauseParentViewingFlag: 0,
        queryErrors
      }
    };
  }

  const [byGardenId, byKindergartenId] = await Promise.all([
    dataSupabase.from("camera_streams" as any).select(safeCameraColumns).in("garden_id", scope.kindergartenIds).limit(250),
    dataSupabase.from("camera_streams" as any).select(safeCameraColumns).in("kindergarten_id", scope.kindergartenIds).limit(250)
  ]);

  if ((byGardenId as any).error) {
    queryErrors.push({ query: "camera_streams by garden_id", message: (byGardenId as any).error.message ?? String((byGardenId as any).error) });
    console.error("Parent cameras secure list garden_id query failed", (byGardenId as any).error);
  }
  if ((byKindergartenId as any).error) {
    queryErrors.push({ query: "camera_streams by kindergarten_id", message: (byKindergartenId as any).error.message ?? String((byKindergartenId as any).error) });
    console.error("Parent cameras secure list kindergarten_id query failed", (byKindergartenId as any).error);
  }

  const gardenRows = (((byGardenId as any).data ?? []) as any[]);
  const kindergartenRows = (((byKindergartenId as any).data ?? []) as any[]);
  const candidateCameras = uniqById([...gardenRows, ...kindergartenRows]);
  const decisions = candidateCameras.map((camera) => evaluateParentCameraAccess(profile, scope, camera));
  const allowedIds = new Set(decisions.filter((decision) => decision.allowed).map((decision) => decision.diagnostics.camera_id));
  const allowedCameras = candidateCameras.filter((camera) => allowedIds.has(camera.id)).map(sanitizeCamera);
  const missingPlaybackSourceCount = allowedCameras.filter((camera) => !(camera.sample_hls_url || camera.hls_playback_url || camera.webrtc_playback_url || camera.gateway_stream_id || camera.video_gateway_stream_id)).length;

  console.info("Parent cameras secure list result", {
    parentProfileId: profile.id,
    dataSource: serviceRoleConfigured ? "service_role" : "user_rls",
    allowedKindergartenIds: scope.kindergartenIds,
    gardenIdQueryCount: gardenRows.length,
    kindergartenIdQueryCount: kindergartenRows.length,
    candidateCamerasCount: candidateCameras.length,
    candidateCameraIds: candidateCameras.map((camera) => camera.id),
    allowedCamerasCount: allowedCameras.length,
    allowedCameraIds: allowedCameras.map((camera) => camera.id),
    missingPlaybackSourceCount,
    queryErrors
  });

  return {
    cameras: allowedCameras,
    decisions,
    scope,
    debug: {
      serviceRoleConfigured,
      dataSource: serviceRoleConfigured ? "service_role" : "user_rls",
      allowedKindergartenIds: scope.kindergartenIds,
      gardenIdQueryCount: gardenRows.length,
      kindergartenIdQueryCount: kindergartenRows.length,
      candidateCamerasCount: candidateCameras.length,
      candidateCameraIds: candidateCameras.map((camera) => camera.id),
      allowedCamerasCount: allowedCameras.length,
      allowedCameraIds: allowedCameras.map((camera) => camera.id),
      missingPlaybackSourceCount,
      hiddenBecauseStatus: decisions.filter((decision) => decision.reason === "camera_inactive_or_disabled").length,
      hiddenBecauseParentViewingFlag: decisions.filter((decision) => decision.reason === "parent_viewing_not_enabled").length,
      queryErrors
    }
  };
}
