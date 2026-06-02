import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { CameraAdminManager } from "@/components/camera-ai-admin-modules";
import { DashboardFilterChip } from "@/components/dashboard-filter-chip";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function GardenCameraSetupPage({ searchParams }: { searchParams: Promise<{ filter?: string; camera?: string }> }) {
  const { profile } = await requireRole(["manager", "owner"]);
  const params = await searchParams;
  const gardenId = profile.garden_id ?? "";
  const result = await safeAdminData("garden cameras", async () => {
    const supabase = await createClient();
    const [cameras, garden] = await Promise.all([
      supabase.from("camera_streams" as any).select("id, garden_id, kindergarten_id, name, area, camera_type, source_type, stream_status, health_status, last_seen, connection_method, protocol, status, active, parent_view_allowed, parent_viewing_allowed, last_health_check_at, hls_playback_url, sample_hls_url, webrtc_playback_url, video_gateway_stream_id, gateway_stream_id, viewing_hours, recording_enabled, retention_days, archive_policy").eq("garden_id", gardenId),
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
  const filterLabel = params.filter === "offline" || params.filter === "issues" || params.camera === "issue" ? "מצלמות לא מחוברות / תקולות" : params.filter === "pending" ? "מצלמות שממתינות לחיבור Gateway" : null;
  return <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="מצלמות"><div className="dashboard-hero-card"><div><p className="eyebrow">Camera Viewing</p><h1>תצפיתן דיגיטלי - צפייה במצלמות.</h1><p>מנהלת גן רואה ומגדירה רק את המצלמות המשויכות לגן שלה. RTSP וסיסמאות לא מוצגים בדפדפן.</p></div><span className={process.env.VIDEO_GATEWAY_URL ? "pill good" : "pill warn"}>{process.env.VIDEO_GATEWAY_URL ? "Gateway connected" : "Gateway pending"}</span></div><DashboardFilterChip label={filterLabel} clearHref="/dashboard/garden/cameras" isEmpty={(result.data.cameras as any[]).length === 0} emptyTitle={filterLabel ? `אין כרגע ${filterLabel}` : undefined} emptyText="כל המצלמות במסנן הזה תקינות או שאין מצלמות מתאימות." /><AdminDataError message={result.error ?? result.data.queryError} /><CameraAdminManager cameras={result.data.cameras as any[]} gardens={result.data.gardens as any[]} gatewayConnected={Boolean(process.env.VIDEO_GATEWAY_URL)} /></DashboardShell>;
}
