"use client";

import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { Network } from "@capacitor/network";
import { Preferences } from "@capacitor/preferences";
import { PushNotifications, type PushNotificationSchema } from "@capacitor/push-notifications";
import { useEffect, useState } from "react";
import { mobileNotificationPreview, mobileRuntimeRequiresSession, nativeAppAcceptsMobileLink, sanitizeOfflineQueue, type MobileOfflineOperation } from "@/lib/domain/digital-observer/mobile-runtime";
import { openMobilePlaybackPublisher } from "@/lib/domain/digital-observer/mobile-playback-lifecycle";
import { nativePushResult, parseNativePushRequest, type NativePushRequest } from "@/lib/domain/digital-observer/native-push-request";
import { firstLaunchOfMobileLink, rememberPendingMobileLink, takePendingMobileLink } from "@/lib/domain/digital-observer/pending-mobile-link";
import { observerNativePushAvailable } from "@/lib/domain/digital-observer/native-push-availability";

const deviceReferenceKey = "digital_observer_native_device_reference_v1";
const offlineQueueKey = "digital_observer_mobile_offline_queue_v1";
const pushSiteKey = "digital_observer_native_push_site_v1";
const pushOwnerKey = "digital_observer_native_push_owner_v1";

type RuntimeSite = { id: string; name: string; timezone: string | null };
type RuntimeResponse = { data?: { session?: { profile_id?: string }; sites?: RuntimeSite[] } };

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
  if (Capacitor.isNativePlatform()) {
    const appId = await App.getInfo().then((info) => info.id).catch(() => "");
    if (!nativeAppAcceptsMobileLink(rawUrl, appId, Capacitor.getPlatform(), window.location.origin))
      throw new Error("MOBILE_LINK_APP_MISMATCH");
  }
  const response = await fetch("/api/digital-observer/mobile/runtime", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: rawUrl })
  });
  const payload = await response.json().catch(() => ({}));
  const destination = payload?.data?.destination;
  if (response.status === 401 && Capacitor.isNativePlatform() && window.sessionStorage &&
    rememberPendingMobileLink(window.sessionStorage, rawUrl)) {
    if (window.location.pathname !== "/digital-observer/login") window.location.replace("/digital-observer/login");
    throw new Error("SESSION_REVALIDATION_REQUIRED");
  }
  if (!response.ok || typeof destination !== "string" || !destination.startsWith("/digital-observer/")) {
    throw new Error(response.status === 401 ? "SESSION_REVALIDATION_REQUIRED" : "MOBILE_LINK_DENIED");
  }
  window.location.assign(destination);
}

