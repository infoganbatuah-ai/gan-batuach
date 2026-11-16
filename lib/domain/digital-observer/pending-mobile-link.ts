import { parseMobileLink } from "./mobile-runtime";

const pendingKey = "digital_observer_pending_link_v1";
const launchSeenKey = "digital_observer_launch_link_seen_v1";
const lifetimeMs = 5 * 60_000;
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function canonicalCustomLink(rawUrl: string) {
  const link = parseMobileLink(rawUrl);
  const resource = link.resourceId ? `/${link.resourceId}` : "";
  const scheme = new URL(rawUrl).protocol.slice(0, -1);
  return `${scheme}://${link.kind}${resource}?site=${link.observerSiteId}`;
}

export function rememberPendingMobileLink(storage: StorageLike, rawUrl: string, now = Date.now()) {
  try {
    const url = canonicalCustomLink(rawUrl);
    storage.setItem(pendingKey, JSON.stringify({ url, expiresAt: now + lifetimeMs }));
    return true;
  } catch { return false; }
}

export function takePendingMobileLink(storage: StorageLike, now = Date.now()) {
  let raw: string | null = null;
  try { raw = storage.getItem(pendingKey); storage.removeItem(pendingKey); }
  catch { return null; }
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as { url?: unknown; expiresAt?: unknown };
    if (typeof entry.url !== "string" || typeof entry.expiresAt !== "number" || now >= entry.expiresAt || entry.expiresAt > now + lifetimeMs) return null;
    return canonicalCustomLink(entry.url);
  } catch { return null; }
}

export function firstLaunchOfMobileLink(storage: StorageLike, rawUrl: string, now = Date.now()) {
  try {
    const url = canonicalCustomLink(rawUrl);
    const previous = storage.getItem(launchSeenKey);
    if (previous) {
      try {
        const entry = JSON.parse(previous) as { url?: unknown; expiresAt?: unknown };
        if (entry.url === url && typeof entry.expiresAt === "number" && now < entry.expiresAt) return false;
      } catch { /* A damaged marker must not suppress a valid new launch. */ }
    }
    storage.setItem(launchSeenKey, JSON.stringify({ url, expiresAt: now + lifetimeMs }));
    return true;
  } catch { return false; }
}
