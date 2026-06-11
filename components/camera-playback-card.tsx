"use client";

import { useState } from "react";
import { Camera, Play, ShieldCheck } from "lucide-react";
import { ParentCameraAccessDebug } from "@/components/parent-camera-access-debug";

type CameraRow = Record<string, any>;

const statusText: Record<string, string> = {
  pending_gateway: "ממתין לחיבור שידור",
  connected: "מחובר",
  online: "מחובר",
  offline: "לא מחובר",
  failed: "לא מחובר",
  error: "לא מחובר",
  disabled: "לא מחובר"
};

export function CameraPlaybackCard({ camera, parentId, canRequestPlayback = true, parentView = false, accessReason }: { camera: CameraRow; parentId?: string; canRequestPlayback?: boolean; parentView?: boolean; accessReason?: string }) {
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hlsUrl = camera.hls_playback_url ?? camera.sample_hls_url;
  const sourceType = camera.source_type ?? camera.camera_type ?? camera.protocol ?? "RTSP";
  const playbackSourceAvailable = camera.playback_source_available !== undefined
    ? Boolean(camera.playback_source_available)
    : Boolean(hlsUrl || camera.webrtc_playback_url || camera.gateway_stream_id || camera.video_gateway_stream_id);
  const connected = ["connected", "online"].includes(camera.status);
  const blockedReason = camera.parent_blocked_reason ?? (!playbackSourceAvailable ? "המצלמה לא זמינה כרגע" : null);
  const canOpenPlayback = canRequestPlayback && playbackSourceAvailable && (!parentView || !blockedReason);

  async function start(protocol: "HLS" | "WebRTC" = "HLS") {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/camera-streams/${camera.id}/playback-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocol, parent_id: parentId || undefined, access_reason: accessReason })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "לא ניתן לפתוח צפייה כרגע");
      setPlaybackUrl(body.data.playback_url);
      setMessage("נפתחה צפייה זמנית ומתועדת.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא ניתן לפתוח צפייה כרגע");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card camera-playback-card">
      <div className="camera-player-frame">
        {playbackUrl ? <video src={playbackUrl} controls playsInline preload="metadata" /> : <div className="camera-pending-frame"><Camera /><strong>{blockedReason ?? (playbackSourceAvailable ? "מוכן לצפייה מאובטחת" : "המצלמה לא זמינה כרגע")}</strong><span>{playbackSourceAvailable && !blockedReason ? "לחצו לפתיחת צפייה מאובטחת." : "הצפייה תיפתח כשכללי הגן והחיבור יאפשרו זאת."}</span></div>}
      </div>
      <div className="camera-card-body">
        <span className={connected ? "pill good" : "pill warn"}>{statusText[camera.status] ?? camera.status ?? "ממתין לחיבור שידור"}</span>
        <h3>{camera.name ?? "מצלמה"}</h3>
        <p>{parentView ? `${camera.area ?? "אזור לא הוגדר"}` : `${camera.gardens?.name ?? camera.garden_name ?? ""} · ${camera.area ?? "אזור לא הוגדר"} · ${sourceType}`}</p>
        {blockedReason ? <small className="gateway-setup-state">{blockedReason}</small> : !playbackSourceAvailable ? <small className="gateway-setup-state">המצלמה ממתינה לחיבור שידור</small> : null}
        <small><ShieldCheck size={13} /> הצפייה מאובטחת וזמנית. פרטי החיבור של המצלמה אינם נשלחים לדפדפן.</small>
        {!parentView && camera.expected_parent_count !== undefined ? <div className="camera-admin-verification"><span>מזהה מצלמה: {camera.id}</span><span>שם מצלמה: {camera.name ?? "-"}</span><span>זמינה: {camera.active === false ? "לא" : "כן"}</span><span>מצב: {statusText[camera.status] ?? camera.status ?? "-"}</span><span>צפיית הורים: {camera.parent_view_allowed || camera.parent_viewing_allowed ? "מאושרת" : "לא מאושרת"}</span><span>גן: {camera.garden_id ?? camera.kindergarten_id ?? "-"}</span><span>מקור בדיקה: {camera.sample_hls_url ? "קיים" : "חסר"}</span><span>חיבור שידור: {(camera.gateway_stream_id || camera.video_gateway_stream_id) ? "קיים" : "חסר"}</span><span>הורים צפויים: {camera.expected_parent_count}</span><span>{camera.visibility_status ?? "בדיקת חשיפה"}</span><ParentCameraAccessDebug cameraId={camera.id} /></div> : null}
        <div className="profile-actions">
          <button className="button primary tiny" disabled={busy || !canOpenPlayback} type="button" onClick={() => start("HLS")}><Play size={14} /> {parentView ? "פתיחת צפייה" : "צפייה HLS"}</button>
          {!parentView ? <button className="button secondary tiny" disabled={busy || !canOpenPlayback || !camera.webrtc_playback_url} type="button" onClick={() => start("WebRTC")}>WebRTC</button> : null}
        </div>
        {message ? <small className={message.includes("נפתח") || message.includes("נפתחה") ? "payment-action-message" : "error-text"}>{message}</small> : null}
      </div>
    </article>
  );
}
