import { getDigitalObserverApiUser } from "@/lib/domain/digital-observer/access";
import { qaDeviceControlBoundary, readQaDeviceBoundedBody } from "@/lib/domain/digital-observer/qa-device-control-boundary";

export const runtime = "nodejs";

const viewerId = "00000000-0000-4000-8000-000000000f44";
const actions = {
  request: ["publicKey"],
  status: ["publicKey", "enrollmentRequestId"],
  challenge: ["operation", "publicKey", "method", "path"],
  enroll: ["publicKey", "challengeId", "signature"]
} as const;
const paths = {
  request: "/qa-device/request-enrollment",
  status: "/qa-device/status",
  challenge: "/qa-device/challenge",
  enroll: "/qa-device/enroll"
} as const;
type Action = keyof typeof actions;

const denied = () => Response.json({ error: "QA_DEVICE_DENIED" }, {
  status: 403, headers: { "cache-control": "no-store" }
});

// The native QA login keeps Supabase credentials in HttpOnly cookies. This
// local-only bridge revalidates that session server-side and never returns a
// bearer token to JavaScript. It is inert without explicit host configuration.
export async function POST(request: Request) {
  try {
    const loopback = qaDeviceControlBoundary(request, {
      VERCEL: process.env.VERCEL,
      PUSH44_QA_CONTROL_ONLY: process.env.PUSH44_QA_CONTROL_ONLY,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      PUSH44_QA_LOCAL_TRANSPORT_URL: process.env.PUSH44_QA_LOCAL_TRANSPORT_URL,
      PUSH44_QA_CONTROL_DEADLINE_MS: process.env.PUSH44_QA_CONTROL_DEADLINE_MS,
      PUSH44_QA_PROXY_KEY: process.env.PUSH44_QA_PROXY_KEY
    });
    if (!loopback) return denied();
    const body = await readQaDeviceBoundedBody(request);
    if (body === null) return denied();
    const input = JSON.parse(body) as Record<string, unknown>;
    if (!input || typeof input !== "object" || Array.isArray(input) ||
      typeof input.action !== "string" || !Object.hasOwn(actions, input.action)) return denied();
    const action = input.action as Action;
    if (Object.keys(input).some(key => key !== "action" &&
      !(actions[action] as readonly string[]).includes(key))) return denied();
    const session = await getDigitalObserverApiUser(request);
    if (!session || session.profile.id !== viewerId) return denied();
    const { data, error } = await session.supabase.auth.getSession();
    const token = data.session?.access_token;
    if (error || !token || data.session?.user.id !== viewerId) return denied();
    const payload = { ...input };
    delete payload.action;
    const response = await fetch(new URL(paths[action], loopback), {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(4_000),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.text();
    if (result.length > 2048 || ![200, 403].includes(response.status)) return denied();
    return new Response(result, { status: response.status, headers: {
      "content-type": "application/json", "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    } });
  } catch { return denied(); }
}
