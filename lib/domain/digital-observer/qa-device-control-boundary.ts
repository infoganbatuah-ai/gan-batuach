import { timingSafeEqual } from "node:crypto";

const hostname = "qa-iphone-device-proof.ganbatuach.com";

function validPrivateProxyKey(presentedKey: string, proxyKey: string) {
  return /^[A-Za-z0-9_-]{43,96}$/.test(proxyKey) &&
    presentedKey.length === proxyKey.length &&
    timingSafeEqual(Buffer.from(presentedKey), Buffer.from(proxyKey));
}

type ControlEnvironment = {
  VERCEL?: string;
  PUSH44_QA_CONTROL_ONLY?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  PUSH44_QA_LOCAL_TRANSPORT_URL?: string;
  PUSH44_QA_CONTROL_DEADLINE_MS?: string;
  PUSH44_QA_PROXY_KEY?: string;
};

// No environment setting alone can open this route: a trusted local proxy
// must strip caller-supplied forwarding/key headers and inject its private key.
export function qaDeviceControlBoundary(request: Request, env: ControlEnvironment,
  now = Date.now()): URL | null {
  try {
    const url = new URL(request.url);
    const backend = new URL(env.NEXT_PUBLIC_SUPABASE_URL || "");
    const loopback = new URL(env.PUSH44_QA_LOCAL_TRANSPORT_URL || "");
    const deadline = Number(env.PUSH44_QA_CONTROL_DEADLINE_MS);
    const proxyKey = env.PUSH44_QA_PROXY_KEY || "";
    const presentedKey = request.headers.get("x-do-qa-proxy-key") || "";
    const validKey = validPrivateProxyKey(presentedKey, proxyKey);
    const trustedLocalNext = url.protocol === "https:" &&
      (url.hostname === hostname && !url.port ||
        ["localhost", "127.0.0.1"].includes(url.hostname) && url.port === "3001");
    if (env.VERCEL || env.PUSH44_QA_CONTROL_ONLY !== "1" ||
      !trustedLocalNext || url.search ||
      request.headers.get("host") !== hostname ||
      request.headers.get("origin") !== `https://${hostname}` ||
      request.headers.get("x-forwarded-proto") !== "https" ||
      (request.headers.has("x-forwarded-host") &&
        request.headers.get("x-forwarded-host") !== hostname) ||
      request.headers.has("authorization") || !validKey ||
      request.headers.get("content-type") !== "application/json" ||
      backend.protocol !== "http:" || backend.hostname !== "127.0.0.1" ||
      backend.username || backend.password || backend.search || backend.hash || backend.pathname !== "/" ||
      loopback.protocol !== "http:" || loopback.hostname !== "127.0.0.1" ||
      !loopback.port || loopback.username || loopback.password || loopback.pathname !== "/" ||
      loopback.search || loopback.hash ||
      !Number.isSafeInteger(deadline) || deadline <= now || deadline > now + 30 * 60_000 ||
      Number(request.headers.get("content-length") || 0) > 2048) return null;
    return loopback;
  } catch { return null; }
}

// Next reconstructs the local request Host as localhost:3001 even when the
// protected socket forwarded the external QA Host. Only the private proxy key
// plus its exact forwarded host/protocol may authorize QA page rendering.
export function qaDevicePageProxyBoundary(headers: Headers, env: Pick<ControlEnvironment,
  "VERCEL" | "PUSH44_QA_CONTROL_ONLY" | "NEXT_PUBLIC_SUPABASE_URL" | "PUSH44_QA_PROXY_KEY">) {
  try {
    const backend = new URL(env.NEXT_PUBLIC_SUPABASE_URL || "");
    return !env.VERCEL && env.PUSH44_QA_CONTROL_ONLY === "1" &&
      backend.origin === "http://127.0.0.1:55421" && backend.pathname === "/" &&
      !backend.search && !backend.hash && !backend.username && !backend.password &&
      ["localhost:3001", "127.0.0.1:3001"].includes(headers.get("host") || "") &&
      headers.get("x-forwarded-host") === hostname &&
      headers.get("x-forwarded-proto") === "https" &&
      !headers.has("forwarded") && !headers.has("authorization") &&
      validPrivateProxyKey(headers.get("x-do-qa-proxy-key") || "", env.PUSH44_QA_PROXY_KEY || "");
  } catch { return false; }
}

export async function readQaDeviceBoundedBody(request: Request): Promise<string | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2048) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { reader.releaseLock(); }
}
