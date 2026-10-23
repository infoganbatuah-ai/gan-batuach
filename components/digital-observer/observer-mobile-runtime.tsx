"use client";

import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { Network } from "@capacitor/network";
import { Preferences } from "@capacitor/preferences";
import { PushNotifications, type PushNotificationSchema } from "@capacitor/push-notifications";
import { useEffect, useState } from "react";
import { mobileNotificationPreview, mobileRuntimeRequiresSession, sanitizeOfflineQueue, type MobileOfflineOperation } from "@/lib/domain/digital-observer/mobile-runtime";

const deviceReferenceKey = "digital_observer_native_device_reference_v1";
const offlineQueueKey = "digital_observer_mobile_offline_queue_v1";
const pushSiteKey = "digital_observer_native_push_site_v1";

type RuntimeSite = { id: string; name: string; timezone: string | null };
type RuntimeResponse = { data?: { sites?: RuntimeSite[] } };

function emit(name: string, detail: Record<string, unknown> = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

async function deviceReference() {
  const existing = await Preferences.get({ key: deviceReferenceKey });
  if (existing.value) return existing.value;
  const value = crypto.randomUUID();
  await Preferences.set({ key: deviceReferenceKey, value });
  return value;
}

async function readQueue() {
  const stored = await Preferences.get({ key: offlineQueueKey });
  try {
    return sanitizeOfflineQueue(stored.value ? JSON.parse(stored.value) : []);
  } catch {
    return [];
  }
}

async function writeQueue(items: MobileOfflineOperation[]) {
  await Preferences.set({ key: offlineQueueKey, value: JSON.stringify(sanitizeOfflineQueue(items)) });
}

async function enqueue(kind: MobileOfflineOperation["kind"]) {
  const items = await readQueue();
  if (items.some((item) => item.kind === kind)) return;
  items.push({ id: crypto.randomUUID(), kind, createdAt: new Date().toISOString(), attempts: 0 });
  await writeQueue(items);
}

async function authorizeAndOpen(rawUrl: string) {
  const response = await fetch("/api/digital-observer/mobile/runtime", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: rawUrl })
  });
  const payload = await response.json().catch(() => ({}));
  const destination = payload?.data?.destination;
  if (!response.ok || typeof destination !== "string" || !destination.startsWith("/digital-observer/")) {
    throw new Error(response.status === 401 ? "SESSION_REVALIDATION_REQUIRED" : "MOBILE_LINK_DENIED");
  }
  window.location.assign(destination);
}

