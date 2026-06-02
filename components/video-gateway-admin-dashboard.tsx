"use client";

import { useState } from "react";

type Row = Record<string, any>;

async function postGateway(payload: unknown) {
  const response = await fetch("/api/admin/video-gateway", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "פעולת Gateway נכשלה");
  return body.data;
}

function statusTone(status?: string) {
  if (["registered", "connected", "healthy"].includes(status ?? "")) return "good";
  if (["failed", "offline", "error", "disabled"].includes(status ?? "")) return "bad";
  return "warn";
}

export function VideoGatewayAdminDashboard({ provider, configured, health, cameras, sessions }: { provider: string; configured: boolean; health: Row | null; cameras: Row[]; sessions: Row[] }) {
  const [rows, setRows] = useState(cameras);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function action(camera: Row, actionName: "register" | "retest" | "disable") {
    setBusy(camera.id); setError(null); setMessage(null);
    try {
      const data = await postGateway({ action: actionName, camera_id: camera.id });
      setRows((current) => current.map((row) => row.id === camera.id ? { ...row, ...(data.camera ?? {}) } : row));
      setMessage(data.message ?? "פעולת Gateway נשמרה.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "פעולת Gateway נכשלה");
    } finally {
      setBusy(null);
    }
  }

  const registered = rows.filter((camera) => camera.gateway_registration_status === "registered").length;
  const failed = rows.filter((camera) => ["failed", "offline", "error"].includes(camera.gateway_registration_status)).length;
  const pending = rows.filter((camera) => !camera.gateway_registration_status || ["pending_gateway", "registering"].includes(camera.gateway_registration_status)).length;

  return (
    <div className="stack">
      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
      <section className="grid cols-4 dashboard-panels">
        <article className="card metric-card"><span>Provider</span><strong>{provider}</strong></article>
        <article className="card metric-card"><span>Gateway</span><strong>{configured ? "configured" : "missing"}</strong></article>
        <article className="card metric-card"><span>Latency</span><strong>{health?.latencyMs ?? "-"}ms</strong></article>
        <article className="card metric-card"><span>Streams</span><strong>{health?.streamCount ?? registered}</strong></article>
      </section>
      <section className="grid cols-4 dashboard-panels">
        <article className="card metric-card"><span>Registered</span><strong>{registered}</strong></article>
        <article className="card metric-card"><span>Failed</span><strong>{failed}</strong></article>
        <article className="card metric-card"><span>Pending</span><strong>{pending}</strong></article>
        <article className="card metric-card"><span>Playback sessions</span><strong>{sessions.length}</strong></article>
      </section>
      <section className={configured ? "success-screen" : "gateway-setup-state"}>
        <strong>{configured ? "Gateway configured" : "Gateway not configured"}</strong>
        <p>המסך מציג אבחון אדמין בלבד. RTSP, סיסמאות ומפתחות Gateway לא מוצגים בדפדפן.</p>
      </section>
      <section className="dashboard-section">
        <div className="section-heading"><h2>Camera source registration</h2><p>רישום מקור, בדיקת חיבור והשבתה ללא חשיפת פרטי מקור.</p></div>
        {rows.length === 0 ? <div className="empty-state"><strong>אין מצלמות</strong><span>כאשר מצלמות יוגדרו, ניתן יהיה לרשום אותן ל-Gateway כאן.</span></div> : <div className="procedure-list">{rows.map((camera) => <article className="card procedure-card" key={camera.id}><div><span className={`pill ${statusTone(camera.gateway_registration_status)}`}>{camera.gateway_registration_status ?? "pending_gateway"}</span><h3>{camera.name}</h3><p>{camera.gardens?.name ?? camera.garden_id} · {camera.area ?? "אזור"} · {camera.system_type ?? camera.source_type ?? "camera"}</p><small>Provider: {camera.gateway_provider ?? provider} · Source ID: {camera.gateway_source_id ? "exists" : "missing"} · Last error: {camera.gateway_last_error ?? "none"}</small></div><div className="procedure-meta"><button className="button secondary" disabled={busy === camera.id} onClick={() => action(camera, "register")}>Re-register</button><button className="button secondary" disabled={busy === camera.id} onClick={() => action(camera, "retest")}>Retest</button><button className="button secondary" disabled={busy === camera.id} onClick={() => action(camera, "disable")}>Disable</button></div></article>)}</div>}
      </section>
      <section className="card action-panel">
        <h2>Recent playback sessions</h2>
        {sessions.length === 0 ? <div className="empty-mini">אין sessions להצגה.</div> : sessions.map((session) => <div className="list-item" key={session.id}><div><strong>{session.camera_streams?.name ?? session.camera_id}</strong><span>{session.profiles?.full_name ?? session.profile_id} · {session.playback_protocol} · {session.started_at ? new Date(session.started_at).toLocaleString("he-IL") : ""}</span></div><span className="pill">{session.gateway_provider ?? provider}</span></div>)}
      </section>
    </div>
  );
}
