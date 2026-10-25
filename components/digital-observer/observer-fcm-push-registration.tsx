"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { BellRing, LoaderCircle, Send, Smartphone } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";
import { registerObserverPushAfterSiteGate } from "@/lib/domain/digital-observer/push-registration-order";
import { clearConfirmedBrowserPushBinding, confirmedBrowserPushRevocation, readBrowserPushBinding,
  reconcileBrowserPushBinding, recoverLegacyBrowserPushBinding, saveBrowserPushBinding, verifiedBrowserPushRuntime,
  type BrowserPushBinding } from "@/lib/domain/digital-observer/browser-push-lifecycle";

type ActionState = { busy: boolean; registered: boolean; message: string; error: string };
const initialState: ActionState = { busy: false, registered: false, message: "", error: "" };

function firebaseConfig() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  };
  if (Object.values(config).some((value) => !value) || !process.env.NEXT_PUBLIC_FCM_VAPID_KEY) {
    throw new Error("חסרה תצורת Firebase בדפדפן.");
  }
  return config;
}

async function postJson(url: string, body: Record<string, unknown>) {
  const accessToken = readObserverAccessToken();
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    signal: AbortSignal.timeout(10_000),
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || "הפעולה נכשלה.");
  return result?.data ?? result;
}

async function currentBrowserRuntime() {
  const accessToken = readObserverAccessToken();
  const response = await fetch("/api/digital-observer/mobile/runtime", {
    credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10_000),
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  });
  if (!response.ok) throw new Error(response.status === 401 ? "SESSION_REVALIDATION_REQUIRED" : "RUNTIME_UNAVAILABLE");
  return verifiedBrowserPushRuntime(await response.json().catch(() => null));
}

async function revokeBrowserBinding(binding: BrowserPushBinding) {
  const result = await postJson("/api/push/unregister", {
    device_id: binding.deviceReference, source: "digital_observer_fcm", observer_site_id: binding.siteId
  });
  if (!confirmedBrowserPushRevocation({ data: result }, binding)) throw new Error("PUSH_REVOCATION_UNCONFIRMED");
  clearConfirmedBrowserPushBinding(window.localStorage, binding);
}

async function readOrRecoverBrowserBinding() {
  try { return readBrowserPushBinding(window.localStorage); }
  catch (error) {
    if (!(error instanceof Error) || error.message !== "PUSH_LEGACY_BINDING_UNSCOPED") throw error;
  }
  const reference = window.localStorage.getItem("digital_observer_device_reference");
  if (!reference) throw new Error("PUSH_LEGACY_BINDING_UNTRUSTED");
  const accessToken = readObserverAccessToken();
  const url = new URL("/api/push/browser-binding", window.location.origin);
  url.searchParams.set("device_id", reference);
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store",
    signal: AbortSignal.timeout(10_000), headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
  if (!response.ok) throw new Error(response.status === 401 ? "SESSION_REVALIDATION_REQUIRED" : "PUSH_LEGACY_BINDING_UNVERIFIED");
  return recoverLegacyBrowserPushBinding(window.localStorage, await response.json().catch(() => null));
}

// Mounted at the Observer boundary, not only on a Site settings page. A lost
// last Site still leaves a same-owner session able to revoke its exact token.
export function ObserverWebPushCleanup() {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    let checking = false;
    const check = async () => {
      if (checking) return;
      checking = true;
      try {
        const binding = await readOrRecoverBrowserBinding();
        if (!binding) return;
        try {
          const runtime = await currentBrowserRuntime();
          await reconcileBrowserPushBinding(binding, runtime, null, revokeBrowserBinding);
        } catch (error) {
          if (!(error instanceof Error) || error.message !== "SESSION_REVALIDATION_REQUIRED") throw error;
          // 401 may mean the last Observer affiliation was removed. The
          // server still authenticates and reports the owning profile; a
          // missing session or a different signed-in user cannot clear this.
          await revokeBrowserBinding(binding);
        }
      } catch {
        // Offline, invalid session, changed owner or untrusted response:
        // retain the exact revocation target for a later visit/focus. After
        // logout, the original owner must reauthenticate before retrying;
        // local deletion cannot prove server revocation.
      } finally { checking = false; }
    };
    void check();
    const onFocus = () => { void check(); };
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}

