"use client";

import { useState } from "react";
import { Camera, Play, ShieldCheck } from "lucide-react";

type CameraRow = Record<string, any>;

const statusText: Record<string, string> = {
  pending_gateway: "ממתין לחיבור Gateway",
  connected: "מחובר",
  online: "מחובר",
  offline: "לא מחובר",
  failed: "לא מחובר",
  error: "לא מחובר",
  disabled: "לא מחובר"
};

export function CameraPlaybackCard({ camera, parentId, canRequestPlayback = true }: { camera: CameraRow; parentId?: string; canRequestPlayback?: boolean }) {
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hlsUrl = camera.hls_playback_url ?? camera.sample_hls_url;
  const sourceType = camera.source_type ?? camera.camera_type ?? camera.protocol ?? "RTSP";
  const connected = ["connected", "online"].includes(camera.status) || Boolean(hlsUrl || camera.webrtc_playback_url);

  async function start(protocol: "HLS" | "WebRTC" = "HLS") {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/camera-streams/${camera.id}/playback-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocol, parent_id: parentId || undefined })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן לפתוח צפייה כרגע");
      setPlaybackUrl(body.data.playback_url);
      setMessage("נפתח Session צפייה זמני ומתועד.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא ניתן לפתוח צפייה כרגע");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card camera-playback-card">
      <div className="camera-player-frame">
        {playbackUrl ? <video src={playbackUrl} controls playsInline preload="metadata" /> : <div className="camera-pending-frame"><Camera /><strong>{connected ? "מוכן לצפייה מאובטחת" : "ממתין לחיבור Gateway"}</strong><span>{connected ? "לחצו פתיחת צפייה כדי ליצור Token זמני." : "המצלמה שמורה, אך אין עדיין HLS/WebRTC זמין."}</span></div>}
      </div>
      <div className="camera-card-body">
        <span className={connected ? "pill good" : "pill warn"}>{statusText[camera.status] ?? camera.status ?? "ממתין לחיבור Gateway"}</span>
        <h3>{camera.name ?? "מצלמה"}</h3>
        <p>{camera.gardens?.name ?? camera.garden_name ?? ""} · {camera.area ?? "אזור לא הוגדר"} · {sourceType}</p>
        <small><ShieldCheck size={13} /> RTSP וסיסמאות לא נשלחים לדפדפן. הצפייה דרך Playback URL זמני בלבד.</small>
        <div className="profile-actions">
          <button className="button primary tiny" disabled={busy || !canRequestPlayback || !connected} type="button" onClick={() => start("HLS")}><Play size={14} /> צפייה HLS</button>
          <button className="button secondary tiny" disabled={busy || !canRequestPlayback || !connected || !camera.webrtc_playback_url} type="button" onClick={() => start("WebRTC")}>WebRTC</button>
        </div>
        {message ? <small className={message.includes("נפתח") ? "payment-action-message" : "error-text"}>{message}</small> : null}
      </div>
    </article>
  );
}
