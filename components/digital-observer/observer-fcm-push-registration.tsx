"use client";

import { useState } from "react";
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

async function postJson(url: string, body: Record<string, unknown>) {
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
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || "הפעולה נכשלה.");
  return result?.data ?? result;
}

export function ObserverFcmPushRegistration({ siteId }: { siteId: string }) {
  const [state, setState] = useState<ActionState>(initialState);
  const [testing, setTesting] = useState(false);

  async function register() {
    setState({ busy: true, registered: false, message: "", error: "" });
    try {
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

      await postJson("/api/push/register", {
        platform: "web",
        device_token: token,
        metadata: { source: "digital_observer_fcm", observer_site_id: siteId }
      });
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
      });

      onMessage(messaging, (payload) => {
        if (Notification.permission !== "granted") return;
        new Notification(payload.notification?.title || "תצפיתן דיגיטלי", {
          body: payload.notification?.body || "התקבלה התראה חדשה.",
          icon: "/assets/digital-observer/app-icon.svg"
        });
      });
      setState({ busy: false, registered: true, message: "המכשיר מחובר ל־Firebase Push.", error: "" });
    } catch (error) {
      setState({ busy: false, registered: false, message: "", error: error instanceof Error ? error.message : "לא ניתן לרשום את המכשיר." });
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
    <button className="do-button primary" type="button" onClick={sendTest} disabled={testing || !state.registered}>
      {testing ? <LoaderCircle className="do-spin" /> : <Send />} שליחת Push לבדיקה
    </button>
    {state.message ? <p className="do-notice success"><BellRing /> {state.message}</p> : null}
    {state.error ? <p className="do-notice warn"><BellRing /> {state.error}</p> : null}
  </div>;
}
