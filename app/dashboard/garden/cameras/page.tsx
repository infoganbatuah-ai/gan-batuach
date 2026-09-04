import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { CameraAdminManager } from "@/components/camera-ai-admin-modules";
import { GardenCameraCapabilityPanel } from "@/components/garden-camera-capability-panel";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { Camera, CameraOff, Eye, LockKeyhole, PlayCircle, Plus, RadioTower, ShieldCheck, Video } from "lucide-react";
import {
  TeacherActionTile,
  TeacherAiInsight,
  TeacherAppFrame,
  TeacherCompactItem,
  TeacherCompactList,
  TeacherEmptyState,
  TeacherPageTitle,
  TeacherQuickActions,
  TeacherSection,
  TeacherStatCard,
  TeacherStatsGrid
} from "@/components/teacher-app-ui";

function isCameraOnline(camera: any) {
  return Boolean(camera.active) && ["online", "connected"].includes(String(camera.status ?? camera.stream_status ?? ""));
}

function cameraStatusLabel(camera: any) {
  if (isCameraOnline(camera)) return "מחוברת ומוכנה";
  if (camera.status === "pending_gateway" || camera.stream_status === "pending") return "ממתינה לחיבור";
  if (camera.active === false) return "כבויה";
  return "דורשת בדיקה";
}

function cameraStatusTone(camera: any) {
  if (isCameraOnline(camera)) return "green";
  if (camera.status === "pending_gateway" || camera.stream_status === "pending") return "orange";
  return "red";
}

function cameraVisibilityLabel(camera: any) {
  if (camera.parent_view_allowed || camera.parent_viewing_allowed) return "צפיית הורים מאושרת";
  if (camera.parent_visibility_status === "pending_gateway") return "צפייה ממתינה ל-Gateway";
  return "צפייה להורים חסומה";
}

