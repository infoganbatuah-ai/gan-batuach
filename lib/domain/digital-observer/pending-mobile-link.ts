import { parseMobileLink } from "./mobile-runtime";

const pendingKey = "digital_observer_pending_link_v1";
const launchSeenKey = "digital_observer_launch_link_seen_v1";
const lifetimeMs = 5 * 60_000;
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function canonicalMobileLink(rawUrl: string, allowedHttpsOrigin?: string) {
  const link = parseMobileLink(rawUrl, allowedHttpsOrigin ? [allowedHttpsOrigin] : []);
  const resource = link.resourceId ? `/${link.resourceId}` : "";
  const parsed = new URL(rawUrl);
  if (parsed.protocol === "https:")
    return `${parsed.origin}/digital-observer/open/${link.kind}${resource}?site=${link.observerSiteId}`;
  const scheme = parsed.protocol.slice(0, -1);
  return `${scheme}://${link.kind}${resource}?site=${link.observerSiteId}`;
}

export function rememberPendingMobileLink(storage: StorageLike, rawUrl: string, now = Date.now(), allowedHttpsOrigin?: string) {
  try {
    const url = canonicalMobileLink(rawUrl, allowedHttpsOrigin);
    storage.setItem(pendingKey, JSON.stringify({ url, expiresAt: now + lifetimeMs }));
    return true;
  } catch { return false; }
}

export function takePendingMobileLink(storage: StorageLike, now = Date.now(), allowedHttpsOrigin?: string) {
  let raw: string | null = null;
  try { raw = storage.getItem(pendingKey); storage.removeItem(pendingKey); }
  catch { return null; }
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as { url?: unknown; expiresAt?: unknown };
    if (typeof entry.url !== "string" || typeof entry.expiresAt !== "number" || now >= entry.expiresAt || entry.expiresAt > now + lifetimeMs) return null;
    return canonicalMobileLink(entry.url, allowedHttpsOrigin);
  } catch { return null; }
}

export function clearPendingMobileLink(storage: StorageLike) {
  try { storage.removeItem(pendingKey); storage.removeItem(launchSeenKey); }
  catch { /* Unavailable session storage must not keep a link in runtime state. */ }
}

export function firstLaunchOfMobileLink(storage: StorageLike, rawUrl: string, now = Date.now(), allowedHttpsOrigin?: string) {
  try {
    const url = canonicalMobileLink(rawUrl, allowedHttpsOrigin);
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