export function ObserverFcmPushRegistration({ siteId }: { siteId: string }) {
  const [state, setState] = useState<ActionState>(initialState);
  const [testing, setTesting] = useState(false);

  async function register() {
    setState({ busy: true, registered: false, message: "", error: "" });
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await new Promise<{ ok: boolean; reason?: string }>((resolve) => {
          const listener = (event: Event) => {
            window.clearTimeout(timeout);
            window.removeEventListener("digital-observer:native-push-result", listener);
            resolve((event as CustomEvent<{ ok: boolean; reason?: string }>).detail);
          };
          const timeout = window.setTimeout(() => {
            window.removeEventListener("digital-observer:native-push-result", listener);
            resolve({ ok: false, reason: "timeout" });
          }, 30_000);
          window.addEventListener("digital-observer:native-push-result", listener, { once: true });
          window.dispatchEvent(new CustomEvent("digital-observer:enable-native-push", { detail: { siteId } }));
        });
        if (!result.ok) {
          const reason = result.reason === "permission_denied"
            ? "הרשאת ההתראות לא אושרה במכשיר."
            : result.reason === "token_conflict"
              ? "למכשיר יש שיוך Push קודם. בטל אותו כאן ואז נסה להירשם שוב."
            : "רישום ה־Push במכשיר לא הושלם.";
          throw new Error(reason);
        }
        setState({ busy: false, registered: true, message: "המכשיר נרשם. מסירה חיצונית נשארת כפופה להפעלת ספק נפרדת.", error: "" });
        return;
      }
      const runtime = await currentBrowserRuntime();
      const saved = await readOrRecoverBrowserBinding();
      const reconciled = await reconcileBrowserPushBinding(saved, runtime, siteId, revokeBrowserBinding);
      if (!(await isSupported())) throw new Error("הדפדפן הזה אינו תומך ב־Push.");
      if (await Notification.requestPermission() !== "granted") throw new Error("יש לאשר התראות כדי לרשום את המכשיר.");
      const app = getApps()[0] ?? initializeApp(firebaseConfig());
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY,
        serviceWorkerRegistration: registration
      });
      if (!token) throw new Error("Firebase לא החזיר טוקן למכשיר.");

      const reference = reconciled.binding?.deviceReference ?? crypto.randomUUID();
      const binding: BrowserPushBinding = { version: 1, profileId: runtime.profileId, siteId, deviceReference: reference };
      // Store before the first server write. A lost response must not orphan
      // an active registration without a precise revocation target.
      saveBrowserPushBinding(window.localStorage, binding);
      await registerObserverPushAfterSiteGate({ siteId,
        deviceLabel: /Mobi|Android/i.test(navigator.userAgent) ? "המכשיר הנייד שלי" : "הדפדפן שלי",
        platform: "web", deviceReference: reference, deviceToken: token,
        source: "digital_observer_fcm" }, postJson);

      onMessage(messaging, (payload) => {
        if (Notification.permission !== "granted") return;
        new Notification(payload.notification?.title || "תצפיתן דיגיטלי", {
          body: payload.notification?.body || "התקבלה התראה חדשה.",
          icon: "/assets/digital-observer/app-icon.svg"
        });
      });
      setState({ busy: false, registered: true, message: "המכשיר נרשם. מסירה חיצונית נשארת כבויה עד אישור הפעלה נפרד.", error: "" });
    } catch (error) {
      setState({ busy: false, registered: false, message: "", error: error instanceof Error ? error.message : "לא ניתן לרשום את המכשיר." });
    }
  }

  async function disable() {
    setState((current) => ({ ...current, busy: true, message: "", error: "" }));
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await new Promise<{ ok: boolean }>((resolve) => {
          const listener = (event: Event) => {
            window.clearTimeout(timeout);
            window.removeEventListener("digital-observer:native-push-revoke-result", listener);
            resolve((event as CustomEvent<{ ok: boolean }>).detail);
          };
          const timeout = window.setTimeout(() => {
            window.removeEventListener("digital-observer:native-push-revoke-result", listener);
            resolve({ ok: false });
          }, 30_000);
          window.addEventListener("digital-observer:native-push-revoke-result", listener, { once: true });
          window.dispatchEvent(new CustomEvent("digital-observer:disable-native-push", { detail: { siteId } }));
        });
        if (!result.ok) throw new Error("ביטול רישום המכשיר לא הושלם.");
      } else {
        const binding = await readOrRecoverBrowserBinding();
        if (!binding) throw new Error("לא נמצא יעד ביטול מדויק לדפדפן זה.");
        await revokeBrowserBinding(binding);
      }
      setState({ busy: false, registered: false, message: "רישום ההתראות במכשיר הזה בוטל בשרת. הרשאת הספק במכשיר לא שונתה.", error: "" });
    } catch (error) {
      setState((current) => ({ ...current, busy: false,
        error: error instanceof Error ? error.message : "ביטול רישום המכשיר נכשל." }));
    }
  }

  async function sendTest() {
    setTesting(true);
    setState((current) => ({ ...current, message: "", error: "" }));
    try {
      const result = await postJson("/api/digital-observer/notifications/push-test", { observer_site_id: siteId });
      setState((current) => ({ ...current, registered: true, message: result.message || "התראת הבדיקה נשלחה.", error: "" }));
    } catch (error) {
      setState((current) => ({ ...current, message: "", error: error instanceof Error ? error.message : "שליחת הבדיקה נכשלה." }));
    } finally {
      setTesting(false);
    }
  }

  return <div className="do-page-stack">
    <button className="do-button secondary" type="button" onClick={register} disabled={state.busy}>
      {state.busy ? <LoaderCircle className="do-spin" /> : <Smartphone />} הפעלת Push במכשיר הזה
    </button>
    <button className="do-button secondary" type="button" onClick={disable} disabled={state.busy}>
      ביטול Push במכשיר הזה
    </button>
    <button className="do-button primary" type="button" onClick={sendTest} disabled={testing || !state.registered}>
      {testing ? <LoaderCircle className="do-spin" /> : <Send />} בדיקת חוזה Push ללא שליחה
    </button>
    {state.message ? <p className="do-notice success"><BellRing /> {state.message}</p> : null}
    {state.error ? <p className="do-notice warn"><BellRing /> {state.error}</p> : null}
  </div>;
}
