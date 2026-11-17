"use client";

import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { BellRing, LoaderCircle, Send, Smartphone } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";

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

async function postJson(url: string, body: Record<string, unknown>, isCurrent: () => boolean) {
  if (!isCurrent()) return null;
  const accessToken = readObserverAccessToken();
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify(body)
  });
  if (!isCurrent()) return null;
  const result = await response.json().catch(() => ({}));
  if (!isCurrent()) return null;
  if (!response.ok) throw new Error(result?.error || "הפעולה נכשלה.");
  return result?.data ?? result;
}

export function ObserverFcmPushRegistration({ siteId, initialRegistered = false }: { siteId: string; initialRegistered?: boolean }) {
  return <SitePushRegistration key={siteId} siteId={siteId} initialRegistered={initialRegistered} />;
}

function SitePushRegistration({ siteId, initialRegistered }: { siteId: string; initialRegistered: boolean }) {
  const [state, setState] = useState<ActionState>({ ...initialState, registered: initialRegistered });
  const [testing, setTesting] = useState(false);
  const lifetime = useRef({ active: true, registration: 0, test: 0, registered: initialRegistered, registrationInFlight: false, testInFlight: false,
    cancelNative: null as (() => void) | null,
    unsubscribe: null as (() => void) | null });

  const stopForeground = () => {
    const unsubscribe = lifetime.current.unsubscribe;
    lifetime.current.unsubscribe = null;
    try { unsubscribe?.(); } catch { /* Best-effort cleanup, without retries. */ }
  };

  useEffect(() => {
    const owner = lifetime.current;
    owner.active = true;
    return () => {
      owner.active = false;
      owner.registration++;
      owner.test++;
      owner.registrationInFlight = false;
      owner.testInFlight = false;
      owner.cancelNative?.();
      const unsubscribe = owner.unsubscribe;
      owner.unsubscribe = null;
      try { unsubscribe?.(); } catch { /* Best-effort cleanup, without retries. */ }
    };
  }, []);

  async function register() {
    const owner = lifetime.current;
    if (!owner.active || owner.registrationInFlight) return;
    owner.registrationInFlight = true;
    owner.registered = false;
    const generation = ++owner.registration;
    owner.test++;
    owner.testInFlight = false;
    const isCurrent = () => owner.active && generation === owner.registration;
    owner.cancelNative?.();
    stopForeground();
    setTesting(false);
    setState({ busy: true, registered: false, message: "", error: "" });
    try {
      if (Capacitor.isNativePlatform()) {
        const requestId = crypto.randomUUID();
        const result = await new Promise<{ ok: boolean; reason?: string } | null>((resolve, reject) => {
          let settled = false;
          let timeout: number | undefined;
          const release = () => {
            if (timeout !== undefined) window.clearTimeout(timeout);
            window.removeEventListener("digital-observer:native-push-result", listener);
            if (owner.cancelNative === cancel) owner.cancelNative = null;
          };
          const finish = (value: { ok: boolean; reason?: string } | null) => {
            if (settled) return;
            settled = true;
            release();
            resolve(value);
          };
          const cancel = () => finish(null);
          const listener = (event: Event) => {
            if (!isCurrent() || settled) return;
            const detail = (event as CustomEvent<unknown>).detail;
            if (!detail || typeof detail !== "object") return;
            const result = detail as { requestId?: unknown; siteId?: unknown; ok?: unknown; reason?: unknown };
            if (typeof result.requestId !== "string" || result.requestId.length === 0 || result.requestId.length > 128
              || result.requestId !== requestId || result.siteId !== siteId) return;
            if (typeof result.ok !== "boolean" || (result.reason !== undefined && typeof result.reason !== "string")) return;
            finish({ ok: result.ok, reason: result.reason });
          };
          owner.cancelNative = cancel;
          try {
            timeout = window.setTimeout(() => finish(isCurrent() ? { ok: false, reason: "timeout" } : null), 30_000);
            // A foreign event must not consume DOM once before a matching result.
            window.addEventListener("digital-observer:native-push-result", listener);
            window.dispatchEvent(new CustomEvent("digital-observer:enable-native-push", { detail: { siteId, requestId } }));
          } catch (error) {
            if (!settled) { settled = true; release(); reject(error); }
          }
        });
        if (!isCurrent() || result === null) return;
        if (!result.ok) {
          const reason = result.reason === "permission_denied"
            ? "הרשאת ההתראות לא אושרה במכשיר."
            : "רישום ה־Push במכשיר לא הושלם.";
          throw new Error(reason);
        }
        owner.registered = true;
        setState({ busy: false, registered: true, message: "המכשיר נרשם. מסירה חיצונית נשארת כפופה להפעלת ספק נפרדת.", error: "" });
        return;
      }
      const supported = await isSupported();
      if (!isCurrent()) return;
      if (!supported) throw new Error("הדפדפן הזה אינו תומך ב־Push.");
      const permission = await Notification.requestPermission();
      if (!isCurrent()) return;
      if (permission !== "granted") throw new Error("יש לאשר התראות כדי לרשום את המכשיר.");
      const app = getApps()[0] ?? initializeApp(firebaseConfig());
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      if (!isCurrent()) return;
      const messaging = getMessaging(app);
      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY,
        serviceWorkerRegistration: registration
      });
      if (!isCurrent()) return;
      if (!token) throw new Error("Firebase לא החזיר טוקן למכשיר.");

      await postJson("/api/push/register", {
        platform: "web",
        device_token: token,
        metadata: { source: "digital_observer_fcm", observer_site_id: siteId }
      }, isCurrent);
      if (!isCurrent()) return;
      const storageKey = "digital_observer_device_reference";
      const existing = window.localStorage.getItem(storageKey);
      const reference = existing || crypto.randomUUID();
      if (!existing) window.localStorage.setItem(storageKey, reference);
      await postJson("/api/digital-observer/access-settings", {
        action: "register_device",
        observer_site_id: siteId,
        device_label: /Mobi|Android/i.test(navigator.userAgent) ? "המכשיר הנייד שלי" : "הדפדפן שלי",
        platform: "web",
        device_reference: reference
      }, isCurrent);
      if (!isCurrent()) return;

      const unsubscribe = onMessage(messaging, (payload) => {
        if (!isCurrent()) return;
        if (Notification.permission !== "granted") return;
        new Notification(payload.notification?.title || "תצפיתן דיגיטלי", {
          body: payload.notification?.body || "התקבלה התראה חדשה.",
          icon: "/assets/digital-observer/app-icon.svg"
        });
      });
      let removed = false;
      owner.unsubscribe = () => {
        if (removed) return;
        removed = true;
        unsubscribe();
      };
      owner.registered = true;
      setState({ busy: false, registered: true, message: "המכשיר נרשם. מסירה חיצונית נשארת כבויה עד אישור הפעלה נפרד.", error: "" });
    } catch (error) {
      if (!isCurrent()) return;
      owner.registered = false;
      setState({ busy: false, registered: false, message: "", error: error instanceof Error ? error.message : "לא ניתן לרשום את המכשיר." });
    } finally {
      if (isCurrent()) owner.registrationInFlight = false;
    }
  }

  async function sendTest() {
    const owner = lifetime.current;
    if (!owner.active || owner.testInFlight || owner.registrationInFlight || !owner.registered) return;
    owner.testInFlight = true;
    const generation = ++owner.test;
    const registration = owner.registration;
    const isCurrent = () => owner.active && generation === owner.test && registration === owner.registration;
    setTesting(true);
    setState((current) => ({ ...current, message: "", error: "" }));
    try {
      const result = await postJson("/api/digital-observer/notifications/push-test", { observer_site_id: siteId }, isCurrent);
      if (!isCurrent()) return;
      setState((current) => ({ ...current, registered: true, message: result.message || "התראת הבדיקה נשלחה.", error: "" }));
    } catch (error) {
      if (!isCurrent()) return;
      setState((current) => ({ ...current, message: "", error: error instanceof Error ? error.message : "שליחת הבדיקה נכשלה." }));
    } finally {
      if (isCurrent()) {
        owner.testInFlight = false;
        setTesting(false);
      }
    }
  }

  return <div className="do-page-stack">
    <button className="do-button secondary" type="button" onClick={register} disabled={state.busy}>
      {state.busy ? <LoaderCircle className="do-spin" /> : <Smartphone />} הפעלת Push במכשיר הזה
    </button>
    <button className="do-button primary" type="button" onClick={sendTest} disabled={testing || !state.registered}>
      {testing ? <LoaderCircle className="do-spin" /> : <Send />} בדיקת חוזה Push ללא שליחה
    </button>
    {state.message ? <p className="do-notice success"><BellRing /> {state.message}</p> : null}
    {state.error ? <p className="do-notice warn"><BellRing /> {state.error}</p> : null}
  </div>;
}
