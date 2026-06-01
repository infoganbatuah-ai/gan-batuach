import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { AdminDataError } from "@/components/admin-data-state";
import { requireRole } from "@/lib/auth";
import { safeAdminData, logSupabaseError } from "@/lib/admin-safe";
import { buildCameraAuditSummary, describeCameraReadiness } from "@/lib/domain/camera-diagnostics";
import { createClient } from "@/lib/supabase/server";

export default async function AdminCameraAuditPage() {
  await requireRole(["admin"]);
  const result = await safeAdminData("camera audit", async () => {
    const supabase = await createClient();
    const columns = "id, garden_id, kindergarten_id, name, area, source_type, camera_type, protocol, status, stream_status, health_status, active, parent_view_allowed, parent_viewing_allowed, sample_hls_url, hls_playback_url, webrtc_playback_url, gateway_stream_id, video_gateway_stream_id, last_seen, last_successful_connection_at, last_stream_activity_at, failure_count, reconnect_attempts, recording_enabled, retention_days, archive_policy, is_demo, demo_batch_id, gardens(name, city)";
    const cameras = await supabase.from("camera_streams" as any).select(columns).limit(500);
    logSupabaseError("camera audit camera_streams", cameras.error);
    const rows = (cameras.data ?? []) as any[];
    return {
      cameras: rows,
      summary: buildCameraAuditSummary(rows),
      queryError: cameras.error ? "לא ניתן לטעון את אודיט המצלמות כרגע" : null
    };
  }, { cameras: [] as any[], summary: buildCameraAuditSummary([]), queryError: null as string | null });

  const rows = result.data.cameras as any[];
  const summary = result.data.summary;

  return (
    <DashboardShell role="admin" title="Camera Audit">
      <div className="dashboard-hero-card admin-hero-card">
        <div>
          <p className="eyebrow">Video Gateway readiness</p>
          <h1>אודיט תשתית מצלמות.</h1>
          <p>בדיקה ייעודית לאדמין: מלאי מצלמות, בריאות, מקורות צפייה, הרשאות הורים ומוכנות ל-Video Gateway עתידי.</p>
        </div>
        <Link className="button secondary" href="/dashboard/admin/cameras">ניהול מצלמות</Link>
      </div>
      <AdminDataError message={result.error ?? result.data.queryError} />
      <section className="grid cols-4 dashboard-panels">
        <article className="card metric-card"><span>סה״כ מצלמות</span><strong>{summary.total}</strong></article>
        <article className="card metric-card"><span>פעילות</span><strong>{summary.online}</strong></article>
        <article className="card metric-card"><span>אופליין / שגיאה</span><strong>{summary.offline}</strong></article>
        <article className="card metric-card"><span>דמו</span><strong>{summary.demo}</strong></article>
        <article className="card metric-card"><span>חסר מקור צפייה</span><strong>{summary.missingPlaybackSource}</strong></article>
        <article className="card metric-card"><span>בעיית הרשאה</span><strong>{summary.permissionIssues}</strong></article>
        <article className="card metric-card"><span>ללא שיוך גן</span><strong>{summary.orphan}</strong></article>
        <article className="card metric-card"><span>מוכנות</span><strong>{summary.productionReady ? "תקין" : "לטיפול"}</strong></article>
      </section>
      <section className="dashboard-section">
        <div className="section-heading">
          <h2>ממצאי מצלמות</h2>
          <p>האבחון הזה מיועד לאדמין בלבד. הורים לא רואים מזהים, מקורות, Gateway או נתוני RLS.</p>
        </div>
        {rows.length === 0 ? (
          <div className="empty-state"><strong>אין מצלמות לאודיט</strong><span>כאשר גנים יוסיפו מצלמות, תופיע כאן תמונת מוכנות מלאה.</span></div>
        ) : (
          <div className="procedure-list">
            {rows.map((camera) => {
              const readiness = describeCameraReadiness(camera);
              return (
                <article className="card procedure-card" key={camera.id}>
                  <div>
                    <span className={readiness.healthStatus === "online" ? "pill good" : readiness.healthStatus === "offline" ? "pill bad" : "pill warn"}>{readiness.healthStatus}</span>
                    <h3>{camera.name ?? "מצלמה"} · {camera.gardens?.name ?? "גן לא משויך"}</h3>
                    <p>{camera.area ?? "אזור לא הוגדר"} · {readiness.sourceType} · {readiness.parentViewing ? "צפיית הורים פעילה" : "צפיית הורים כבויה"}</p>
                    <small>Last seen: {camera.last_seen ? new Date(camera.last_seen).toLocaleString("he-IL") : "טרם"} · Failures: {camera.failure_count ?? 0} · Reconnects: {camera.reconnect_attempts ?? 0}</small>
                  </div>
                  <div className="procedure-meta">
                    <span className={readiness.playbackReady ? "pill good" : "pill warn"}>{readiness.playbackReady ? "מקור צפייה קיים" : "חסר מקור צפייה"}</span>
                    <span className={camera.recording_enabled ? "pill warn" : "pill"}>{camera.recording_enabled ? `הקלטה עתידית ${camera.retention_days ?? "-"} ימים` : "ללא הקלטה"}</span>
                    {readiness.issues.length ? <small>{readiness.issues.join(" · ")}</small> : <small>אין ממצא קריטי</small>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
