import { Camera, ShieldCheck } from "lucide-react";
import { CameraPlaybackCard } from "@/components/camera-playback-card";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { cameraHasParentPlayableSource, cameraParentViewingAllowed, resolveParentCameraScope } from "@/lib/domain/parent-camera-access";

type GardenGroup = { id: string; name: string; cameras: any[] };

function emptyState(kind: "no_relation" | "no_cameras" | "not_allowed") {
  if (kind === "no_relation") return { title: "לא נמצא שיוך של ילד לגן עבור המשתמש הזה", body: "כדי להציג מצלמות, חייב להיות ילד משויך להורה ולגן במערכת. פנו למנהלת הגן לבדוק את שיוך כרטיס הילד." };
  if (kind === "no_cameras") return { title: "לא הוגדרו מצלמות עבור הגן", body: "נמצא שיוך ילד־גן, אך עדיין אין מצלמות רשומות לגן זה." };
  return { title: "המצלמות קיימות אך צפיית הורים לא הופעלה", body: "מנהלת הגן צריכה להפעיל צפיית הורים עבור המצלמה לפני שהיא תופיע כאן." };
}

export default async function Page() {
  const { profile } = await requireRole(["parent"]);
  const userScopedSupabase = await createClient();
  const supabase = isAdminClientConfigured() ? createAdminClient() : userScopedSupabase;
  const scope = await resolveParentCameraScope(supabase as any, profile as any);
  const camerasRes = scope.kindergartenIds.length
    ? await supabase
        .from("camera_streams" as any)
        .select("id, garden_id, kindergarten_id, name, area, camera_type, source_type, protocol, status, active, parent_view_allowed, parent_viewing_allowed, hls_playback_url, sample_hls_url, webrtc_playback_url, video_gateway_stream_id, gateway_stream_id, last_health_check_at, viewing_hours, gardens(name, city)")
        .in("garden_id", scope.kindergartenIds)
        .limit(120)
    : { data: [] };
  if ((camerasRes as any).error) console.error("Parent camera query failed", (camerasRes as any).error);
  const allCameras = ((camerasRes as any).data ?? []) as any[];
  const allowedCameras = allCameras.filter((camera) => {
    const cameraGardenId = camera.garden_id ?? camera.kindergarten_id;
    const belongsToChildGarden = scope.kindergartenIds.includes(cameraGardenId);
    const activeOrSamplePending = camera.active !== false && (camera.status !== "disabled") && (camera.status !== "offline" || cameraHasParentPlayableSource(camera));
    return belongsToChildGarden && activeOrSamplePending && cameraParentViewingAllowed(camera);
  });
  console.info("Parent camera query result", {
    parentProfileId: profile.id,
    parentRecordIds: scope.parentIds,
    childIdsFound: scope.children.map((child: any) => child.id),
    kindergartenIdsFound: scope.kindergartenIds,
    camerasBeforePermissionFilter: allCameras.length,
    camerasReturnedAfterPermissionFilter: allowedCameras.length
  });
  const groups = scope.kindergartenIds.map((gardenId) => {
    const child = scope.children.find((item: any) => (item.garden_id ?? item.kindergarten_id) === gardenId);
    return {
      id: gardenId,
      name: child?.gardens?.name ?? allowedCameras.find((camera) => (camera.garden_id ?? camera.kindergarten_id) === gardenId)?.gardens?.name ?? "גן ילדים",
      cameras: allowedCameras.filter((camera) => (camera.garden_id ?? camera.kindergarten_id) === gardenId)
    } satisfies GardenGroup;
  }).filter((group) => group.cameras.length > 0);
  const gatewayConnected = Boolean(process.env.VIDEO_GATEWAY_URL);
  const empty = !scope.kindergartenIds.length ? emptyState("no_relation") : allCameras.length === 0 ? emptyState("no_cameras") : emptyState("not_allowed");

  return <DashboardShell role="parent" title="מצלמות הגן"><div className="dashboard-hero-card parent-hero-card"><div><p className="eyebrow">צפייה מורשית בלבד</p><h1>מצלמות הגן.</h1><p>הורה רואה רק מצלמות של גני הילדים של ילדיו ורק מצלמות שהגן סימן כמותרות לצפיית הורים. RTSP, שם משתמש וסיסמאות לא נשלחים לדפדפן.</p></div><span className={gatewayConnected ? "pill good" : "pill warn"}>{gatewayConnected ? "Gateway מחובר" : "Sample HLS / Gateway"}</span></div><section className="grid cols-3 dashboard-panels"><article className="card action-panel"><ShieldCheck /><h2>פרטיות</h2><p>אין גישה למצלמות של גנים אחרים או למצלמות שלא אושרו להורים.</p></article><article className="card action-panel"><Camera /><h2>Token זמני</h2><p>כל פתיחת צפייה יוצרת Session זמני ומתועד.</p></article><article className="card action-panel"><h2>חלונות צפייה</h2><p>הגן יכול להגדיר שעות ותוקף הרשאה לכל מצלמה.</p></article></section><section className="dashboard-section">{groups.length === 0 ? <div className="empty-state"><strong>{empty.title}</strong><span>{empty.body}</span></div> : groups.map((group) => <section className="dashboard-section" key={group.id}><div className="section-heading"><h2>{group.name}</h2><p>{group.cameras.length} מצלמות מאושרות לצפיית הורים.</p></div><div className="camera-playback-grid">{group.cameras.map((camera) => <CameraPlaybackCard camera={camera} parentId={scope.parentIds[0]} key={camera.id} />)}</div></section>)}</section></DashboardShell>;
}
