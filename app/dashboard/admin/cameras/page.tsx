import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { CameraAdminManager } from "@/components/camera-ai-admin-modules";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";

export default async function AdminCamerasPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin cameras", async () => {
    const supabase = await createClient();
    const [cameras, gardens] = await Promise.all([supabase.from("camera_streams" as any).select("id, garden_id, name, area, camera_type, protocol, status, active, parent_view_allowed, last_health_check_at, gardens(name, city)").limit(100), supabase.from("gardens" as any).select("id, name, city").limit(200)]);
    logSupabaseError("admin cameras", cameras.error); logSupabaseError("admin camera gardens", gardens.error);
    return { cameras: cameras.data ?? [], gardens: gardens.data ?? [], queryError: cameras.error || gardens.error ? "לא ניתן לטעון את הנתונים כרגע" : null };
  }, { cameras: [] as any[], gardens: [] as any[], queryError: null as string | null });
  return <DashboardShell role="admin" title="מצלמות"><div className="dashboard-hero-card admin-hero-card"><div><p className="eyebrow">Camera Management</p><h1>ניהול מצלמות, Gateway והרשאות.</h1><p>DVR/NVR/IP/RTSP/ONVIF נשמרים במערכת, Live דורש Video Gateway.</p></div><span className={process.env.VIDEO_GATEWAY_URL ? "pill good" : "pill warn"}>{process.env.VIDEO_GATEWAY_URL ? "Gateway connected" : "Gateway missing"}</span></div><AdminDataError message={result.error ?? result.data.queryError} /><CameraAdminManager cameras={result.data.cameras as any[]} gardens={result.data.gardens as any[]} gatewayConnected={Boolean(process.env.VIDEO_GATEWAY_URL)} /></DashboardShell>;
}
