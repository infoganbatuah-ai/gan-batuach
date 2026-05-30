"use client";

import { useState } from "react";
import { Camera, Play, ShieldCheck } from "lucide-react";
import { ParentCameraAccessDebug } from "@/components/parent-camera-access-debug";

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

export function CameraPlaybackCard({ camera, parentId, canRequestPlayback = true, parentView = false }: { camera: CameraRow; parentId?: string; canRequestPlayback?: boolean; parentView?: boolean }) {
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hlsUrl = camera.hls_playback_url ?? camera.sample_hls_url;
  const sourceType = camera.source_type ?? camera.camera_type ?? camera.protocol ?? "RTSP";
  const playbackSourceAvailable = Boolean(hlsUrl || camera.webrtc_playback_url || camera.gateway_stream_id || camera.video_gateway_stream_id);
  const connected = ["connected", "online"].includes(camera.status);
  const canOpenPlayback = canRequestPlayback && playbackSourceAvailable;

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
        {playbackUrl ? <video src={playbackUrl} controls playsInline preload="metadata" /> : <div className="camera-pending-frame"><Camera /><strong>{playbackSourceAvailable ? "מוכן לצפייה מאובטחת" : "המצלמה מורשית לצפייה אך עדיין לא מחובר מקור צפייה"}</strong><span>{playbackSourceAvailable ? "לחצו פתיחת צפייה כדי ליצור Token זמני." : "מצלמה מורשית, ממתינה לחיבור מקור צפייה."}</span></div>}
      </div>
      <div className="camera-card-body">
        <span className={connected ? "pill good" : "pill warn"}>{statusText[camera.status] ?? camera.status ?? "ממתין לחיבור Gateway"}</span>
        <h3>{camera.name ?? "מצלמה"}</h3>
        <p>{camera.gardens?.name ?? camera.garden_name ?? ""} · {camera.area ?? "אזור לא הוגדר"} · {sourceType}</p>
        {!playbackSourceAvailable ? <small className="gateway-setup-state">המצלמה מורשית לצפייה אך עדיין ממתינה לחיבור שידור</small> : null}
        <small><ShieldCheck size={13} /> הצפייה מאובטחת וזמנית. פרטי החיבור של המצלמה אינם נשלחים לדפדפן.</small>
        {camera.expected_parent_count !== undefined ? <div className="camera-admin-verification"><span>Camera ID: {camera.id}</span><span>Camera name: {camera.name ?? "-"}</span><span>active: {String(camera.active)}</span><span>status: {camera.status ?? "-"}</span><span>parent_view_allowed: {String(camera.parent_view_allowed)}</span><span>parent_viewing_allowed: {String(camera.parent_viewing_allowed)}</span><span>garden_id: {camera.garden_id ?? "-"}</span><span>kindergarten_id: {camera.kindergarten_id ?? "-"}</span><span>Sample HLS: {camera.sample_hls_url ? "exists" : "missing"}</span><span>gateway_stream_id: {(camera.gateway_stream_id || camera.video_gateway_stream_id) ? "exists" : "missing"}</span><span>הורים צפויים: {camera.expected_parent_count}</span><span>{camera.visibility_status ?? "בדיקת חשיפה"}</span><ParentCameraAccessDebug cameraId={camera.id} /></div> : null}
        <div className="profile-actions">
          <button className="button primary tiny" disabled={busy || !canOpenPlayback} type="button" onClick={() => start("HLS")}><Play size={14} /> {parentView ? "פתיחת צפייה" : "צפייה HLS"}</button>
          {!parentView ? <button className="button secondary tiny" disabled={busy || !canOpenPlayback || !camera.webrtc_playback_url} type="button" onClick={() => start("WebRTC")}>WebRTC</button> : null}
        </div>
        {message ? <small className={message.includes("נפתח") ? "payment-action-message" : "error-text"}>{message}</small> : null}
      </div>
    </article>
  );
}
