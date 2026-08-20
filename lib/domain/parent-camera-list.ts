import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateParentCameraAccess,
  resolveParentCameraScope,
  type ParentCameraAccessDecision
} from "@/lib/domain/parent-camera-access";
import { hasPlaybackSource } from "@/lib/domain/video-gateway";
import { sanitizeCameraForParent } from "@/lib/domain/camera-diagnostics";

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
  "video_gateway_stream_id",
  "gateway_stream_id",
  "live_preview_status",
  "playback_hls_ready",
  "playback_webrtc_ready",
  "viewing_hours",
  "operating_hours",
  "parent_visibility_status",
  "parent_blocked_reason",
  "last_health_check_at"
].join(", ");

function uniqById(rows: any[]) {
  return rows.filter((row, index, all) => row?.id && all.findIndex((item) => item?.id === row.id) === index);
}

function cameraDebugLogsEnabled() {
  return process.env.NODE_ENV !== "production";
}

export type ParentCameraListResult = {
  cameras: ReturnType<typeof sanitizeCameraForParent>[];
  decisions: ParentCameraAccessDecision[];
  scope: Awaited<ReturnType<typeof resolveParentCameraScope>>;
  debug: {
    dataSource: "user_rls";
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
  const dataSupabase = userSupabase;
  const scope = await resolveParentCameraScope(dataSupabase as any, profile);
  const queryErrors: Array<{ query: string; message: string }> = [];

  if (!scope.kindergartenIds.length) {
    return {
      cameras: [],
      decisions: [],
      scope,
      debug: {
        dataSource: "user_rls",
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
  const allowedRawCameras = candidateCameras.filter((camera) => allowedIds.has(camera.id));
  const allowedCameras = allowedRawCameras.map(sanitizeCameraForParent);
  const missingPlaybackSourceCount = allowedRawCameras.filter((camera) => !hasPlaybackSource(camera)).length;

  if (cameraDebugLogsEnabled()) {
    console.info("Parent cameras secure list result", {
      dataSource: "user_rls",
      allowedKindergartenCount: scope.kindergartenIds.length,
      gardenIdQueryCount: gardenRows.length,
      kindergartenIdQueryCount: kindergartenRows.length,
      candidateCamerasCount: candidateCameras.length,
      allowedCamerasCount: allowedCameras.length,
      missingPlaybackSourceCount,
      queryErrorCount: queryErrors.length
    });
  }

  return {
    cameras: allowedCameras,
    decisions,
    scope,
    debug: {
      dataSource: "user_rls",
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
