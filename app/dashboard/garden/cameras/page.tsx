import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { CameraAdminManager } from "@/components/camera-ai-admin-modules";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function GardenCameraSetupPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  const result = await safeAdminData("garden cameras", async () => {
    const supabase = await createClient();
    const [cameras, garden] = await Promise.all([
      supabase.from("camera_streams" as any).select("id, garden_id, kindergarten_id, name, area, camera_type, source_type, protocol, status, active, parent_view_allowed, parent_viewing_allowed, last_health_check_at, hls_playback_url, sample_hls_url, webrtc_playback_url, video_gateway_stream_id, gateway_stream_id, viewing_hours").eq("garden_id", gardenId),
      supabase.from("gardens" as any).select("id, name, city").eq("id", gardenId).maybeSingle()
    ]);
    logSupabaseError("garden cameras", cameras.error); logSupabaseError("garden camera garden", garden.error);
    return { cameras: cameras.data ?? [], gardens: garden.data ? [garden.data] : [], queryError: cameras.error || garden.error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { cameras: [] as any[], gardens: [] as any[], queryError: null as string | null });
  return <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="מצלמות"><div className="dashboard-hero-card"><div><p className="eyebrow">Camera Viewing</p><h1>תצפיתן דיגיטלי - צפייה במצלמות.</h1><p>מנהלת גן רואה ומגדירה רק את המצלמות המשויכות לגן שלה. RTSP וסיסמאות לא מוצגים בדפדפן.</p></div><span className={process.env.VIDEO_GATEWAY_URL ? "pill good" : "pill warn"}>{process.env.VIDEO_GATEWAY_URL ? "Gateway connected" : "Gateway pending"}</span></div><AdminDataError message={result.error ?? result.data.queryError} /><CameraAdminManager cameras={result.data.cameras as any[]} gardens={result.data.gardens as any[]} gatewayConnected={Boolean(process.env.VIDEO_GATEWAY_URL)} /></DashboardShell>;
}
