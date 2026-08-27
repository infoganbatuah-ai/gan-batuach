"use client";

import Hls from "hls.js";
import { CameraOff, LoaderCircle, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type PlayerState = "loading" | "playing" | "error";

export function ObserverLivePlayer({
  observerSiteId,
  cameraSourceId,
  name,
  large = false
}: {
  observerSiteId: string;
  cameraSourceId: string;
  name: string;
  large?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<PlayerState>("loading");
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let hls: Hls | null = null;
    const currentVideoElement = videoRef.current;
    if (!currentVideoElement) return;
    const videoElement: HTMLVideoElement = currentVideoElement;

    async function connect() {
      setState("loading");
      const response = await fetch("/api/digital-observer/dvr-gateway", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ observer_site_id: observerSiteId, camera_source_id: cameraSourceId, mode: "live" })
      });
      const payload = await response.json().catch(() => ({}));
      const playbackUrl = payload?.data?.playback?.hls_url;
      if (!response.ok || typeof playbackUrl !== "string" || !playbackUrl) throw new Error("playback_unavailable");
      if (cancelled) return;

      if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        videoElement.src = playbackUrl;
      } else if (Hls.isSupported()) {
        hls = new Hls({
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 5,
          enableWorker: true,
          lowLatencyMode: true
        });
        hls.loadSource(playbackUrl);
        hls.attachMedia(videoElement);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal && !cancelled) setState("error");
        });
      } else {
        throw new Error("hls_not_supported");
      }
      await videoElement.play().catch(() => undefined);
    }

    void connect().catch(() => {
      if (!cancelled) setState("error");
    });
    return () => {
      cancelled = true;
      hls?.destroy();
      videoElement.removeAttribute("src");
      videoElement.load();
    };
  }, [cameraSourceId, observerSiteId]);

  return (
    <div className={`do-live-player ${large ? "large" : ""}`}>
      <video
        ref={videoRef}
        data-camera-source-id={cameraSourceId}
        crossOrigin="anonymous"
        autoPlay
        playsInline
        muted={muted}
        aria-label={`שידור חי — ${name}`}
        onPlaying={() => setState("playing")}
        onWaiting={() => setState("loading")}
        onError={() => setState("error")}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
      />
      <span className={`do-live-player-status ${state}`}>
        {state === "playing" ? "LIVE" : state === "loading" ? <><LoaderCircle /> מתחבר…</> : <><CameraOff /> השידור אינו זמין</>}
      </span>
      <button type="button" className="do-live-player-audio" onClick={() => setMuted((value) => !value)} aria-label={muted ? "הפעלת שמע" : "השתקת שמע"}>
        {muted ? <VolumeX /> : <Volume2 />}
      </button>
      <span className="do-live-player-name">{name}</span>
    </div>
  );
}
