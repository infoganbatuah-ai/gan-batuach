import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

function app() {
  if (getApps().length) return getApps()[0]!;
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FCM_SERVICE_ACCOUNT_JSON is missing");
  return initializeApp({ credential: cert(JSON.parse(raw)) });
}

export async function sendFcmMessage(token: string, payload: { title: string; body?: string | null; actionUrl?: string | null }) {
  const configuredBase = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://ganbatuach.com");
  const link = new URL(payload.actionUrl ?? "/dashboard", configuredBase).toString();
  return getMessaging(app()).send({
    token,
    notification: { title: payload.title, body: payload.body ?? undefined },
    webpush: { fcmOptions: { link } }
  });
}
