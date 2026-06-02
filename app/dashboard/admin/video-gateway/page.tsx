import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { VideoGatewayAdminDashboard } from "@/components/video-gateway-admin-dashboard";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { checkGatewayHealth, getGatewayProvider, isGatewayConfigured } from "@/lib/domain/video-gateway-client";
import { createClient } from "@/lib/supabase/server";

export default async function AdminVideoGatewayPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin video gateway", async () => {
    const supabase = await createClient();
    const health = await checkGatewayHealth();
    const cameras = await supabase
      .from("camera_streams" as any)
      .select("id, garden_id, kindergarten_id, name, area, system_type, source_type, status, stream_status, health_status, active, gateway_provider, gateway_source_id, gateway_playback_id, gateway_registration_status, gateway_last_error, gateway_registered_at, gateway_latency_ms, gateway_stream_count, gateway_failed_stream_count, recording_enabled, retention_days, storage_location, gardens(name)")
      .order("created_at", { ascending: false })
      .limit(300);
    const sessions = await supabase
      .from("camera_playback_sessions" as any)
      .select("id, profile_id, camera_id, kindergarten_id, playback_protocol, gateway_provider, started_at, ended_at, duration_seconds, camera_streams(name), profiles(full_name)")
      .order("started_at", { ascending: false })
      .limit(50);
    logSupabaseError("video gateway cameras", cameras.error);
    logSupabaseError("video gateway sessions", sessions.error);
    return {
      health,
      cameras: cameras.data ?? [],
      sessions: sessions.data ?? [],
      queryError: cameras.error ? "לא ניתן לטעון את נתוני המצלמות כרגע" : null
    };
  }, { health: null as any, cameras: [] as any[], sessions: [] as any[], queryError: null as string | null });
  return (
    <DashboardShell role="admin" title="Video Gateway">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">MediaMTX / go2rtc</p>
          <h1>תשתית Live Video Gateway.</h1>
          <p>אבחון ורישום מקורות וידאו מאובטח. אין חשיפת RTSP, סיסמאות או מפתחות Gateway בדפדפן.</p>
        </div>
        <span className={isGatewayConfigured() ? "pill good" : "pill warn"}>{isGatewayConfigured() ? getGatewayProvider() : "Gateway missing"}</span>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />
      <VideoGatewayAdminDashboard provider={getGatewayProvider()} configured={isGatewayConfigured()} health={result.data.health as any} cameras={result.data.cameras as any[]} sessions={result.data.sessions as any[]} />
    </DashboardShell>
  );
}