export function ObserverMobileRuntime() {
  const [native] = useState(() => typeof window !== "undefined" && Capacitor.isNativePlatform());
  const [pushAvailable, setPushAvailable] = useState<boolean | null>(null);
  const [online, setOnline] = useState(true);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    const playbackPublisher = openMobilePlaybackPublisher();
    let sites: RuntimeSite[] = [];
    let pendingPushRequest: NativePushRequest | null = null;
    let pendingPushDeadline = 0;
    let checking = false;
    let checkingVersion = 0;
    let recheckRequested = false;
    let networkOffline = false;
    let networkKnown = false;
    let appInactive = false;
    let networkObservations = 0;
    let interruptionVersion = 0;
    let listenerFailure = false;
    let pushEnabled = false;
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
      if (disposed || !playbackPublisher.isCurrent()) return;
      if (checking) {
        if (checkingVersion !== interruptionVersion) recheckRequested = true;
        return;
      }
      checking = true;
      const startedVersion = interruptionVersion;
      checkingVersion = startedVersion;
      setStale(true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch("/api/digital-observer/mobile/runtime", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (disposed || !playbackPublisher.isCurrent()) return;
        if (!response.ok) throw new Error(response.status === 401 ? "SESSION_REVALIDATION_REQUIRED" : "RUNTIME_UNAVAILABLE");
        const payload = await response.json() as RuntimeResponse;
        const profileId = payload.data?.session?.profile_id;
        if (!profileId) throw new Error("RUNTIME_UNAVAILABLE");
        const previousOwner = await Preferences.get({ key: pushOwnerKey });
        if (previousOwner.value !== profileId) {
          // Native Preferences outlive a web sign-out. Legacy unbound state and
          // another account's pending Push intent must never replay on login.
          await Preferences.remove({ key: pushSiteKey });
          await Preferences.remove({ key: offlineQueueKey });
          await Preferences.set({ key: pushOwnerKey, value: profileId });
        }
        sites = payload.data?.sites ?? [];
        const savedSite = await Preferences.get({ key: pushSiteKey });
        if (savedSite.value && sites.some((site) => site.id === savedSite.value)) {
          await registerDevice(savedSite.value).catch(() => undefined);
        }
        const pending = await readQueue();
        await writeQueue(pending.filter((item) => item.kind !== "runtime_revalidate"));
        if (pushEnabled && pending.some((item) => item.kind === "push_registration")) {
          const permission = await PushNotifications.checkPermissions();
          if (permission.receive === "granted") await PushNotifications.register();
        }
        const pendingLink = window.sessionStorage ? takePendingMobileLink(window.sessionStorage) : null;
        if (pendingLink) {
          try { await authorizeAndOpen(pendingLink); return; }
          catch (error) {
            emit("digital-observer:mobile-link-denied");
            if (error instanceof Error && error.message === "SESSION_REVALIDATION_REQUIRED") return;
          }
        }
        if (!disposed && playbackPublisher.isCurrent() && !listenerFailure && networkKnown && !networkOffline && !appInactive && startedVersion === interruptionVersion) setStale(false);
      } catch (error) {
        if (disposed || !playbackPublisher.isCurrent()) return;
        await enqueue("runtime_revalidate");
        if (disposed || !playbackPublisher.isCurrent()) return;
        setStale(true);
        if (error instanceof Error && error.message === "SESSION_REVALIDATION_REQUIRED"
          && mobileRuntimeRequiresSession(window.location.pathname)) {
          sites = [];
          const login = new URL("/digital-observer/login", window.location.origin);
          login.searchParams.set("next", window.location.pathname + window.location.search);
          window.location.replace(login.href);
        }
      } finally {
        clearTimeout(timeout);
        checking = false;
        if (recheckRequested && !disposed && playbackPublisher.isCurrent()) {
          recheckRequested = false;
          if (!networkOffline && !appInactive) void bootstrap();
        }
      }
    };

    const handlePushRegistration = async (token: { value: string }) => {
      const request = Date.now() < pendingPushDeadline ? pendingPushRequest : null;
      if (!request) pendingPushRequest = null;
      const savedSite = await Preferences.get({ key: pushSiteKey });
      const siteId = request?.siteId || savedSite.value || "";
      if (!siteId || !sites.some((site) => site.id === siteId)) {
        if (request && pendingPushRequest === request) {
          pendingPushRequest = null;
          emit("digital-observer:native-push-result", nativePushResult(request, false, "site_required"));
        }
        return;
      }
      try {
        await registerDevice(siteId, token.value);
        await Preferences.set({ key: pushSiteKey, value: siteId });
        await writeQueue((await readQueue()).filter((item) => item.kind !== "push_registration"));
        if (request && pendingPushRequest === request) {
          pendingPushRequest = null;
          emit("digital-observer:native-push-result", nativePushResult(request, true));
        }
      } catch {
        await enqueue("push_registration");
        if (request && pendingPushRequest === request) {
          pendingPushRequest = null;
          emit("digital-observer:native-push-result", nativePushResult(request, false, "registration_failed"));
        }
      }
    };

    const enablePush = async (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      const request = parseNativePushRequest(detail, sites.map((site) => site.id));
      if (!request) return;
      if (Date.now() >= pendingPushDeadline) pendingPushRequest = null;
      if (pendingPushRequest) {
        emit("digital-observer:native-push-result", nativePushResult(request, false, "registration_in_progress"));
        return;
      }
      if (!pushEnabled) {
        emit("digital-observer:native-push-result", nativePushResult(request, false, "push_unavailable_in_qa"));
        return;
      }
      pendingPushRequest = request;
      pendingPushDeadline = Date.now() + 30_000;
      try {
        let permission = await PushNotifications.checkPermissions();
        if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
          permission = await PushNotifications.requestPermissions();
        }
        if (permission.receive !== "granted") {
          if (pendingPushRequest === request) {
            pendingPushRequest = null;
            emit("digital-observer:native-push-result", nativePushResult(request, false, "permission_denied"));
          }
          return;
        }
        await PushNotifications.register();
      } catch {
        if (pendingPushRequest === request) {
          pendingPushRequest = null;
          emit("digital-observer:native-push-result", nativePushResult(request, false, "registration_failed"));
        }
      }
    };

    const start = async () => {
      const appId = await App.getInfo().then((info) => info.id).catch(() => null);
      pushEnabled = observerNativePushAvailable({
        appId, platform: Capacitor.getPlatform(), pluginAvailable: Capacitor.isPluginAvailable("PushNotifications")
      });
      if (disposed || !playbackPublisher.isCurrent()) return;
      setPushAvailable(pushEnabled);
      const listenerFailed = () => {
        if (disposed || !playbackPublisher.isCurrent()) return;
        listenerFailure = true;
        setStale(true);
      };
      // Start both registrations before awaiting either plugin, status, or authentication.
      const networkRegistration = Network.addListener("networkStatusChange", async (next) => {
        if (disposed || !playbackPublisher.networkOffline(!next.connected)) return;
        networkObservations++;
        networkKnown = true;
        networkOffline = !next.connected;
        if (networkOffline) interruptionVersion++;
        setOnline(next.connected);
        if (!next.connected) setStale(true);
        emit(next.connected ? "digital-observer:mobile-online" : "digital-observer:mobile-offline", { connectionType: next.connectionType });
        if (next.connected) await bootstrap();
      }).then(async (network) => {
        if (disposed || !playbackPublisher.isCurrent()) await network.remove();
        else removers.push(() => network.remove());
      }).catch(listenerFailed);
      const appRegistration = App.addListener("appStateChange", async ({ isActive }) => {
        if (disposed || !playbackPublisher.appInactive(!isActive)) return;
        appInactive = !isActive;
        if (appInactive) interruptionVersion++;
        if (!isActive) setStale(true);
        emit(isActive ? "digital-observer:mobile-resume" : "digital-observer:mobile-suspend");
        if (isActive) await bootstrap();
      }).then(async (appState) => {
        if (disposed || !playbackPublisher.isCurrent()) await appState.remove();
        else removers.push(() => appState.remove());
      }).catch(listenerFailed);

      const status = await Network.getStatus();
      if (disposed || !playbackPublisher.isCurrent()) return;
      if (networkObservations === 0) {
        if (!playbackPublisher.networkOffline(!status.connected)) return;
        networkKnown = true;
        networkOffline = !status.connected;
        if (networkOffline) interruptionVersion++;
        setOnline(status.connected);
        if (!status.connected) setStale(true);
        if (status.connected) await bootstrap(); else await enqueue("runtime_revalidate");
      }
      await Promise.all([networkRegistration, appRegistration]);
      if (disposed || !playbackPublisher.isCurrent()) return;

      const appUrl = await App.addListener("appUrlOpen", ({ url }) => { void authorizeAndOpen(url).catch(() => emit("digital-observer:mobile-link-denied")); });
      if (disposed || !playbackPublisher.isCurrent()) { await appUrl.remove(); return; }
      removers.push(() => appUrl.remove());
      const launch = await App.getLaunchUrl();
      if (disposed || !playbackPublisher.isCurrent()) return;
      if (launch?.url && window.sessionStorage && firstLaunchOfMobileLink(window.sessionStorage, launch.url))
        void authorizeAndOpen(launch.url).catch(() => emit("digital-observer:mobile-link-denied"));

      if (pushEnabled) {
        const registration = await PushNotifications.addListener("registration", (token) => { void handlePushRegistration(token); });
        const registrationError = await PushNotifications.addListener("registrationError", () => {
          const request = pendingPushRequest;
          pendingPushRequest = null;
          if (request) emit("digital-observer:native-push-result", nativePushResult(request, false, "provider_error"));
        });
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

    void start().catch(() => { if (!disposed && playbackPublisher.isCurrent()) setStale(true); });
    return () => {
      disposed = true;
      pendingPushRequest = null;
      playbackPublisher.close();
      window.removeEventListener("digital-observer:enable-native-push", enablePush);
      window.removeEventListener("pageshow", bootstrap);
      void Promise.all(removers.map((remove) => remove()));
    };
  }, []);

  if (!native) return null;
  return <>
    {stale && mobileRuntimeRequiresSession(window.location.pathname) ? <div role="alert" style={{ position: "fixed", inset: 0, zIndex: 2147483647, background: "#061d3a", color: "white", display: "grid", placeContent: "center", padding: 24, textAlign: "center" }}>
      <p>{online ? "הגישה מוגנת עד להשלמת אימות הסשן." : "אין חיבור רשת. מידע מוגן מוסתר עד לאימות מחדש."}</p>
      <button type="button" onClick={() => window.location.reload()}>נסה שוב</button>
    </div> : null}
    {pushAvailable === false ? <div className="do-mobile-runtime-banner" role="status">Push כבוי בבניית QA זו. התראות בתוך המוצר עדיין זמינות.</div> : null}
    {(!online || stale) ? <div className="do-mobile-runtime-banner" role="status" aria-live="polite">
      {online ? "המידע מוצג ממצב שמור עד להשלמת אימות מחדש." : "אין חיבור רשת. מידע קיים עשוי להיות ישן ופעולות יסתנכרנו בבטחה לאחר החיבור."}
    </div> : null}
  </>;
}