export default async function GardenCameraSetupPage({ searchParams }: { searchParams: Promise<{ filter?: string; camera?: string; add?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const gardenId = profile.garden_id ?? "";
  const result = await safeAdminData("garden cameras", async () => {
    const supabase = await createClient();
    const [cameras, garden] = await Promise.all([
      supabase.from("camera_streams" as any).select("id, garden_id, kindergarten_id, name, area, camera_type, source_type,source_category,camera_zone_label,system_type,deployment_scope,test_site_type,camera_provider_key,gateway_provider_preference,live_preview_status,clip_readiness_status,snapshot_readiness_status,permission_model, stream_status, health_status, last_seen, connection_method, protocol, status, active, parent_view_allowed, parent_viewing_allowed,parent_visibility_status,parent_blocked_reason,staff_view_allowed,inspector_view_allowed,inspector_access_policy,observer_enabled,observer_review_required,observer_confidence_threshold, last_health_check_at, last_test_status, last_test_message, last_test_at, gateway_registration_status, gateway_last_error, masked_connection_summary, video_gateway_stream_id, gateway_stream_id, viewing_hours,operating_hours, recording_enabled, retention_days, archive_policy, playback_hls_ready, playback_webrtc_ready").eq("garden_id", gardenId),
      supabase.from("gardens" as any).select("id, name, city").eq("id", gardenId).maybeSingle()
    ]);
    logSupabaseError("garden cameras", cameras.error); logSupabaseError("garden camera garden", garden.error);
    const rawCameras = (cameras.data ?? []) as any[];
    const filtered = rawCameras.filter((camera) => {
      if (params.filter === "offline" || params.filter === "issues" || params.camera === "issue") return !camera.active || !["online", "connected"].includes(camera.status);
      if (params.filter === "pending") return camera.status === "pending_gateway";
      return true;
    });
    return { cameras: filtered, gardens: garden.data ? [garden.data] : [], queryError: cameras.error || garden.error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { cameras: [] as any[], gardens: [] as any[], queryError: null as string | null });
  const filterLabel = params.filter === "offline" || params.filter === "issues" || params.camera === "issue" ? "מצלמות לא מחוברות" : params.filter === "pending" ? "מצלמות שממתינות לחיבור" : null;
  const cameras = result.data.cameras as any[];
  const online = cameras.filter((camera) => camera.active && ["online", "connected"].includes(camera.status)).length;
  const issues = cameras.filter((camera) => !camera.active || !["online", "connected"].includes(camera.status)).length;
  const parentAllowed = cameras.filter((camera) => camera.parent_view_allowed || camera.parent_viewing_allowed).length;
  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="מצלמות" appHome>
      <TeacherAppFrame title={`בוקר טוב, ${profile.full_name?.replace(/\[DEMO\]/gi, "").trim().split(" ")[0] || "מנהלת הגן"}`} subtitle="אזור מצלמות גננת" avatarUrl={(profile as any).profile_image_url ?? null} active="more">
        <TeacherPageTitle icon={Camera} title="אזור מצלמות" subtitle="צפייה, חיבור והרשאות צפייה בטוחות" action={<a className="button primary" href="/dashboard/garden/cameras?add=1#camera-management"><Plus size={18} /> הוספת מצלמה</a>} />
        <TeacherStatsGrid>
          <TeacherStatCard title="מצלמות" value={cameras.length} hint="בגן" icon={Video} tone="blue" />
          <TeacherStatCard title="מחוברות" value={online} hint="פעילות" icon={ShieldCheck} tone="green" />
          <TeacherStatCard title="דורשות טיפול" value={issues} hint="בדיקה" icon={CameraOff} tone={issues ? "red" : "green"} href="/dashboard/garden/cameras?filter=issues" />
          <TeacherStatCard title="צפיית הורים" value={parentAllowed} hint="מאושרות" icon={Eye} tone="purple" />
        </TeacherStatsGrid>
        <DashboardFilterChip label={filterLabel} clearHref="/dashboard/garden/cameras" isEmpty={cameras.length === 0} emptyTitle={filterLabel ? `אין כרגע ${filterLabel}` : undefined} emptyText="כל המצלמות במסנן הזה תקינות או שאין מצלמות מתאימות." />
        <AdminDataError message={result.error ?? result.data.queryError} />

        <TeacherSection title="גלריית מצלמות הגן" subtitle={process.env.VIDEO_GATEWAY_URL ? "Gateway מחובר לצפייה בטוחה" : "התצוגה מוכנה לחיבור Gateway, בלי לחשוף כתובות או סיסמאות"}>
          {cameras.length ? (
            <div className="ganenet-camera-gallery">
              {cameras.map((camera) => {
                const tone = cameraStatusTone(camera);
                return (
                  <article className={`ganenet-camera-card ${tone}`} key={camera.id}>
                    <div className="ganenet-camera-preview">
                      <Video size={42} />
                      <strong>{isCameraOnline(camera) ? "מוכנה לצפייה מאובטחת" : "ממתינה לחיבור בטוח"}</strong>
                      <small>{camera.area ?? camera.camera_zone_label ?? "אזור הגן"}</small>
                      <span className={`ganenet-camera-signal ${isCameraOnline(camera) ? "online" : ""}`} />
                    </div>
                    <div className="ganenet-camera-info">
                      <div className="ganenet-camera-heading">
                        <b>{camera.name ?? "מצלמת גן"}</b>
                        <span>{cameraStatusLabel(camera)}</span>
                      </div>
                      <div className="ganenet-camera-tags">
                        <span><RadioTower size={15} /> {camera.protocol ?? camera.connection_method ?? "חיבור מאובטח"}</span>
                        <span><Eye size={15} /> {cameraVisibilityLabel(camera)}</span>
                        <span><LockKeyhole size={15} /> {camera.masked_connection_summary ? "פרטי חיבור מוסתרים" : "ללא חשיפת סיסמאות"}</span>
                      </div>
                      <div className="ganenet-camera-actions">
                        <a href={`/dashboard/garden/cameras?camera=${camera.id}#camera-management`}><PlayCircle size={16} /> ניהול וצפייה</a>
                        <a href="/dashboard/garden/camera-health"><ShieldCheck size={16} /> בדיקת חיבור</a>
                      </div>
                      <GardenCameraCapabilityPanel cameraId={camera.id} />
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <TeacherEmptyState title="עדיין אין מצלמות מחוברות" text="אפשר להכין חיבור מצלמה בלי לחשוף כתובת RTSP או סיסמאות בדפדפן." action={<a className="button primary" href="/dashboard/garden/cameras?add=1#camera-management"><Plus size={18} /> הוספת מצלמה ראשונה</a>} />}
        </TeacherSection>

        <TeacherQuickActions title="פעולות מצלמה">
          <TeacherActionTile title="הוספת מצלמה" href="/dashboard/garden/cameras?add=1#camera-management" icon={Plus} tone="purple" />
          <TeacherActionTile title="מצלמות תקולות" href="/dashboard/garden/cameras?filter=issues" icon={CameraOff} tone="orange" />
          <TeacherActionTile title="הרשאות צפייה" href="/dashboard/garden/camera-health" icon={ShieldCheck} tone="green" />
        </TeacherQuickActions>

        <TeacherAiInsight>
          אין חשיפת RTSP או סיסמאות במסך הגננת. צפייה להורים נפתחת רק לפי מדיניות והרשאה.
        </TeacherAiInsight>

        <details className="teacher-management-details" id="camera-management" open={params.add === "1" || Boolean(params.camera)}>
          <summary>ניהול מצלמות מלא</summary>
          <CameraAdminManager cameras={cameras} gardens={result.data.gardens as any[]} gatewayConnected={Boolean(process.env.VIDEO_GATEWAY_URL)} defaultOpenAdd={params.add === "1"} showHealthCenter={false} />
        </details>
      </TeacherAppFrame>
    </DashboardShell>
  );
}