export function ObserverMobileRuntime() {
  const [native] = useState(() => typeof window !== "undefined" && Capacitor.isNativePlatform());
  const [pushAvailable] = useState(() => typeof window !== "undefined" && Capacitor.isPluginAvailable("PushNotifications"));
  const [online, setOnline] = useState(true);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    let sites: RuntimeSite[] = [];
    let pendingPushSiteId = "";
    let checking = false;
    const removers: Array<() => Promise<void>> = [];

    const registerDevice = async (siteId: string, pushToken?: string) => {
      const [info, appInfo] = await Promise.all([Device.getInfo(), App.getInfo()]);
      const reference = await deviceReference();
      if (pushToken) {
        const pushResponse = await fetch("/api/push/register", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            platform: Capacitor.getPlatform(),
            device_token: pushToken,
            device_id: reference,
            app_version: appInfo.version,
            metadata: { source: "digital_observer_native", observer_site_id: siteId }
          })
        });
        if (!pushResponse.ok) throw new Error("PUSH_TOKEN_REGISTRATION_FAILED");
      }
      const response = await fetch("/api/digital-observer/access-settings", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "register_device",
          observer_site_id: siteId,
          device_label: info.name || `${Capacitor.getPlatform()} device`,
          platform: Capacitor.getPlatform(),
          device_reference: reference
        })
      });
      if (!response.ok) throw new Error("DEVICE_REGISTRATION_FAILED");
    };

    const bootstrap = async () => {
      // Public sign-in and recovery routes must not redirect on an expected 401.
      if (!mobileRuntimeRequiresSession(window.location.pathname)) return;
      if (checking || disposed) return;
      checking = true;
      setStale(true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch("/api/digital-observer/mobile/runtime", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (disposed) return;
        if (!response.ok) throw new Error(response.status === 401 ? "SESSION_REVALIDATION_REQUIRED" : "RUNTIME_UNAVAILABLE");
        const payload = await response.json() as RuntimeResponse;
        sites = payload.data?.sites ?? [];
        const savedSite = await Preferences.get({ key: pushSiteKey });
        if (savedSite.value && sites.some((site) => site.id === savedSite.value)) {
          await registerDevice(savedSite.value).catch(() => undefined);
        }
        const pending = await readQueue();
        await writeQueue(pending.filter((item) => item.kind !== "runtime_revalidate"));
        if (pushAvailable && pending.some((item) => item.kind === "push_registration")) {
          const permission = await PushNotifications.checkPermissions();
          if (permission.receive === "granted") await PushNotifications.register();
        }
        if (!disposed) setStale(false);
      } catch (error) {
        await enqueue("runtime_revalidate");
        if (!disposed) setStale(true);
        if (error instanceof Error && error.message === "SESSION_REVALIDATION_REQUIRED"
          && mobileRuntimeRequiresSession(window.location.pathname)) {
          sites = [];
          window.location.replace(`/digital-observer/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        }
      } finally {
        clearTimeout(timeout);
        checking = false;
      }
    };

    const handlePushRegistration = async (token: { value: string }) => {
      const savedSite = await Preferences.get({ key: pushSiteKey });
      const siteId = pendingPushSiteId || savedSite.value || sites[0]?.id || "";
      if (!siteId) {
        emit("digital-observer:native-push-result", { ok: false, reason: "site_required" });
        return;
      }
      try {
        await registerDevice(siteId, token.value);
        await Preferences.set({ key: pushSiteKey, value: siteId });
        await writeQueue((await readQueue()).filter((item) => item.kind !== "push_registration"));
        emit("digital-observer:native-push-result", { ok: true });
      } catch {
        await enqueue("push_registration");
        emit("digital-observer:native-push-result", { ok: false, reason: "registration_failed" });
      }
    };

    const enablePush = async (event: Event) => {
      if (!pushAvailable) {
        emit("digital-observer:native-push-result", { ok: false, reason: "push_unavailable_in_qa" });
        return;
      }
      const requestedSite = (event as CustomEvent<{ siteId?: string }>).detail?.siteId;
      pendingPushSiteId = requestedSite && sites.some((site) => site.id === requestedSite) ? requestedSite : sites[0]?.id || "";
      try {
        let permission = await PushNotifications.checkPermissions();
        if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
          permission = await PushNotifications.requestPermissions();
        }
        if (permission.receive !== "granted") {
          emit("digital-observer:native-push-result", { ok: false, reason: "permission_denied" });
          return;
        }
        await PushNotifications.register();
      } catch {
        emit("digital-observer:native-push-result", { ok: false, reason: "registration_failed" });
      }
    };

    const start = async () => {
      const status = await Network.getStatus();
      setOnline(status.connected);
      setStale(!status.connected);
      if (status.connected) await bootstrap(); else await enqueue("runtime_revalidate");

      const network = await Network.addListener("networkStatusChange", async (next) => {
        if (disposed) return;
        setOnline(next.connected);
        setStale(!next.connected);
        emit(next.connected ? "digital-observer:mobile-online" : "digital-observer:mobile-offline", { connectionType: next.connectionType });
        if (next.connected) await bootstrap();
      });
      removers.push(() => network.remove());

      const appState = await App.addListener("appStateChange", async ({ isActive }) => {
        if (!isActive && !disposed) setStale(true);
        emit(isActive ? "digital-observer:mobile-resume" : "digital-observer:mobile-suspend");
        if (isActive) await bootstrap();
      });
      removers.push(() => appState.remove());

      const appUrl = await App.addListener("appUrlOpen", ({ url }) => { void authorizeAndOpen(url).catch(() => emit("digital-observer:mobile-link-denied")); });
      removers.push(() => appUrl.remove());
      const launch = await App.getLaunchUrl();
      if (launch?.url) void authorizeAndOpen(launch.url).catch(() => emit("digital-observer:mobile-link-denied"));

      if (pushAvailable) {
        const registration = await PushNotifications.addListener("registration", (token) => { void handlePushRegistration(token); });
        const registrationError = await PushNotifications.addListener("registrationError", () => emit("digital-observer:native-push-result", { ok: false, reason: "provider_error" }));
        const received = await PushNotifications.addListener("pushNotificationReceived", (notification: PushNotificationSchema) => {
          emit("digital-observer:native-notification", mobileNotificationPreview(notification));
        });
        const action = await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
          const link = notification.data?.deep_link;
          if (typeof link === "string") void authorizeAndOpen(link).catch(() => emit("digital-observer:mobile-link-denied"));
        });
        removers.push(() => registration.remove(), () => registrationError.remove(), () => received.remove(), () => action.remove());
      }
      window.addEventListener("digital-observer:enable-native-push", enablePush);
      window.addEventListener("pageshow", bootstrap);
    };

    void start().catch(() => setStale(true));
    return () => {
      disposed = true;
      window.removeEventListener("digital-observer:enable-native-push", enablePush);
      window.removeEventListener("pageshow", bootstrap);
      void Promise.all(removers.map((remove) => remove()));
    };
  }, [pushAvailable]);

  if (!native) return null;
  return <>
    {stale && mobileRuntimeRequiresSession(window.location.pathname) ? <div role="alert" style={{ position: "fixed", inset: 0, zIndex: 2147483647, background: "#061d3a", color: "white", display: "grid", placeContent: "center", padding: 24, textAlign: "center" }}>
      <p>{online ? "הגישה מוגנת עד להשלמת אימות הסשן." : "אין חיבור רשת. מידע מוגן מוסתר עד לאימות מחדש."}</p>
      <button type="button" onClick={() => window.location.reload()}>נסה שוב</button>
    </div> : null}
    {!pushAvailable ? <div className="do-mobile-runtime-banner" role="status">Push כבוי בבניית QA זו. התראות בתוך המוצר עדיין זמינות.</div> : null}
    {(!online || stale) ? <div className="do-mobile-runtime-banner" role="status" aria-live="polite">
      {online ? "המידע מוצג ממצב שמור עד להשלמת אימות מחדש." : "אין חיבור רשת. מידע קיים עשוי להיות ישן ופעולות יסתנכרנו בבטחה לאחר החיבור."}
    </div> : null}
  </>;
}
