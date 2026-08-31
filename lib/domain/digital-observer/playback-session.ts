export class PlaybackFlowError extends Error {
  readonly flowCode: string;

  constructor(flowCode: string) {
    super(flowCode);
    this.flowCode = flowCode;
  }
}

type PlaybackSession = { url: string; expiresAt: number };
type PendingSession = { promise: Promise<string>; cacheable: boolean };
type JsonPayload = {
  expires_in_seconds?: number;
  data?: { playback?: { hls_url?: string; claim_url?: string; grant?: string }; expires_in_seconds?: number };
  playback?: { hls_url?: string };
};

export function playbackFailureReason(error: unknown) {
  const code = error instanceof PlaybackFlowError ? error.flowCode : "unknown";
  if (code === "cloud_401") return "נדרשת התחברות מחדש לפני צפייה";
  if (code === "cloud_403") return "אין הרשאת צפייה במקור הזה";
  if (code === "cloud_409") return "המקור אינו מחובר או שמיפוי המצלמה אינו תואם";
  if (code === "cloud_503") return "זהות ה־Gateway או מסלול הצפייה עדיין אינם זמינים";
  if (code === "cloud_timeout") return "שרת הרשאות הצפייה לא השיב בזמן";
  if (code === "local_unreachable") return "ה־Gateway אינו נגיש מהמכשיר הזה. צפייה ממכשיר אחר דורשת מסלול מדיה מרוחק מאובטח";
  if (code === "local_timeout") return "ה־Gateway לא השיב בזמן לבקשת הצפייה";
  if (code === "local_claim_401") return "אימות המכשיר המקומי פג";
  if (code === "local_claim_409") return "הרשאת הצפייה החד־פעמית כבר נוצלה";
  if (code === "local_claim_503") return "ה־Gateway לא הצליח לאשר את הצפייה";
  return "לא התקבל שידור זמין מה־Gateway";
}

export function createPlaybackSessionClient({
  fetcher = fetch,
  requestTimeoutMs = 12_000,
  now = Date.now,
  sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
}: {
  fetcher?: typeof fetch;
  requestTimeoutMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
} = {}) {
  const playbackSessions = new Map<string, PlaybackSession>();
  const pendingSessions = new Map<string, PendingSession>();
  const maxSessionTtlMs = 4 * 60 * 1000;

  async function fetchJson(url: string, body: unknown, stage: "cloud" | "local") {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Bound both headers and body consumption. A stuck JSON body must not keep
    // the shared pending request alive across every subsequent player retry.
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new PlaybackFlowError(`${stage}_timeout`));
        controller.abort();
      }, requestTimeoutMs);
    });
    try {
      return await Promise.race([
        (async () => {
          const response = await fetcher(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
            signal: controller.signal
          });
          const payload = await response.json().catch(() => ({})) as JsonPayload;
          if (!response.ok) throw new PlaybackFlowError(`${stage === "local" ? "local_claim" : "cloud"}_${response.status}`);
          return payload;
        })(),
        deadline
      ]);
    } catch (error) {
      if (error instanceof PlaybackFlowError) throw error;
      throw new PlaybackFlowError(`${stage}_unreachable`);
    } finally {
      clearTimeout(timer);
    }
  }

  function keyFor(siteId: string, sourceId: string) {
    return `${siteId}:${sourceId}`;
  }

  function invalidate(siteId: string, sourceId: string) {
    const key = keyFor(siteId, sourceId);
    playbackSessions.delete(key);
    const pending = pendingSessions.get(key);
    if (pending) pending.cacheable = false;
  }

  async function request(siteId: string, sourceId: string, renewalUrl?: string) {
    const key = keyFor(siteId, sourceId);
    for (const [sessionKey, session] of playbackSessions) {
      if (session.expiresAt <= now()) playbackSessions.delete(sessionKey);
    }
    const cached = playbackSessions.get(key);
    if (cached && (!renewalUrl || cached.expiresAt > now() + 60_000)) return cached.url;
    const existing = pendingSessions.get(key);
    if (existing) return existing.promise;

    const pending: PendingSession = { promise: Promise.resolve(""), cacheable: true };
    pending.promise = (async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        let payload: JsonPayload;
        try {
          payload = await fetchJson("/api/digital-observer/dvr-gateway", {
            observer_site_id: siteId, camera_source_id: sourceId, mode: "live"
          }, "cloud");
        } catch (error) {
          if (error instanceof PlaybackFlowError && error.flowCode === "cloud_503" && attempt < 2) {
            await sleep(1200 * (attempt + 1));
            continue;
          }
          throw error;
        }
        let candidate = payload.data?.playback?.hls_url;
        let ttl = payload.data?.expires_in_seconds;
        const claimUrl = payload.data?.playback?.claim_url;
        const grant = payload.data?.playback?.grant;
        if (typeof claimUrl === "string" && typeof grant === "string") {
          // A replacement lease is sent only to the same local media origin,
          // never to the cloud. The Gateway rechecks the new one-time grant.
          let playbackToken: string | undefined;
          if (renewalUrl) {
            try {
              const previous = new URL(renewalUrl);
              const destination = new URL(claimUrl);
              if (previous.origin === destination.origin && /^\/hls\/[a-zA-Z0-9_-]+\/index\.m3u8$/.test(previous.pathname)) {
                playbackToken = previous.searchParams.get("token") || undefined;
              }
            } catch { /* A non-local provider may not support in-place renewal. */ }
          }
          const claim = await fetchJson(claimUrl, { grant, ...(playbackToken ? { playback_token: playbackToken } : {}) }, "local");
          candidate = claim.playback?.hls_url;
          ttl = claim.expires_in_seconds;
        }
        if (typeof candidate !== "string" || !candidate) throw new PlaybackFlowError("playback_missing");
        const ttlMs = typeof ttl === "number" && Number.isFinite(ttl)
          ? Math.max(0, Math.min(maxSessionTtlMs, ttl * 1000 - 5000))
          : maxSessionTtlMs;
        if (pending.cacheable && ttlMs > 0) {
          // Bound retained entries even when a user switches between many sites.
          if (playbackSessions.size >= 256) playbackSessions.delete(playbackSessions.keys().next().value!);
          playbackSessions.set(key, { url: candidate, expiresAt: now() + ttlMs });
        }
        return candidate;
      }
      throw new PlaybackFlowError("playback_missing");
    })();
    pendingSessions.set(key, pending);
    try {
      return await pending.promise;
    } finally {
      if (pendingSessions.get(key) === pending) pendingSessions.delete(key);
    }
  }

  return { request, invalidate, renew: (siteId: string, sourceId: string, url: string) => request(siteId, sourceId, url) };
}
