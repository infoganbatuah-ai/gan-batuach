"use client";

import { Camera, Mic, Square, Video, Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";

function liveVideo(cameraSourceId: string) {
  return document.querySelector<HTMLVideoElement>(`video[data-camera-source-id="${CSS.escape(cameraSourceId)}"]`);
}

export function ObserverCameraControls({ cameraSourceId, name, talkSupported = false }: { cameraSourceId: string; name: string; talkSupported?: boolean }) {
  const [muted, setMuted] = useState(true);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function toggleAudio() {
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

  function toggleRecording() {
    if (recorderRef.current && recording) {
      recorderRef.current.stop();
      return;
    }
    const video = liveVideo(cameraSourceId);
    const captureStream = video && (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream;
    if (!video || !captureStream || typeof MediaRecorder === "undefined") return;
    const recorder = new MediaRecorder(captureStream.call(video), { mimeType: "video/webm" });
    chunksRef.current = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${name}-${new Date().toISOString().replaceAll(":", "-")}.webm`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setRecording(false);
      recorderRef.current = null;
    };
    recorder.start(1_000);
    recorderRef.current = recorder;
    setRecording(true);
  }

  return <div className="do-camera-live-controls" aria-label="פעולות צפייה חיה">
    <button type="button" onClick={toggleAudio} title={muted ? "הפעלת שמע מהמצלמה" : "השתקת שמע מהמצלמה"}>{muted ? <VolumeX /> : <Volume2 />}<strong>שמע</strong><small>{muted ? "מושתק" : "פעיל"}</small></button>
    <button type="button" onClick={snapshot} title="שמירת תמונה מהשידור החי"><Camera /><strong>צילום</strong><small>שמירה במכשיר</small></button>
    <button type="button" disabled={!talkSupported} title={talkSupported ? "דיבור דו־כיווני דורש אישור לפני הפעלה" : "המצלמה אינה מדווחת על תמיכת דיבור דו־כיווני"}><Mic /><strong>דבר</strong><small>{talkSupported ? "דורש אישור" : "לא נתמך"}</small></button>
    <button type="button" onClick={toggleRecording} title={recording ? "עצירת ההקלטה המקומית" : "הקלטת השידור במכשיר"}>{recording ? <Square /> : <Video />}<strong>הקלטה</strong><small>{recording ? "עצירה ושמירה" : "שמירה במכשיר"}</small></button>
  </div>;
}
