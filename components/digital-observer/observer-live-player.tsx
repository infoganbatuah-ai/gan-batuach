"use client";

import Hls from "hls.js";
import { CameraOff, LoaderCircle, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { subscribeMobilePlayback } from "@/lib/domain/digital-observer/mobile-playback-lifecycle";

type PlayerState = "loading" | "playing" | "error";

// Starting several recorder relays at once can take more than one HLS window.
// Keep the player alive long enough for a verified local relay to produce its
// first segment, then use the same recorder-jitter window as the Gateway.
const mediaStartTimeoutMs = 30_000;
const mediaProgressTimeoutMs = 20_000;

type PlaybackSession = {
  url: string;
  expiresAt: number;
};

class PlaybackFlowError extends Error {
  constructor(readonly flowCode: string) {
    super(flowCode);
  }
}

function playbackFailureReason(error: unknown) {
  const code = error instanceof PlaybackFlowError ? error.flowCode : "unknown";
  if (code === "cloud_401") return "נדרשת התחברות מחדש לפני צפייה";
  if (code === "cloud_403") return "אין הרשאת צפייה במקור הזה";
  if (code === "cloud_409") return "מיפוי המצלמה ל־Gateway אינו תואם";
  if (code === "cloud_503") return "זהות ה־Gateway עדיין לא סונכרנה למקור";
  if (code === "local_unreachable") return "הדפדפן לא הצליח להגיע לרכיב ה־Edge";
  if (code === "local_claim_401") return "אימות המכשיר המקומי פג";
  if (code === "local_claim_409") return "הרשאת הצפייה החד־פעמית כבר נוצלה";
  if (code === "local_claim_503") return "ה־Gateway המקומי לא הצליח לאשר את הצפייה";
  return "לא התקבל שידור זמין מה־Gateway";
}

const playbackSessions = new Map<string, PlaybackSession>();
type PendingPlaybackSession = { promise: Promise<string>; consumers: Set<symbol> };
const pendingPlaybackSessions = new Map<string, PendingPlaybackSession>();
const playbackSessionTtlMs = 4 * 60 * 1000;

function playbackKey(observerSiteId: string, cameraSourceId: string) {
  return `${observerSiteId}:${cameraSourceId}`;
}

function invalidatePlaybackSession(observerSiteId: string, cameraSourceId: string) {
  const key = playbackKey(observerSiteId, cameraSourceId);
  playbackSessions.delete(key);
  pendingPlaybackSessions.delete(key);
}

function playbackConsumer(key: string, ticket: PendingPlaybackSession, consumer: symbol) {
  let released = false;
  return {
    promise: ticket.promise,
    release: () => {
      if (released) return;
      released = true;
      ticket.consumers.delete(consumer);
      if (ticket.consumers.size === 0 && pendingPlaybackSessions.get(key) === ticket) pendingPlaybackSessions.delete(key);
    }
  };
}

function requestPlaybackSession(observerSiteId: string, cameraSourceId: string) {
  const key = playbackKey(observerSiteId, cameraSourceId);
  const cached = playbackSessions.get(key);
  if (cached && cached.expiresAt > Date.now()) return { promise: Promise.resolve(cached.url), release: () => {} };

  const consumer = Symbol("playback-consumer");
  const pending = pendingPlaybackSessions.get(key);
  if (pending) {
    pending.consumers.add(consumer);
    return playbackConsumer(key, pending, consumer);
  }

  let resolveRequest!: (url: string) => void;
  let rejectRequest!: (error: unknown) => void;
  const promise = new Promise<string>((resolve, reject) => { resolveRequest = resolve; rejectRequest = reject; });
  const ticket: PendingPlaybackSession = { promise, consumers: new Set([consumer]) };
  pendingPlaybackSessions.set(key, ticket);
  const requireCurrent = () => {
    if (pendingPlaybackSessions.get(key) !== ticket || ticket.consumers.size === 0) throw new PlaybackFlowError("playback_cancelled");
  };
  const request = (async () => {
    let playbackUrl = "";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      requireCurrent();
      const response = await fetch("/api/digital-observer/dvr-gateway", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ observer_site_id: observerSiteId, camera_source_id: cameraSourceId, mode: "live" })
      });
      requireCurrent();
      const payload = await response.json().catch(() => ({}));
      requireCurrent();
      if (!response.ok) {
        const retryableGatewayFailure = response.status === 503 || (response.status !== 503 && [502, 504].includes(response.status));
        if (retryableGatewayFailure && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
          requireCurrent();
          continue;
        }
        throw new PlaybackFlowError(`cloud_${response.status}`);
      }
      let candidate = payload?.data?.playback?.hls_url;
      const claimUrl = payload?.data?.playback?.claim_url;
      const allowedOrigin = payload?.data?.playback?.allowed_origin;
      const grant = payload?.data?.playback?.grant;
      if (typeof claimUrl === "string" && typeof grant === "string") {
        if (typeof allowedOrigin !== "string" || new URL(claimUrl).origin !== allowedOrigin
          || new URL(claimUrl).pathname !== "/playback/claim") throw new PlaybackFlowError("playback_origin_invalid");
        let claimResponse: Response;
        try {
          claimResponse = await fetch(claimUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ grant }),
            redirect: "error",
            referrerPolicy: "no-referrer"
          });
        } catch {
          throw new PlaybackFlowError("local_unreachable");
        }
        requireCurrent();
        const claimPayload = await claimResponse.json().catch(() => ({}));
        requireCurrent();
        if (!claimResponse.ok) throw new PlaybackFlowError(`local_claim_${claimResponse.status}`);
        candidate = claimPayload?.playback?.hls_url;
        if (typeof candidate !== "string" || new URL(candidate).origin !== allowedOrigin
          || !new URL(candidate).pathname.startsWith("/hls/")) throw new PlaybackFlowError("playback_origin_invalid");
      }
      if (typeof candidate === "string" && candidate) {
        playbackUrl = candidate;
        break;
      }
      throw new PlaybackFlowError("playback_missing");
    }
    if (!playbackUrl) throw new Error("playback_unavailable");
    requireCurrent();
    playbackSessions.set(key, { url: playbackUrl, expiresAt: Date.now() + playbackSessionTtlMs });
    return playbackUrl;
  })().finally(() => {
    if (pendingPlaybackSessions.get(key) === ticket) pendingPlaybackSessions.delete(key);
  });
  // Publish a real shared promise before issuing fetch, including reentrant callers.
  void request.then(resolveRequest, rejectRequest);
  return playbackConsumer(key, ticket, consumer);
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
  const lastCurrentTimeRef = useRef(0);
  const lastProgressAtRef = useRef(0);
  const recoveryScheduledRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileSuspendedRef = useRef(false);
  const mobileSuspensionReasonsRef = useRef({ appInactive: false, networkOffline: false });
  const mountedRef = useRef(false);
  const mediaActiveRef = useRef(false);
  const retryGenerationRef = useRef(0);
  const [state, setState] = useState<PlayerState>("loading");
  const [unavailableReason, setUnavailableReason] = useState("");
  const [muted, setMuted] = useState(true);
  const [retryNonce, setRetryNonce] = useState(0);

  function requestRetry() {
    if (!mountedRef.current || mobileSuspendedRef.current) return;
    playbackSessions.delete(playbackKey(observerSiteId, cameraSourceId));
    if (retryTimerRef.current) return;
    const generation = retryGenerationRef.current;
    retryTimerRef.current = setTimeout(() => {
      if (!mountedRef.current || mobileSuspendedRef.current || generation !== retryGenerationRef.current) return;
      retryTimerRef.current = null;
      setRetryNonce((value) => value + 1);
    }, 5000);
  }

  useEffect(() => {
    let cancelled = false;
    let hls: Hls | null = null;
    let releasePlaybackRequest: (() => void) | null = null;
    let mediaHeartbeat: ReturnType<typeof setInterval> | null = null;
    const currentVideoElement = videoRef.current;
    if (!currentVideoElement) return;
    const videoElement: HTMLVideoElement = currentVideoElement;
    mountedRef.current = true;
    let connectionGeneration = 0;
    hasStartedRef.current = false;
    lastCurrentTimeRef.current = 0;
    lastProgressAtRef.current = Date.now();
    recoveryScheduledRef.current = false;
    const retry = () => { if (!cancelled && !mobileSuspendedRef.current) requestRetry(); };
    const suspendForMobile = (reason: "appInactive" | "networkOffline") => {
      if (cancelled) return;
      mobileSuspensionReasonsRef.current[reason] = true;
      if (mobileSuspendedRef.current) return;
      mobileSuspendedRef.current = true;
      mediaActiveRef.current = false;
      connectionGeneration += 1;
      retryGenerationRef.current += 1;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      releasePlaybackRequest?.();
      invalidatePlaybackSession(observerSiteId, cameraSourceId);
      hls?.destroy();
      hls = null;
      videoElement.pause();
      videoElement.removeAttribute("src");
      videoElement.load();
      setUnavailableReason("הניגון הושהה עד לחזרת האפליקציה או הרשת");
      setState("loading");
    };
    const resumeForMobile = (reason: "appInactive" | "networkOffline") => {
      if (cancelled || !mobileSuspensionReasonsRef.current[reason]) return;
      mobileSuspensionReasonsRef.current[reason] = false;
      if (mobileSuspensionReasonsRef.current.appInactive || mobileSuspensionReasonsRef.current.networkOffline) return;
      if (!mobileSuspendedRef.current) return;
      mobileSuspendedRef.current = false;
      invalidatePlaybackSession(observerSiteId, cameraSourceId);
      setRetryNonce((value) => value + 1);
    };
    const appSuspend = () => suspendForMobile("appInactive");
    const networkOffline = () => suspendForMobile("networkOffline");
    const appResume = () => resumeForMobile("appInactive");
    const networkOnline = () => resumeForMobile("networkOffline");
    window.addEventListener("digital-observer:mobile-suspend", appSuspend);
    window.addEventListener("digital-observer:mobile-offline", networkOffline);
    window.addEventListener("digital-observer:mobile-resume", appResume);
    window.addEventListener("digital-observer:mobile-online", networkOnline);
    let observedPublisher = false;
    const unsubscribePlayback = subscribeMobilePlayback((snapshot) => {
      if (cancelled) return;
      if (!snapshot && !observedPublisher) return;
      observedPublisher = !!snapshot;
      if (snapshot?.appInactive) appSuspend(); else appResume();
      if (snapshot?.networkOffline) networkOffline(); else networkOnline();
    });
    const markUnavailable = (reason: string) => {
      if (cancelled || mobileSuspendedRef.current || recoveryScheduledRef.current) return;
      recoveryScheduledRef.current = true;
      setUnavailableReason(reason);
      setState("error");
      retry();
    };

    mediaHeartbeat = setInterval(() => {
      if (cancelled || mobileSuspendedRef.current) return;
      const elapsedWithoutProgress = Date.now() - lastProgressAtRef.current;
      const timeout = hasStartedRef.current ? mediaProgressTimeoutMs : mediaStartTimeoutMs;
      if (elapsedWithoutProgress >= timeout) markUnavailable(hasStartedRef.current ? "המדיה הפסיקה להתקדם" : "לא התקבלה מדיה מה־Gateway");
    }, 2_000);

    const generation = connectionGeneration;
    const active = () => !cancelled && !mobileSuspendedRef.current && generation === connectionGeneration;
    async function connect() {
      if (!active()) return;
      setState("loading");
      setUnavailableReason("");
      const session = requestPlaybackSession(observerSiteId, cameraSourceId);
      releasePlaybackRequest = session.release;
      const playbackUrl = await session.promise;
      if (!active()) return;

      if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        mediaActiveRef.current = true;
        videoElement.src = playbackUrl;
        await videoElement.play().catch(() => undefined);
      } else if (Hls.isSupported()) {
        const player = new Hls({
          // Match the Gateway's signed HLS holdback contract. The Home DVR
          // allows one productive response per channel, so a managed session
          // renewal briefly drains retained segments while the replacement
          // starts. Six one-second segments preserve moving playback without
          // weakening the Gateway's source-freshness deadline.
          liveSyncDurationCount: 6,
          liveMaxLatencyDurationCount: 12,
          // A worker per thumbnail is expensive and requires a blob worker CSP.
          // Parsing these short local playlists on the main thread keeps the
          // multi-camera grid predictable across installed/PWA browsers.
          enableWorker: false,
          lowLatencyMode: false
        });
        hls = player;
        mediaActiveRef.current = true;
        player.on(Hls.Events.MEDIA_ATTACHED, () => {
          if (active() && hls === player) player.loadSource(playbackUrl);
        });
        player.on(Hls.Events.MANIFEST_PARSED, () => {
          if (active() && hls === player) void videoElement.play().catch(() => undefined);
        });
        player.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal && active() && hls === player) {
            markUnavailable("נגן הווידאו לא הצליח לקרוא את השידור");
          }
        });
        player.attachMedia(videoElement);
      } else {
        throw new Error("hls_not_supported");
      }
    }

    void connect().catch((error) => {
      if (active()) {
        markUnavailable(playbackFailureReason(error));
      }
    });
    return () => {
      cancelled = true;
      releasePlaybackRequest?.();
      mountedRef.current = false;
      mediaActiveRef.current = false;
      retryGenerationRef.current += 1;
      if (mediaHeartbeat) clearInterval(mediaHeartbeat);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      unsubscribePlayback();
      window.removeEventListener("digital-observer:mobile-suspend", appSuspend);
      window.removeEventListener("digital-observer:mobile-offline", networkOffline);
      window.removeEventListener("digital-observer:mobile-resume", appResume);
      window.removeEventListener("digital-observer:mobile-online", networkOnline);
      hls?.destroy();
      videoElement.removeAttribute("src");
      videoElement.load();
    };
  }, [cameraSourceId, observerSiteId, retryNonce]);

  return (
    <div className={`do-live-player ${large ? "large" : ""} ${compact ? "compact" : ""}`} data-playback-state={state}>
      <video
        ref={videoRef}
        data-camera-source-id={cameraSourceId}
        crossOrigin="anonymous"
        autoPlay
        playsInline
        muted={muted}
        aria-label={`שידור חי — ${name}`}
        onTimeUpdate={(event) => {
          if (!mountedRef.current || mobileSuspendedRef.current || !mediaActiveRef.current) return;
          const currentTime = event.currentTarget.currentTime;
          if (currentTime <= lastCurrentTimeRef.current + 0.05) return;
          lastCurrentTimeRef.current = currentTime;
          lastProgressAtRef.current = Date.now();
          hasStartedRef.current = true;
          setState("playing");
        }}
        onWaiting={() => {
          if (!mountedRef.current || mobileSuspendedRef.current || !mediaActiveRef.current) return;
          // A live playlist waits for its next segment regularly. Once playback began,
          // presenting that normal wait as a disconnect makes the thumbnail flicker.
          if (!hasStartedRef.current) setState("loading");
        }}
        onError={() => {
          if (!mountedRef.current || mobileSuspendedRef.current || !mediaActiveRef.current) return;
          setUnavailableReason("נגן הווידאו דיווח על שגיאה");
          setState("error");
          requestRetry();
        }}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
      />
      <span className={`do-live-player-status ${state}`}>
        {state === "playing" ? "LIVE" : state === "loading" ? <><LoaderCircle /> מתחבר…</> : <><CameraOff /> השידור אינו זמין כרגע</>}
      </span>
      {state === "error" && !compact ? <span className="do-live-player-reason">{unavailableReason} · עיבוד המקור עשוי להמשיך · ניסיון חוזר אוטומטי</span> : null}
      {!compact ? <button type="button" className="do-live-player-audio" onClick={() => setMuted((value) => !value)} aria-label={muted ? "הפעלת שמע" : "השתקת שמע"}>
        {muted ? <VolumeX /> : <Volume2 />}
      </button> : null}
      <span className="do-live-player-name">{name}</span>
    </div>
  );
}
