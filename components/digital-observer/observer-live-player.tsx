"use client";

import Hls from "hls.js";
import { CameraOff, LoaderCircle, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ObserverCameraPresence } from "@/components/digital-observer/observer-camera-presence";
import { createPlaybackSessionClient, playbackFailureReason } from "@/lib/domain/digital-observer/playback-session";

type PlayerState = "loading" | "playing" | "error";

// Starting several recorder relays at once can take more than one HLS window.
// Keep the player alive long enough for a verified local relay to produce its
// first segment, then use the same recorder-jitter window as the Gateway.
const mediaStartTimeoutMs = 30_000;
const mediaProgressTimeoutMs = 20_000;

const playbackSessions = createPlaybackSessionClient();

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
  const lastCurrentTimeRef = useRef(0);
  const lastProgressAtRef = useRef(0);
  const recoveryScheduledRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<PlayerState>("loading");
  const [unavailableReason, setUnavailableReason] = useState("");
  const [muted, setMuted] = useState(true);
  const [retryNonce, setRetryNonce] = useState(0);

  function requestRetry() {
    playbackSessions.invalidate(observerSiteId, cameraSourceId);
    if (retryTimerRef.current) return;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      setRetryNonce((value) => value + 1);
    }, 5000);
  }

  useEffect(() => {
    let cancelled = false;
    let hls: Hls | null = null;
    let mediaHeartbeat: ReturnType<typeof setInterval> | null = null;
    let leaseHeartbeat: ReturnType<typeof setInterval> | null = null;
    let renewalPending = false;
    let awaitingMedia = false;
    const currentVideoElement = videoRef.current;
    if (!currentVideoElement) return;
    const videoElement: HTMLVideoElement = currentVideoElement;
    hasStartedRef.current = false;
    lastCurrentTimeRef.current = 0;
    lastProgressAtRef.current = Date.now();
    recoveryScheduledRef.current = false;
    const retry = () => { if (!cancelled) requestRetry(); };
    const markUnavailable = (reason: string) => {
      if (cancelled || recoveryScheduledRef.current) return;
      recoveryScheduledRef.current = true;
      setUnavailableReason(reason);
      setState("error");
      retry();
    };

    mediaHeartbeat = setInterval(() => {
      if (cancelled || !awaitingMedia) return;
      const elapsedWithoutProgress = Date.now() - lastProgressAtRef.current;
      const timeout = hasStartedRef.current ? mediaProgressTimeoutMs : mediaStartTimeoutMs;
      if (elapsedWithoutProgress >= timeout) markUnavailable(hasStartedRef.current ? "המדיה הפסיקה להתקדם" : "לא התקבלה מדיה מה־Gateway");
    }, 2_000);

    async function connect() {
      setState("loading");
      setUnavailableReason("");
      const playbackUrl = await playbackSessions.request(observerSiteId, cameraSourceId);
      if (cancelled) return;
      leaseHeartbeat = setInterval(() => {
        if (cancelled || renewalPending) return;
        renewalPending = true;
        void playbackSessions.renew(observerSiteId, cameraSourceId, playbackUrl).then((renewedUrl) => {
          // Renewing a valid local lease preserves both URL and decoder buffer.
          // After expiration/restart the Gateway issues a new URL instead.
          if (!cancelled && renewedUrl !== playbackUrl) setRetryNonce((value) => value + 1);
        }).catch(() => {
          // Keep playing while the previous lease is valid. A cloud outage must
          // not destroy available media; the media heartbeat owns failure UI.
        }).finally(() => { renewalPending = false; });
      }, 60_000);
      awaitingMedia = true;
      lastProgressAtRef.current = Date.now();

      if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        videoElement.src = playbackUrl;
        await videoElement.play().catch(() => undefined);
      } else if (Hls.isSupported()) {
        hls = new Hls({
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 12,
          // A worker per thumbnail is expensive and requires a blob worker CSP.
          // Parsing these short local playlists on the main thread keeps the
          // multi-camera grid predictable across installed/PWA browsers.
          enableWorker: false,
          lowLatencyMode: false
        });
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          if (!cancelled) hls?.loadSource(playbackUrl);
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!cancelled) void videoElement.play().catch(() => undefined);
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal && !cancelled) {
            markUnavailable("נגן הווידאו לא הצליח לקרוא את השידור");
          }
        });
        hls.attachMedia(videoElement);
      } else {
        throw new Error("hls_not_supported");
      }
    }

    void connect().catch((error) => {
      if (!cancelled) {
        markUnavailable(playbackFailureReason(error));
      }
    });
    return () => {
      cancelled = true;
      if (mediaHeartbeat) clearInterval(mediaHeartbeat);
      if (leaseHeartbeat) clearInterval(leaseHeartbeat);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
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
        onTimeUpdate={(event) => {
          const media = event.currentTarget;
          if (media.paused || media.readyState < 2 || media.seeking || media.error) return;
          const currentTime = media.currentTime;
          // Native HLS can keep its clock running after it has exhausted media.
          // A clock beyond every buffered range is not evidence of live frames.
          let hasBufferedMedia = false;
          for (let index = 0; index < media.buffered.length; index += 1) {
            if (currentTime >= media.buffered.start(index) - 0.25 && currentTime <= media.buffered.end(index) + 0.25) hasBufferedMedia = true;
          }
          if (!hasBufferedMedia) return;
          if (currentTime <= lastCurrentTimeRef.current + 0.05) return;
          lastCurrentTimeRef.current = currentTime;
          lastProgressAtRef.current = Date.now();
          hasStartedRef.current = true;
          // A bursty recorder may recover before the retry timer fires. Keep
          // its working player instead of interrupting it with a new claim.
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
          recoveryScheduledRef.current = false;
          setState("playing");
        }}
        onWaiting={() => {
          // A live playlist waits for its next segment regularly. Once playback began,
          // presenting that normal wait as a disconnect makes the thumbnail flicker.
          if (!hasStartedRef.current) setState("loading");
        }}
        onError={() => {
          setUnavailableReason("נגן הווידאו דיווח על שגיאה");
          setState("error");
          requestRetry();
        }}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
      />
      <span className={`do-live-player-status ${state}`} title={state === "error" ? unavailableReason : undefined}>
        {state === "playing" ? "LIVE" : state === "loading" ? <><LoaderCircle /> מתחבר…</> : <><CameraOff /> השידור אינו זמין כרגע</>}
      </span>
      {state === "error" && !compact ? <span className="do-live-player-reason">{unavailableReason} · ניסיון חוזר אוטומטי</span> : null}
      {!compact ? <button type="button" className="do-live-player-audio" onClick={() => setMuted((value) => !value)} aria-label={muted ? "הפעלת שמע" : "השתקת שמע"}>
        {muted ? <VolumeX /> : <Volume2 />}
      </button> : null}
      <ObserverCameraPresence active={state === "playing"} />
      <span className="do-live-player-name">{name}</span>
    </div>
  );
}
