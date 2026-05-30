import { Camera, ShieldCheck } from "lucide-react";
import { CameraPlaybackCard } from "@/components/camera-playback-card";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { canParentViewCamera, getCameraGardenId, resolveParentCameraScope } from "@/lib/domain/parent-camera-access";

type GardenGroup = { id: string; name: string; cameras: any[] };

function emptyState(kind: "no_relation" | "no_cameras" | "not_allowed") {
  if (kind === "no_relation") return { title: "לא נמצא שיוך לגן עבור המשתמש הזה", body: "כדי להציג מצלמות, ההורה צריך להיות משויך ישירות לגן או דרך כרטיס ילד. פנו למנהלת הגן לבדוק את שיוך ההורה." };
  if (kind === "no_cameras") return { title: "הורה משויך לגן, אך לא נמצאו מצלמות מורשות לצפייה", body: "נמצא שיוך לגן, אך עדיין אין מצלמות רשומות או זמינות לצפיית הורים עבור הגן הזה." };
  return { title: "המצלמות קיימות אך צפיית הורים לא הופעלה", body: "מנהלת הגן צריכה להפעיל צפיית הורים עבור המצלמה לפני שהיא תופיע כאן." };
}

export default async function Page() {
  const { profile } = await requireRole(["parent"]);
  const userScopedSupabase = await createClient();
  const supabase = isAdminClientConfigured() ? createAdminClient() : userScopedSupabase;
  const scope = await resolveParentCameraScope(supabase as any, profile as any);
  const allowedGardenIds = scope.kindergartenIds;
  const selectColumns = "id, garden_id, kindergarten_id, name, area, camera_type, source_type, protocol, status, active, parent_view_allowed, parent_viewing_allowed, hls_playback_url, sample_hls_url, webrtc_playback_url, video_gateway_stream_id, gateway_stream_id, last_health_check_at, viewing_hours, gardens(name, city)";
  const camerasByGardenId = allowedGardenIds.length ? await supabase.from("camera_streams" as any).select(selectColumns).in("garden_id", allowedGardenIds).limit(120) : { data: [] };
  const camerasByKindergartenId = allowedGardenIds.length ? await supabase.from("camera_streams" as any).select(selectColumns).in("kindergarten_id", allowedGardenIds).limit(120) : { data: [] };
  if ((camerasByGardenId as any).error) console.error("Parent camera garden_id query failed", (camerasByGardenId as any).error);
  if ((camerasByKindergartenId as any).error) console.error("Parent camera kindergarten_id query failed", (camerasByKindergartenId as any).error);
  const candidateCameras = [...(((camerasByGardenId as any).data ?? []) as any[]), ...(((camerasByKindergartenId as any).data ?? []) as any[])]
    .filter((camera, index, all) => camera?.id && all.findIndex((item) => item?.id === camera.id) === index);
  let allCameras = candidateCameras;
  let accessDecisions = await Promise.all(allCameras.map((camera) => canParentViewCamera(supabase as any, profile.id, camera.id)));
  let allowedCameraIds = new Set(accessDecisions.filter((decision) => decision.allowed).map((decision) => decision.diagnostics.camera_id));
  let allowedCameras = allCameras.filter((camera) => allowedCameraIds.has(camera.id));

  if (allowedGardenIds.length && allowedCameras.length === 0) {
    const fallbackCameras = await supabase.from("camera_streams" as any).select(selectColumns).limit(250);
    if ((fallbackCameras as any).error) console.error("Parent camera fallback all-cameras query failed", (fallbackCameras as any).error);
    const merged = [...candidateCameras, ...(((fallbackCameras as any).data ?? []) as any[])]
      .filter((camera, index, all) => camera?.id && all.findIndex((item) => item?.id === camera.id) === index);
    const fallbackDecisions = await Promise.all(merged.map((camera) => canParentViewCamera(supabase as any, profile.id, camera.id)));
    const fallbackAllowedIds = new Set(fallbackDecisions.filter((decision) => decision.allowed).map((decision) => decision.diagnostics.camera_id));
    allCameras = merged;
    accessDecisions = fallbackDecisions;
    allowedCameraIds = fallbackAllowedIds;
    allowedCameras = merged.filter((camera) => fallbackAllowedIds.has(camera.id));
  }

  const deniedCameraDiagnostics = accessDecisions.filter((decision) => !decision.allowed);
  const missingPlaybackSourceCount = allowedCameras.filter((camera) => !(camera.sample_hls_url || camera.hls_playback_url || camera.webrtc_playback_url || camera.gateway_stream_id || camera.video_gateway_stream_id)).length;
  const hiddenBecauseMissingPlaybackSource = accessDecisions.filter((decision) => decision.reason === "camera_has_no_parent_playback_source").length;
  const hiddenBecauseStatus = accessDecisions.filter((decision) => decision.reason === "camera_inactive_or_disabled").length;
  const hiddenBecauseParentViewingFlag = accessDecisions.filter((decision) => decision.reason === "parent_viewing_not_enabled").length;
  const visibleDebug = {
    parentProfileId: profile.id,
    parentRecordIds: scope.parentIds,
    allowedKindergartenIds: allowedGardenIds,
    candidateCamerasCount: candidateCameras.length,
    candidateCameraIds: candidateCameras.map((camera) => camera.id),
    allCamerasCheckedCount: allCameras.length,
    allCameraIdsChecked: allCameras.map((camera) => camera.id),
    allowedCamerasCount: allowedCameras.length,
    allowedCameraIds: allowedCameras.map((camera) => camera.id),
    hiddenBecauseMissingPlaybackSource,
    allowedCamerasMissingPlaybackSource: missingPlaybackSourceCount,
    hiddenBecauseStatus,
    hiddenBecauseParentViewingFlag,
    cameraDecisions: accessDecisions
  };
  console.info("Parent camera query result", {
    parentProfileId: profile.id,
    parentRecordIds: scope.parentIds,
    childIdsFound: scope.children.map((child: any) => child.id),
    childKindergartenIdsFound: scope.childGardenIds,
    directParentGardenIdsFound: scope.directParentGardenIds,
    profileGardenIdsFound: scope.profileGardenIds,
    finalAllowedGardenIds: allowedGardenIds,
    candidateCamerasCount: candidateCameras.length,
    camerasBeforePermissionFilter: allCameras.length,
    camerasReturnedAfterPermissionFilter: allowedCameras.length,
    camerasMissingPlaybackSourceCount: missingPlaybackSourceCount,
    camerasUsedForFiltering: allCameras.map((camera) => ({
      id: camera.id,
      name: camera.name,
      active: camera.active,
      status: camera.status,
      parent_view_allowed: camera.parent_view_allowed,
      parent_viewing_allowed: camera.parent_viewing_allowed,
      garden_id: camera.garden_id,
      kindergarten_id: camera.kindergarten_id,
      sample_hls_url_exists: Boolean(camera.sample_hls_url),
      gateway_stream_id_exists: Boolean(camera.gateway_stream_id || camera.video_gateway_stream_id)
    })),
    deniedReasons: deniedCameraDiagnostics.map((decision) => ({ cameraId: decision.diagnostics.camera_id, cameraName: decision.diagnostics.camera_name, reason: decision.reason, raw: decision.diagnostics }))
  });
  const groups = allowedGardenIds.map((gardenId) => {
    const child = scope.children.find((item: any) => (item.garden_id ?? item.kindergarten_id) === gardenId);
    return {
      id: gardenId,
      name: child?.gardens?.name ?? allowedCameras.find((camera) => getCameraGardenId(camera) === gardenId)?.gardens?.name ?? "גן ילדים",
      cameras: allowedCameras.filter((camera) => getCameraGardenId(camera) === gardenId)
    } satisfies GardenGroup;
  }).filter((group) => group.cameras.length > 0);
  const gatewayConnected = Boolean(process.env.VIDEO_GATEWAY_URL);
  const empty = !allowedGardenIds.length ? emptyState("no_relation") : allCameras.length === 0 ? emptyState("no_cameras") : emptyState("not_allowed");

  return <DashboardShell role="parent" title="מצלמות הגן"><div className="dashboard-hero-card parent-hero-card"><div><p className="eyebrow">צפייה מורשית בלבד</p><h1>מצלמות הגן.</h1><p>הורה רואה רק מצלמות של גני הילדים של ילדיו ורק מצלמות שהגן סימן כמותרות לצפיית הורים. RTSP, שם משתמש וסיסמאות לא נשלחים לדפדפן.</p></div><span className={gatewayConnected ? "pill good" : "pill warn"}>{gatewayConnected ? "Gateway מחובר" : "Sample HLS / Gateway"}</span></div><section className="grid cols-3 dashboard-panels"><article className="card action-panel"><ShieldCheck /><h2>פרטיות</h2><p>אין גישה למצלמות של גנים אחרים או למצלמות שלא אושרו להורים.</p></article><article className="card action-panel"><Camera /><h2>Token זמני</h2><p>כל פתיחת צפייה יוצרת Session זמני ומתועד.</p></article><article className="card action-panel"><h2>חלונות צפייה</h2><p>הגן יכול להגדיר שעות ותוקף הרשאה לכל מצלמה.</p></article></section><section className="dashboard-section"><article className="card camera-debug-card"><div className="section-heading"><h2>אבחון זמני - מצלמות הורה</h2><p>בלוק זה מוצג זמנית כדי לזהות למה דף ההורה לא מציג מצלמה למרות שאבחון האדמין מחזיר ALLOW.</p></div><div className="access-debug-grid"><span>Parent profile id: {visibleDebug.parentProfileId}</span><span>Parent record id: {visibleDebug.parentRecordIds.join(", ") || "-"}</span><span>Allowed kindergarten ids: {visibleDebug.allowedKindergartenIds.join(", ") || "-"}</span><span>Candidate cameras count: {visibleDebug.candidateCamerasCount}</span><span>Candidate camera ids: {visibleDebug.candidateCameraIds.join(", ") || "-"}</span><span>All checked cameras count: {visibleDebug.allCamerasCheckedCount}</span><span>All checked camera ids: {visibleDebug.allCameraIdsChecked.join(", ") || "-"}</span><span>Allowed cameras count: {visibleDebug.allowedCamerasCount}</span><span>Allowed camera ids: {visibleDebug.allowedCameraIds.join(", ") || "-"}</span><span>Cameras hidden because missing playback source: {visibleDebug.hiddenBecauseMissingPlaybackSource}</span><span>Allowed cameras missing playback source: {visibleDebug.allowedCamerasMissingPlaybackSource}</span><span>Cameras hidden because status: {visibleDebug.hiddenBecauseStatus}</span><span>Cameras hidden because parent viewing flag: {visibleDebug.hiddenBecauseParentViewingFlag}</span></div>{visibleDebug.cameraDecisions.length === 0 ? <div className="empty-mini">לא נמצאו מצלמות לבדיקה בדף ההורה.</div> : visibleDebug.cameraDecisions.map((decision) => <article className="camera-debug-row" key={decision.diagnostics.camera_id ?? decision.reason}><strong>{decision.allowed ? "ALLOW" : "DENY"}: {decision.diagnostics.camera_name ?? "מצלמה"}</strong><span>reason: {decision.reason}</span><div className="access-debug-grid"><span>camera id: {decision.diagnostics.camera_id ?? "-"}</span><span>active: {String(decision.diagnostics.active)}</span><span>status: {decision.diagnostics.status ?? "-"}</span><span>parent_view_allowed: {String(decision.diagnostics.parent_view_allowed)}</span><span>parent_viewing_allowed: {String(decision.diagnostics.parent_viewing_allowed)}</span><span>garden_id: {decision.diagnostics.camera_garden_id_fields.garden_id ?? "-"}</span><span>kindergarten_id: {decision.diagnostics.camera_garden_id_fields.kindergarten_id ?? "-"}</span><span>sample_hls_url: {decision.diagnostics.sample_hls_url_exists ? "exists" : "missing"}</span><span>hls_playback_url: {decision.diagnostics.hls_playback_url_exists ? "exists" : "missing"}</span><span>webrtc_playback_url: {decision.diagnostics.webrtc_playback_url_exists ? "exists" : "missing"}</span><span>gateway_stream_id: {decision.diagnostics.gateway_stream_id_exists ? "exists" : "missing"}</span></div></article>)}</article></section><section className="dashboard-section">{groups.length === 0 ? <><div className="empty-state"><strong>{empty.title}</strong><span>{empty.body}</span></div>{allCameras.length > 0 ? <div className="camera-deny-diagnostics"><div className="section-heading"><h2>בדיקת סינון מצלמות</h2><p>נמצאו מצלמות בגן, אך הן נדחו לפי תנאי הרשאה. זה מוצג כדי לזהות בדיוק מה חסר בהגדרת המצלמה.</p></div>{deniedCameraDiagnostics.map((decision) => <article className="card camera-debug-card" key={decision.diagnostics.camera_id ?? decision.reason}><strong>{decision.allowed ? "ALLOW" : "DENY"}: {decision.diagnostics.camera_name ?? "מצלמה"}</strong><span>סיבה: {decision.reason}</span><div className="access-debug-grid"><span>camera id: {decision.diagnostics.camera_id ?? "-"}</span><span>active: {String(decision.diagnostics.active)}</span><span>status: {decision.diagnostics.status ?? "-"}</span><span>parent_view_allowed: {String(decision.diagnostics.parent_view_allowed)}</span><span>parent_viewing_allowed: {String(decision.diagnostics.parent_viewing_allowed)}</span><span>garden_id: {decision.diagnostics.camera_garden_id_fields.garden_id ?? "-"}</span><span>kindergarten_id: {decision.diagnostics.camera_garden_id_fields.kindergarten_id ?? "-"}</span><span>sample_hls_url: {decision.diagnostics.sample_hls_url_exists ? "exists" : "missing"}</span><span>hls_playback_url: {decision.diagnostics.hls_playback_url_exists ? "exists" : "missing"}</span><span>webrtc_playback_url: {decision.diagnostics.webrtc_playback_url_exists ? "exists" : "missing"}</span><span>gateway_stream_id: {decision.diagnostics.gateway_stream_id_exists ? "exists" : "missing"}</span></div></article>)}</div> : null}</> : groups.map((group) => <section className="dashboard-section" key={group.id}><div className="section-heading"><h2>{group.name}</h2><p>{group.cameras.length} מצלמות מאושרות לצפיית הורים.</p></div><div className="camera-playback-grid">{group.cameras.map((camera) => <CameraPlaybackCard camera={camera} parentId={scope.parentIds[0]} key={camera.id} />)}</div></section>)}</section></DashboardShell>;
}
