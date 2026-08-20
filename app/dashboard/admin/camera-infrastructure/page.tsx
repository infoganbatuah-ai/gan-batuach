import Link from "next/link";
import { Camera, Database, HardDrive, RadioTower, ShieldCheck, Video } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildCameraInfrastructureSummary, cameraDiagnosticsFor, cameraProviderRegistry } from "@/lib/domain/real-camera-infrastructure";

function statusPill(status: string) {
  if (["online", "connected", "registered", "ready"].includes(status)) return "pill good";
  if (["offline", "failed", "error"].includes(status)) return "pill bad";
  return "pill warn";
}

export default async function AdminCameraInfrastructurePage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("admin camera infrastructure", async () => {
    const supabase = await createClient();
    const safeCameraColumns = "id,garden_id,kindergarten_id,observer_site_id,name,area,camera_type,source_type,system_type,deployment_scope,test_site_type,camera_provider_key,gateway_provider_preference,live_preview_status,clip_readiness_status,snapshot_readiness_status,permission_model,stream_status,health_status,last_seen,connection_method,protocol,status,active,parent_view_allowed,parent_viewing_allowed,last_health_check_at,last_test_status,last_test_message,last_test_at,gateway_registration_status,gateway_last_error,masked_connection_summary,video_gateway_stream_id,gateway_stream_id,gateway_provider,gateway_source_id,gateway_playback_id,gateway_registered_at,gateway_latency_ms,gateway_stream_count,gateway_failed_stream_count,viewing_hours,recording_enabled,retention_days,archive_policy,recording_status,recording_retention_days,recording_storage_location,storage_provider,storage_mode,estimated_daily_storage_mb,recording_storage_used_mb,playback_hls_ready,playback_webrtc_ready,created_at,updated_at";
    const [camerasRes, validationsRes, healthRes, recordingRes, storageRes, sessionsRes, providersRes, gatewaysRes, testSitesRes] = await Promise.all([
      supabase.from("camera_streams" as any).select(safeCameraColumns).order("created_at", { ascending: false }).limit(300),
      supabase.from("camera_stream_validations" as any).select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("camera_health_history" as any).select("*").order("checked_at", { ascending: false }).limit(200),
      supabase.from("camera_recording_readiness" as any).select("*").order("updated_at", { ascending: false }).limit(200),
      supabase.from("camera_storage_readiness" as any).select("*").order("updated_at", { ascending: false }).limit(200),
      supabase.from("camera_playback_sessions" as any).select("*").order("started_at", { ascending: false }).limit(200),
      supabase.from("camera_provider_registry" as any).select("*").order("provider_name"),
      supabase.from("camera_gateway_deployments" as any).select("*").order("provider"),
      supabase.from("camera_deployment_test_sites" as any).select("*").order("site_key")
    ]);
    [camerasRes, validationsRes, healthRes, recordingRes, storageRes, sessionsRes, providersRes, gatewaysRes, testSitesRes].forEach((query, index) => logSupabaseError(`camera infrastructure query ${index}`, (query as any).error));
    const cameras = (camerasRes.data ?? []) as any[];
    return {
      cameras,
      validations: validationsRes.data ?? [],
      healthHistory: healthRes.data ?? [],
      recording: recordingRes.data ?? [],
      storage: storageRes.data ?? [],
      sessions: sessionsRes.data ?? [],
      providers: providersRes.data ?? [],
      gateways: gatewaysRes.data ?? [],
      testSites: testSitesRes.data ?? [],
      summary: buildCameraInfrastructureSummary(cameras, (validationsRes.data ?? []) as any[], (sessionsRes.data ?? []) as any[]),
      queryError: [camerasRes.error, validationsRes.error, healthRes.error, recordingRes.error, storageRes.error, sessionsRes.error, providersRes.error, gatewaysRes.error, testSitesRes.error].some(Boolean) ? "חלק מנתוני תשתית המצלמות לא נטענו" : null
    };
  }, { cameras: [] as any[], validations: [] as any[], healthHistory: [] as any[], recording: [] as any[], storage: [] as any[], sessions: [] as any[], providers: [] as any[], gateways: [] as any[], testSites: [] as any[], summary: buildCameraInfrastructureSummary([]), queryError: null as string | null });

  const { summary } = result.data;
  const providers = result.data.providers.length ? result.data.providers : Object.entries(cameraProviderRegistry).map(([provider_key, provider]) => ({ provider_key, provider_name: provider.name, capabilities: provider.capabilities }));
  const diagnostics = result.data.cameras.slice(0, 24).map((camera: any) => ({ camera, diagnostics: cameraDiagnosticsFor(camera) }));

  return (
    <DashboardShell role="admin" title="Camera Infrastructure">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Real Camera Infrastructure</p>
          <h1>תשתית מצלמות מוכנה לייצור.</h1>
          <p>DVR/NVR/IP/RTSP/ONVIF, Gateway, HLS/WebRTC, בריאות, הקלטה ואחסון מוצגים כמוכנות בלבד. אין חשיפת RTSP או סיסמאות.</p>
        </div>
        <div className="profile-actions">
          <span className={summary.gatewayConfigured ? "pill good" : "pill warn"}>{summary.gatewayConfigured ? "Gateway configured" : "Gateway pending"}</span>
          <Link className="button secondary" href="/dashboard/admin/video-gateway">שרת וידאו</Link>
        </div>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="grid cols-4 dashboard-kpis">
        <StatCard label="מצלמות" value={summary.total} tone="good" />
        <StatCard label="Online" value={summary.online} tone={summary.online ? "good" : "warn"} />
        <StatCard label="Offline" value={summary.offline} tone={summary.offline ? "bad" : "good"} />
        <StatCard label="Degraded" value={summary.degraded} tone={summary.degraded ? "warn" : "good"} />
        <StatCard label="HLS מוכן" value={summary.hlsReady} tone={summary.hlsReady ? "good" : "warn"} />
        <StatCard label="WebRTC מוכן" value={summary.webrtcReady} tone={summary.webrtcReady ? "good" : "warn"} />
        <StatCard label="הקלטה מוכנה" value={summary.recordingReady} tone={summary.recordingReady ? "good" : "warn"} />
        <StatCard label="אחסון מוכן" value={summary.storageReady} tone={summary.storageReady ? "good" : "warn"} />
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><RadioTower size={20} /> ספקי מצלמות</h2><p>יכולות לפי יצרן וסוג מערכת.</p></div>
          <div className="procedure-list compact-list">
            {providers.map((provider: any) => (
              <div className="mini-row" key={provider.provider_key}>
                <span>{provider.provider_name}</span>
                <strong>{summary.providerCounts[provider.provider_key] ?? 0} מצלמות</strong>
                <small>{Object.entries(provider.capabilities ?? {}).filter(([, enabled]) => enabled).map(([key]) => key).slice(0, 4).join(" · ")}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><HardDrive size={20} /> הקלטה ואחסון</h2><p>מוכנות בלבד. אין הקלטה אמיתית בשלב הזה.</p></div>
          <div className="risk-list">
            <div><Video /> HLS playback <b>{summary.hlsReady}/{summary.total}</b></div>
            <div><Camera /> WebRTC playback <b>{summary.webrtcReady}/{summary.total}</b></div>
            <div><HardDrive /> Recording readiness <b>{summary.recordingReady}/{summary.total}</b></div>
            <div><Database /> Storage readiness <b>{summary.storageReady}/{summary.total}</b></div>
            <div><ShieldCheck /> Secrets <b>לא מוצגים בדפדפן</b></div>
          </div>
        </article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><RadioTower size={20} /> Gateway</h2><p>MediaMTX, go2rtc או ספק מותאם.</p></div>
          <div className="procedure-list compact-list">
            {result.data.gateways.length === 0 ? <div className="empty-mini">אין רשומות Gateway עדיין.</div> : result.data.gateways.map((gateway: any) => (
              <div className="mini-row" key={`${gateway.provider}-${gateway.environment}`}>
                <span>{gateway.provider}</span>
                <strong>{gateway.status} · {gateway.health_status}</strong>
                <small>{gateway.active_streams ?? 0} פעילים · {gateway.failed_streams ?? 0} נכשלים</small>
              </div>
            ))}
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><ShieldCheck size={20} /> מצבי בדיקה</h2><p>בדיקות מבודדות לפני חיבור גן אמיתי.</p></div>
          <div className="procedure-list compact-list">
            {result.data.testSites.length === 0 ? <div className="empty-mini">אין אתרי בדיקה עדיין.</div> : result.data.testSites.map((site: any) => (
              <div className="mini-row" key={site.site_key}>
                <span>{site.display_name}</span>
                <strong>{site.site_type}</strong>
                <small>{site.isolated_from_kindergarten_data ? "מבודד מנתוני ייצור" : "דורש בדיקה"}</small>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>Camera Diagnostics</h2><p>קישוריות, latency, בריאות, Gateway, Playback, הקלטה ואחסון.</p></div>
        {diagnostics.length === 0 ? <div className="empty-state"><strong>אין מצלמות להצגה</strong><span>לאחר הוספת מצלמות, האבחון יופיע כאן.</span></div> : <div className="procedure-list">{diagnostics.map(({ camera, diagnostics: item }: any) => (
          <article className="card procedure-card" key={camera.id}>
            <div>
              <span className={statusPill(item.healthStatus)}>{item.healthStatus}</span>
              <h3>{camera.name ?? "מצלמה"}</h3>
              <p>{item.providerName} · {camera.area ?? "אזור לא צוין"} · Gateway: {item.registrationStatus}</p>
              <small>Latency: {item.latencyMs ?? "-"}ms · HLS: {item.playback.hlsReady ? "מוכן" : "לא"} · WebRTC: {item.playback.webrtcReady ? "מוכן" : "לא"}</small>
            </div>
            <div className="procedure-meta">
              <span className={item.recording.configured ? "pill good" : "pill warn"}>Recording {item.recording.configured ? "ready" : "pending"}</span>
              <span className={item.storage.configured ? "pill good" : "pill warn"}>Storage {item.storage.configured ? "ready" : "pending"}</span>
              <span className={item.observer.aiObserverReady ? "pill good" : "pill warn"}>Observer {item.observer.aiObserverReady ? "ready" : "pending"}</span>
            </div>
          </article>
        ))}</div>}
      </section>
    </DashboardShell>
  );
}
