"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import { useState } from "react";

type DeviceBridge = {
  publicKey(): Promise<{ publicKey: string }>;
  signChallenge(input: { payload: string }): Promise<{ signature: string }>;
};
const device = registerPlugin<DeviceBridge>("Push44QaDeviceProof");
const endpoint = "/api/digital-observer/qa-device";
type Pending = { publicKey: string; keyId: string; enrollmentRequestId: string; expiresAt: number };
type State = "IDLE" | "PENDING" | "APPROVED" | "DENIED" | "EXPIRED" | "ENROLLED";

async function control(input: Record<string, string>) {
  const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error("QA_DEVICE_DENIED");
  return response.json();
}

export function ObserverQaDeviceEnrollment() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [state, setState] = useState<State>("IDLE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const eligible = typeof window !== "undefined" &&
    window.location.hostname === "qa-iphone-device-proof.ganbatuach.com" &&
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios" &&
    Capacitor.isPluginAvailable("Push44QaDeviceProof");

  async function requestEnrollment() {
    if (!eligible || busy || pending) return;
    setBusy(true); setError("");
    try {
      const { publicKey } = await device.publicKey();
      if (!/^[A-Za-z0-9_-]{87}$/.test(publicKey)) throw new Error("QA_DEVICE_KEY_INVALID");
      const result = await control({ action: "request", publicKey }) as Omit<Pending, "publicKey">;
      if (!/^[A-Za-z0-9_-]{43}$/.test(result.keyId) ||
        !/^[A-Za-z0-9_-]{16,96}$/.test(result.enrollmentRequestId) ||
        !Number.isSafeInteger(result.expiresAt)) throw new Error("QA_DEVICE_RESPONSE_INVALID");
      setPending({ publicKey, ...result }); setState("PENDING");
    } catch { setError("לא ניתן לשלוח בקשת רישום. לא ניתנה הרשאה למכשיר."); }
    finally { setBusy(false); }
  }

  async function checkApproval() {
    if (!eligible || busy || !pending) return;
    setBusy(true); setError("");
    try {
      const result = await control({ action: "status", publicKey: pending.publicKey,
        enrollmentRequestId: pending.enrollmentRequestId }) as { status: State };
      if (!["PENDING", "APPROVED", "DENIED", "EXPIRED", "ENROLLED"].includes(result.status)) throw new Error("QA_DEVICE_STATUS_INVALID");
      setState(result.status);
      if (result.status === "APPROVED") {
        const challenge = await control({ action: "challenge", operation: "ENROLL",
          publicKey: pending.publicKey, method: "POST", path: "/qa-device/enroll" }) as
          { challengeId: string; payload: string };
        const { signature } = await device.signChallenge({ payload: challenge.payload });
        const enrolled = await control({ action: "enroll", publicKey: pending.publicKey,
          challengeId: challenge.challengeId, signature }) as { enrolled: boolean };
        if (enrolled.enrolled !== true) throw new Error("QA_DEVICE_ENROLLMENT_DENIED");
        setState("ENROLLED");
      }
    } catch { setError("האישור טרם זמין או שהבקשה נדחתה. לא נרשמה הרשאה חדשה."); }
    finally { setBusy(false); }
  }

  return <main dir="rtl" style={{ maxWidth: 560, margin: "4rem auto", padding: "1rem" }}>
    <h1>רישום מכשיר QA — Development בלבד</h1>
    <p>הרישום דורש אישור נפרד של בעל הפרויקט ב־Mac. האייפון אינו יכול לאשר את עצמו.</p>
    {!eligible ? <p role="alert">זמין רק באפליקציית QA המאושרת באייפון ובכתובת הבקרה המדויקת.</p> : null}
    <p role="status">מצב: {state}</p>
    {pending ? <section aria-label="זהות בקשת הרישום">
      <p>מזהה בקשה: <code>{pending.enrollmentRequestId}</code></p>
      <p>טביעת אצבע של המפתח הציבורי: <code>{pending.keyId}</code></p>
      <p>תוקף הבקשה: {new Date(pending.expiresAt).toLocaleString("he-IL")}</p>
    </section> : null}
    {error ? <p role="alert">{error}</p> : null}
    {!pending ? <button type="button" disabled={!eligible || busy} onClick={requestEnrollment}>יצירת בקשת רישום</button> :
      <button type="button" disabled={!eligible || busy || state === "ENROLLED" || state === "EXPIRED" || state === "DENIED"}
        onClick={checkApproval}>בדיקת אישור נפרד</button>}
  </main>;
}
