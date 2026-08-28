"use client";

import Hls from "hls.js";
import { CameraOff, LoaderCircle, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type PlayerState = "loading" | "playing" | "error";

type PlaybackSession = {
  url: string;
  expiresAt: number;
};

const playbackSessions = new Map<string, PlaybackSession>();
const pendingPlaybackSessions = new Map<string, Promise<string>>();
const playbackSessionTtlMs = 4 * 60 * 1000;

function playbackKey(observerSiteId: string, cameraSourceId: string) {
  return `${observerSiteId}:${cameraSourceId}`;
}

async function requestPlaybackSession(observerSiteId: string, cameraSourceId: string) {
  const key = playbackKey(observerSiteId, cameraSourceId);
  const cached = playbackSessions.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const pending = pendingPlaybackSessions.get(key);
  if (pending) return pending;

  const request = (async () => {
    let playbackUrl = "";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch("/api/digital-observer/dvr-gateway", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ observer_site_id: observerSiteId, camera_source_id: cameraSourceId, mode: "live" })
      });
      const payload = await response.json().catch(() => ({}));
      const candidate = payload?.data?.playback?.hls_url;
      if (response.ok && typeof candidate === "string" && candidate) {
        playbackUrl = candidate;
        break;
      }
      if (response.status !== 503 || attempt === 2) throw new Error("playback_unavailable");
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
    }
    if (!playbackUrl) throw new Error("playback_unavailable");
    playbackSessions.set(key, { url: playbackUrl, expiresAt: Date.now() + playbackSessionTtlMs });
    return playbackUrl;
  })();

  pendingPlaybackSessions.set(key, request);
  try {
    return await request;
  } finally {
    pendingPlaybackSessions.delete(key);
  }
}

export function ObserverLivePlayer({
  observerSiteId,
  cameraSourceId,
  name,
  large = false,
  compact = false
}: {
  observerSiteId: string;
  cameraSourceId: string;
  name: string;
  large?: boolean;
  compact?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasStartedRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<PlayerState>("loading");
  const [muted, setMuted] = useState(true);
  const [retryNonce, setRetryNonce] = useState(0);

  function requestRetry() {
    const key = playbackKey(observerSiteId, cameraSourceId);
    playbackSessions.delete(key);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => setRetryNonce((value) => value + 1), 5000);
  }

  useEffect(() => {
    let cancelled = false;
    let hls: Hls | null = null;
    const currentVideoElement = videoRef.current;
    if (!currentVideoElement) return;
    const videoElement: HTMLVideoElement = currentVideoElement;
    hasStartedRef.current = false;
    const retry = () => { if (!cancelled) requestRetry(); };

    async function connect() {
      setState("loading");
      const playbackUrl = await requestPlaybackSession(observerSiteId, cameraSourceId);
      if (cancelled) return;

      if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        videoElement.src = playbackUrl;
      } else if (Hls.isSupported()) {
        hls = new Hls({
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 12,
          enableWorker: true,
          lowLatencyMode: false
        });
        hls.loadSource(playbackUrl);
        hls.attachMedia(videoElement);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal && !cancelled) {
            setState("error");
            retry();
          }
        });
      } else {
        throw new Error("hls_not_supported");
      }
      await videoElement.play().catch(() => undefined);
    }

    void connect().catch(() => {
      if (!cancelled) {
        setState("error");
        retry();
      }
    });
    return () => {
      cancelled = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      hls?.destroy();
      videoElement.removeAttribute("src");
      videoElement.load();
    };
  }, [cameraSourceId, observerSiteId, retryNonce]);

  return (
    <div className={`do-live-player ${large ? "large" : ""} ${compact ? "compact" : ""}`}>
      <video
        ref={videoRef}
        data-camera-source-id={cameraSourceId}
        crossOrigin="anonymous"
        autoPlay
        playsInline
        muted={muted}
        aria-label={`שידור חי — ${name}`}
        onPlaying={() => {
          hasStartedRef.current = true;
          setState("playing");
        }}
        onWaiting={() => {
          // A live playlist waits for its next segment regularly. Once playback began,
          // presenting that normal wait as a disconnect makes the thumbnail flicker.
          if (!hasStartedRef.current) setState("loading");
        }}
        onError={() => {
          if (!hasStartedRef.current) {
            setState("error");
            requestRetry();
          }
        }}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
      />
      <span className={`do-live-player-status ${state}`}>
        {state === "playing" ? "LIVE" : state === "loading" ? <><LoaderCircle /> מתחבר…</> : <><CameraOff /> השידור אינו זמין</>}
      </span>
      {!compact ? <button type="button" className="do-live-player-audio" onClick={() => setMuted((value) => !value)} aria-label={muted ? "הפעלת שמע" : "השתקת שמע"}>
        {muted ? <VolumeX /> : <Volume2 />}
      </button> : null}
      <span className="do-live-player-name">{name}</span>
    </div>
  );
}
