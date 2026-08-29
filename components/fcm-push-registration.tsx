"use client";

import { useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

export function FcmPushRegistration() {
  const [status, setStatus] = useState<string | null>(null);
  async function enable() {
    try {
      if (!(await isSupported())) return setStatus("הדפדפן אינו תומך בהתראות.");
      if (await Notification.requestPermission() !== "granted") return setStatus("לא ניתנה הרשאה להתראות.");
      const app = getApps()[0] ?? initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
      });
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      const token = await getToken(getMessaging(app), { vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY, serviceWorkerRegistration: registration });
      if (!token) throw new Error("missing_token");
      const response = await fetch("/api/push/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform: "web", device_token: token, metadata: { source: "fcm_web" } }) });
      if (!response.ok) throw new Error("registration_failed");
      setStatus("התראות הופעלו במכשיר זה.");
    } catch { setStatus("לא ניתן היה להפעיל התראות. נסו שוב."); }
  }
  return <button type="button" onClick={enable} className="button secondary">הפעלת התראות במכשיר זה{status ? ` · ${status}` : ""}</button>;
}
