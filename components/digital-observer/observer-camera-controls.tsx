"use client";

import { Camera, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Lightbulb, Mic, Search, Siren, VideoOff, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";

type Evidence = { supported?: boolean; method?: string; tested_at?: string; adapter?: string | null; reason?: string | null };
type ActionType = "talkback" | "ptz_pan" | "ptz_tilt" | "ptz_zoom" | "light_on" | "light_off" | "siren_on" | "siren_off" | "relay_on" | "relay_off";

function liveVideo(cameraSourceId: string) {
  return document.querySelector<HTMLVideoElement>(`video[data-camera-source-id="${CSS.escape(cameraSourceId)}"]`);
}

function evidenceMap(capabilities: Record<string, unknown>) {
  const value = capabilities.capability_evidence;
  return value && typeof value === "object" ? value as Record<string, Evidence> : {};
}

function isVerified(evidence?: Evidence) {
  if (!evidence?.supported || !evidence.method || evidence.method === "not_tested" || !evidence.tested_at || !evidence.adapter) return false;
  const testedAt = Date.parse(evidence.tested_at);
  return Number.isFinite(testedAt) && Date.now() - testedAt <= 24 * 60 * 60 * 1000;
}

async function postAction(body: Record<string, unknown>) {
  const response = await fetch("/api/digital-observer/camera-actions", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "לא ניתן לבצע את הפעולה.");
  return data;
}

export function ObserverCameraControls({
  observerSiteId,
  cameraSourceId,
  name,
  capabilities = {}
}: {
  observerSiteId: string;
  cameraSourceId: string;
  name: string;
  talkSupported?: boolean;
  capabilities?: Record<string, unknown>;
}) {
  const [muted, setMuted] = useState(true);
  const [busy, setBusy] = useState<ActionType | null>(null);
  const [result, setResult] = useState("");
  const evidence = evidenceMap(capabilities);
  const audioSupported = isVerified(evidence.audio_input) || capabilities.audio === true;
  const talkEnabled = isVerified(evidence.talkback);
  const ptzEnabled = isVerified(evidence.ptz);
  const lightEnabled = isVerified(evidence.light);
  const sirenEnabled = isVerified(evidence.siren);

  function toggleAudio() {
    if (!audioSupported) return;
    const video = liveVideo(cameraSourceId);
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function snapshot() {
    const video = liveVideo(cameraSourceId);
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${name}-${new Date().toISOString().replaceAll(":", "-")}.jpg`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    }, "image/jpeg", 0.92);
  }

  async function requestPhysicalAction(actionType: ActionType, label: string, parameters: Record<string, string | number | boolean> = {}) {
    setBusy(actionType);
    setResult("");
    try {
      const prepared = await postAction({ action: "request", observer_site_id: observerSiteId, camera_source_id: cameraSourceId, action_type: actionType, request_origin: "dashboard", parameters });
      const confirmed = window.confirm(`לאשר עכשיו ${label} במצלמה ${name}? הפעולה תישלח פעם אחת ל-Gateway המקומי ותתועד.`);
      if (!confirmed) {
        await postAction({ action: "cancel", request_id: prepared.request.id });
        setResult("הפעולה בוטלה ולא נשלחה למצלמה.");
        return;
      }
      const approved = await postAction({ action: "confirm", request_id: prepared.request.id, confirmation: true });
      setResult(approved.message || "האישור נרשם וממתין ל-Gateway.");
    } catch (error) {
      setResult(error instanceof Error ? error.message : "לא ניתן לבצע את הפעולה.");
    } finally {
      setBusy(null);
    }
  }

  return <>
    <div className="do-camera-live-controls" aria-label="פעולות צפייה חיה">
      <button type="button" onClick={toggleAudio} disabled={!audioSupported} title={audioSupported ? (muted ? "הפעלת שמע מהמצלמה" : "השתקת שמע מהמצלמה") : "לא נמצא ערוץ שמע בבדיקת המדיה האחרונה"}>{muted ? <VolumeX /> : <Volume2 />}<strong>שמע</strong><small>{audioSupported ? (muted ? "מושתק" : "פעיל") : "לא אומת"}</small></button>
      <button type="button" onClick={snapshot} title="שמירת תמונה מהשידור החי"><Camera /><strong>צילום</strong><small>שמירה במכשיר</small></button>
      <button type="button" disabled={!talkEnabled || busy !== null} onClick={() => void requestPhysicalAction("talkback", "דיבור דו-כיווני")} title={talkEnabled ? "דורש אישור מיידי לפני הפעלה" : "דיבור לא אומת עבור ערוץ זה"}><Mic /><strong>דבר</strong><small>{talkEnabled ? "אישור בכל הפעלה" : "לא אומת"}</small></button>
      <button type="button" disabled title="המערכת שומרת קליפים רק סביב אירועים מאומתים"><VideoOff /><strong>הקלטה</strong><small>אירועים בלבד</small></button>
      <button type="button" disabled={!ptzEnabled || busy !== null} onClick={() => void requestPhysicalAction("ptz_pan", "הזזת PTZ שמאלה", { direction: "left", duration_ms: 350 })} title={ptzEnabled ? "הזזה קצרה שמאלה; דורשת אישור" : "PTZ לא אומת עבור ערוץ זה"}><ChevronLeft /><strong>PTZ</strong><small>{ptzEnabled ? "שמאלה" : "לא אומת"}</small></button>
      <button type="button" disabled={!lightEnabled || busy !== null} onClick={() => void requestPhysicalAction("light_on", "הפעלת תאורה")} title={lightEnabled ? "דורש אישור מיידי" : "תאורה לא אומתה עבור ערוץ זה"}><Lightbulb /><strong>תאורה</strong><small>{lightEnabled ? "הפעלה באישור" : "לא אומת"}</small></button>
      <button type="button" disabled={!sirenEnabled || busy !== null} onClick={() => void requestPhysicalAction("siren_on", "הפעלת סירנה", { duration_seconds: 5 })} title={sirenEnabled ? "דורש אישור מיידי" : "סירנה לא אומתה עבור ערוץ זה"}><Siren /><strong>סירנה</strong><small>{sirenEnabled ? "5 שניות באישור" : "לא אומת"}</small></button>
    </div>
    {ptzEnabled ? <div className="do-camera-ptz-controls" aria-label="בקרת PTZ מאומתת">
      <button type="button" disabled={busy !== null} onClick={() => void requestPhysicalAction("ptz_tilt", "הזזת PTZ למעלה", { direction: "up", duration_ms: 350 })} aria-label="למעלה"><ChevronUp /></button>
      <button type="button" disabled={busy !== null} onClick={() => void requestPhysicalAction("ptz_pan", "הזזת PTZ ימינה", { direction: "right", duration_ms: 350 })} aria-label="ימינה"><ChevronRight /></button>
      <button type="button" disabled={busy !== null} onClick={() => void requestPhysicalAction("ptz_tilt", "הזזת PTZ למטה", { direction: "down", duration_ms: 350 })} aria-label="למטה"><ChevronDown /></button>
      <button type="button" disabled={busy !== null} onClick={() => void requestPhysicalAction("ptz_zoom", "קירוב PTZ", { direction: "in", duration_ms: 250 })} aria-label="קירוב"><Search /></button>
    </div> : null}
    {result ? <p className="do-camera-action-result" role="status">{result}</p> : null}
  </>;
}
