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
  const allCameras = [...(((camerasByGardenId as any).data ?? []) as any[]), ...(((camerasByKindergartenId as any).data ?? []) as any[])]
    .filter((camera, index, all) => camera?.id && all.findIndex((item) => item?.id === camera.id) === index);
  const accessDecisions = await Promise.all(allCameras.map((camera) => canParentViewCamera(supabase as any, profile.id, camera.id)));
  const allowedCameraIds = new Set(accessDecisions.filter((decision) => decision.allowed).map((decision) => decision.diagnostics.camera_id));
  const allowedCameras = allCameras.filter((camera) => allowedCameraIds.has(camera.id));
  console.info("Parent camera query result", {
    parentProfileId: profile.id,
    parentRecordIds: scope.parentIds,
    childIdsFound: scope.children.map((child: any) => child.id),
    childKindergartenIdsFound: scope.childGardenIds,
    directParentGardenIdsFound: scope.directParentGardenIds,
    profileGardenIdsFound: scope.profileGardenIds,
    finalAllowedGardenIds: allowedGardenIds,
    camerasBeforePermissionFilter: allCameras.length,
    camerasReturnedAfterPermissionFilter: allowedCameras.length,
    deniedReasons: accessDecisions.filter((decision) => !decision.allowed).map((decision) => ({ cameraId: decision.diagnostics.camera_id, reason: decision.reason }))
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

  return <DashboardShell role="parent" title="מצלמות הגן"><div className="dashboard-hero-card parent-hero-card"><div><p className="eyebrow">צפייה מורשית בלבד</p><h1>מצלמות הגן.</h1><p>הורה רואה רק מצלמות של גני הילדים של ילדיו ורק מצלמות שהגן סימן כמותרות לצפיית הורים. RTSP, שם משתמש וסיסמאות לא נשלחים לדפדפן.</p></div><span className={gatewayConnected ? "pill good" : "pill warn"}>{gatewayConnected ? "Gateway מחובר" : "Sample HLS / Gateway"}</span></div><section className="grid cols-3 dashboard-panels"><article className="card action-panel"><ShieldCheck /><h2>פרטיות</h2><p>אין גישה למצלמות של גנים אחרים או למצלמות שלא אושרו להורים.</p></article><article className="card action-panel"><Camera /><h2>Token זמני</h2><p>כל פתיחת צפייה יוצרת Session זמני ומתועד.</p></article><article className="card action-panel"><h2>חלונות צפייה</h2><p>הגן יכול להגדיר שעות ותוקף הרשאה לכל מצלמה.</p></article></section><section className="dashboard-section">{groups.length === 0 ? <div className="empty-state"><strong>{empty.title}</strong><span>{empty.body}</span></div> : groups.map((group) => <section className="dashboard-section" key={group.id}><div className="section-heading"><h2>{group.name}</h2><p>{group.cameras.length} מצלמות מאושרות לצפיית הורים.</p></div><div className="camera-playback-grid">{group.cameras.map((camera) => <CameraPlaybackCard camera={camera} parentId={scope.parentIds[0]} key={camera.id} />)}</div></section>)}</section></DashboardShell>;
}
