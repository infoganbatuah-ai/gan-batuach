"use client";

import { Camera, CircleOff, Lightbulb, Mic, Siren, VideoOff, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";

function liveVideo(cameraSourceId: string) {
  return document.querySelector<HTMLVideoElement>(`video[data-camera-source-id="${CSS.escape(cameraSourceId)}"]`);
}

export function ObserverCameraControls({
  cameraSourceId,
  name,
  talkSupported = false,
  capabilities = {}
}: {
  cameraSourceId: string;
  name: string;
  talkSupported?: boolean;
  capabilities?: Record<string, unknown>;
}) {
  const [muted, setMuted] = useState(true);
  const audioSupported = capabilities.audio === true;
  const talkEnabled = talkSupported && capabilities.talk === true;

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

  return <div className="do-camera-live-controls" aria-label="פעולות צפייה חיה">
    <button type="button" onClick={toggleAudio} disabled={!audioSupported} title={audioSupported ? (muted ? "הפעלת שמע מהמצלמה" : "השתקת שמע מהמצלמה") : "ה-Gateway לא מדווח על שמע במצלמה זו"}>{muted ? <VolumeX /> : <Volume2 />}<strong>שמע</strong><small>{audioSupported ? (muted ? "מושתק" : "פעיל") : "לא נתמך"}</small></button>
    <button type="button" onClick={snapshot} title="שמירת תמונה מהשידור החי"><Camera /><strong>צילום</strong><small>שמירה במכשיר</small></button>
    <button type="button" disabled={!talkEnabled} title={talkEnabled ? "דיבור דו־כיווני דורש אישור לפני הפעלה" : "המצלמה או ה-Gateway אינם מדווחים על תמיכת דיבור דו־כיווני"}><Mic /><strong>דבר</strong><small>{talkEnabled ? "דורש אישור" : "לא נתמך"}</small></button>
    <button type="button" disabled title="המערכת שומרת קליפים רק סביב אירועים מאומתים"><VideoOff /><strong>הקלטה</strong><small>אירועים בלבד</small></button>
    <button type="button" disabled title="פעולות PTZ חסומות ב-Gateway הקריאה-בלבד"><CircleOff /><strong>PTZ</strong><small>{capabilities.ptz === true ? "חסום במדיניות" : "לא נתמך"}</small></button>
    <button type="button" disabled title="שליטת תאורה חסומה ב-Gateway הקריאה-בלבד"><Lightbulb /><strong>תאורה</strong><small>{capabilities.light === true ? "חסום במדיניות" : "לא נתמך"}</small></button>
    <button type="button" disabled title="שליטת סירנה חסומה ב-Gateway הקריאה-בלבד"><Siren /><strong>סירנה</strong><small>{capabilities.siren === true ? "חסום במדיניות" : "לא נתמך"}</small></button>
  </div>;
}
