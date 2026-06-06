import Link from "next/link";
import { Camera, HardDrive, RadioTower, Video } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/stat-card";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { createClient } from "@/lib/supabase/server";
import { buildCameraInfrastructureSummary, cameraDiagnosticsFor } from "@/lib/domain/real-camera-infrastructure";

function statusPill(status: string) {
  if (["online", "connected", "registered", "ready"].includes(status)) return "pill good";
  if (["offline", "failed", "error"].includes(status)) return "pill bad";
  return "pill warn";
}

export default async function GardenCameraHealthPage() {
  const { profile } = await requireRole(["manager", "owner"]);
  const gardenId = profile.garden_id ?? "";
  const result = await safeAdminData("garden camera health", async () => {
    const supabase = await createClient();
    const [camerasRes, validationsRes, healthRes, recordingRes, storageRes] = await Promise.all([
      supabase.from("camera_streams" as any).select("*").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(200),
      supabase.from("camera_stream_validations" as any).select("*").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(100),
      supabase.from("camera_health_history" as any).select("*").eq("garden_id", gardenId).order("checked_at", { ascending: false }).limit(100),
      supabase.from("camera_recording_readiness" as any).select("*").eq("garden_id", gardenId).order("updated_at", { ascending: false }).limit(100),
      supabase.from("camera_storage_readiness" as any).select("*").eq("garden_id", gardenId).order("updated_at", { ascending: false }).limit(20)
    ]);
    [camerasRes, validationsRes, healthRes, recordingRes, storageRes].forEach((query, index) => logSupabaseError(`garden camera health query ${index}`, (query as any).error));
    const cameras = (camerasRes.data ?? []) as any[];
    return {
      cameras,
      validations: validationsRes.data ?? [],
      healthHistory: healthRes.data ?? [],
      recording: recordingRes.data ?? [],
      storage: storageRes.data ?? [],
      summary: buildCameraInfrastructureSummary(cameras, (validationsRes.data ?? []) as any[]),
      queryError: [camerasRes.error, validationsRes.error, healthRes.error, recordingRes.error, storageRes.error].some(Boolean) ? "חלק מנתוני בריאות המצלמות לא נטענו" : null
    };
  }, { cameras: [] as any[], validations: [] as any[], healthHistory: [] as any[], recording: [] as any[], storage: [] as any[], summary: buildCameraInfrastructureSummary([]), queryError: null as string | null });

  const diagnostics = result.data.cameras.map((camera: any) => ({ camera, diagnostics: cameraDiagnosticsFor(camera) }));
  const { summary } = result.data;

  return (
    <DashboardShell role={profile.role === "owner" ? "owner" : "manager"} title="בריאות מצלמות">
      <div className="dashboard-hero-card">
        <div>
          <p className="eyebrow">Camera Health Center</p>
          <h1>מרכז בריאות מצלמות.</h1>
          <p>מצב חיבור, Gateway, צפייה, הקלטה עתידית ואחסון. אין חשיפת כתובות RTSP או סיסמאות.</p>
        </div>
        <div className="profile-actions">
          <span className={summary.gatewayConfigured ? "pill good" : "pill warn"}>{summary.gatewayConfigured ? "Gateway מחובר" : "ממתין ל-Gateway"}</span>
          <Link className="button secondary" href="/dashboard/garden/cameras">ניהול מצלמות</Link>
        </div>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />

      <section className="grid cols-4 dashboard-kpis">
        <StatCard label="מצלמות" value={summary.total} tone="good" />
        <StatCard label="Online" value={summary.online} tone={summary.online ? "good" : "warn"} />
        <StatCard label="Offline" value={summary.offline} tone={summary.offline ? "bad" : "good"} />
        <StatCard label="Degraded" value={summary.degraded} tone={summary.degraded ? "warn" : "good"} />
        <StatCard label="צפייה מוכנה" value={summary.playbackReady} tone={summary.playbackReady ? "good" : "warn"} />
        <StatCard label="HLS" value={summary.hlsReady} tone={summary.hlsReady ? "good" : "warn"} />
        <StatCard label="הקלטה עתידית" value={summary.recordingReady} tone={summary.recordingReady ? "good" : "warn"} />
        <StatCard label="אחסון" value={summary.storageReady} tone={summary.storageReady ? "good" : "warn"} />
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading"><h2><Video size={20} /> צפייה</h2><p>HLS/WebRTC מוכנים רק דרך Gateway או Sample HLS.</p></div>
          <div className="risk-list">
            <div><Camera /> מקורות צפייה <b>{summary.playbackReady}/{summary.total}</b></div>
            <div><RadioTower /> Gateway <b>{summary.gatewayConfigured ? "מוגדר" : "לא מוגדר"}</b></div>
            <div><HardDrive /> אחסון עתידי <b>{summary.storageReady}/{summary.total}</b></div>
          </div>
        </article>
        <article className="card action-panel">
          <div className="section-heading"><h2><HardDrive size={20} /> הקלטה ואחסון</h2><p>מוכנות בלבד. אין הקלטה אמיתית בשלב הזה.</p></div>
          <div className="risk-list">
            <div>Recording readiness <b>{summary.recordingReady}/{summary.total}</b></div>
            <div>Storage readiness <b>{summary.storageReady}/{summary.total}</b></div>
            <div>Playback sessions <b>{summary.playbackSessions}</b></div>
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>אבחון מצלמות</h2><p>מצב תפעולי פשוט וברור לכל מצלמה.</p></div>
        {diagnostics.length === 0 ? <div className="empty-state"><strong>אין מצלמות עדיין</strong><span>הוסיפו מצלמה ראשונה במסך ניהול מצלמות.</span></div> : <div className="procedure-list">{diagnostics.map(({ camera, diagnostics: item }: any) => (
          <article className="card procedure-card" key={camera.id}>
            <div>
              <span className={statusPill(item.healthStatus)}>{item.healthStatus}</span>
              <h3>{camera.name ?? "מצלמה"}</h3>
              <p>{item.providerName} · {camera.area ?? "אזור לא צוין"} · {item.registrationStatus}</p>
              <small>HLS: {item.playback.hlsReady ? "מוכן" : "לא"} · WebRTC: {item.playback.webrtcReady ? "מוכן" : "לא"} · Recording: {item.recording.configured ? "מוכן" : "ממתין"}</small>
            </div>
            <div className="procedure-meta">
              <span className={item.safe.noRtspExposed ? "pill good" : "pill bad"}>RTSP מוסתר</span>
              <span className={item.storage.configured ? "pill good" : "pill warn"}>Storage {item.storage.configured ? "ready" : "pending"}</span>
            </div>
          </article>
        ))}</div>}
      </section>
    </DashboardShell>
  );
}
