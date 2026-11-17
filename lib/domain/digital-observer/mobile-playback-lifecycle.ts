"use client";

// Client-only, non-sensitive observed state. Unknown is not treated as offline.
type Snapshot = { appInactive: boolean | null; networkOffline: boolean | null };
type Listener = (snapshot: Snapshot | null) => void;
let current: { owner: symbol; snapshot: Snapshot } | null = null;
const listeners = new Set<Listener>();

function notify() {
  // Re-read for each subscriber: a reentrant publication must not deliver an
  // older snapshot to subscribers that were already notified of a newer one.
  for (const listener of listeners) listener(current ? { ...current.snapshot } : null);
}

export function openMobilePlaybackPublisher() {
  if (typeof window === "undefined") throw new Error("CLIENT_ONLY");
  const owner = Symbol("mobile-playback-publisher");
  current = { owner, snapshot: { appInactive: null, networkOffline: null } };
  notify();
  const isCurrent = () => current?.owner === owner;
  function publish(key: keyof Snapshot, value: boolean) {
    if (!isCurrent() || !current) return false;
    if (current.snapshot[key] !== value) {
      current.snapshot = { ...current.snapshot, [key]: value };
      notify();
    }
    return true;
  }
  return {
    isCurrent,
    appInactive: (value: boolean) => publish("appInactive", value),
    networkOffline: (value: boolean) => publish("networkOffline", value),
    close() {
      if (!isCurrent()) return;
      current = null;
      notify();
    }
  };
}

export function subscribeMobilePlayback(listener: Listener) {
  if (typeof window === "undefined") return () => {};
  listeners.add(listener);
  listener(current ? { ...current.snapshot } : null);
  return () => { listeners.delete(listener); };
}
