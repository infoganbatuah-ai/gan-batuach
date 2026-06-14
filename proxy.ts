import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function firstForwardedIp(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function envHosts(...values: Array<string | undefined>) {
  return values
    .flatMap((value) => value?.split(",") ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function hostWithoutPort(value: string | null) {
  return value?.split(":")[0]?.toLowerCase() ?? "";
}

function isDigitalObserverHost(request: NextRequest) {
  const host = hostWithoutPort(request.headers.get("host"));
  if (!host) return false;
  return envHosts(process.env.DIGITAL_OBSERVER_PUBLIC_HOST, process.env.DIGITAL_OBSERVER_APP_HOST).includes(host);
}

function digitalObserverRewritePath(pathname: string) {
  if (pathname.startsWith("/digital-observer")) return null;
  if (pathname.startsWith("/api") || pathname.startsWith("/auth")) return null;
  if (pathname === "/") return "/digital-observer";
  if (pathname === "/dashboard") return "/digital-observer/dashboard";
  if (pathname === "/onboarding") return "/digital-observer/onboarding";
  if (pathname.startsWith("/sites/")) return `/digital-observer${pathname}`;
  return `/digital-observer${pathname}`;
}

function rewriteForDigitalObserverHost(request: NextRequest, response: NextResponse) {
  if (!isDigitalObserverHost(request)) return response;
  const nextPath = digitalObserverRewritePath(request.nextUrl.pathname);
  if (!nextPath) return response;

  const url = request.nextUrl.clone();
  url.pathname = nextPath;
  const rewrite = NextResponse.rewrite(url, { request });
  response.headers.forEach((value, key) => rewrite.headers.set(key, value));
  response.cookies.getAll().forEach((cookie) => rewrite.cookies.set(cookie));
  rewrite.headers.set("x-digital-observer-host-routing", "ready");
  return rewrite;
}

function writeAuditLog(request: NextRequest, responseStatus: number, requestId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return Promise.resolve();
  const endpoint = `${supabaseUrl}/rest/v1/audit_logs`;
  const role = request.cookies.get("gb_role")?.value ?? request.headers.get("x-user-role") ?? null;
  return fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      prefer: "return=minimal"
    },
    body: JSON.stringify({
      entity_type: "http_request",
      action: "request_observed",
      user_role: role,
      http_method: request.method,
      api_endpoint: request.nextUrl.pathname,
      client_source_ip: firstForwardedIp(request.headers.get("x-forwarded-for")),
      http_status_code: responseStatus,
      request_id: requestId,
      ip: firstForwardedIp(request.headers.get("x-forwarded-for")),
      user_agent: request.headers.get("user-agent"),
      compliance_context: {
        source: "next_proxy",
        iso_27001: true,
        iso_27017: true,
        iso_27701: true
      }
    })
  }).then(() => undefined).catch(() => undefined);
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const requestId = crypto.randomUUID();
  const response = await updateSession(request);
  const routedResponse = rewriteForDigitalObserverHost(request, response);
  routedResponse.headers.set("x-request-id", requestId);
  event.waitUntil(writeAuditLog(request, routedResponse.status, requestId));
  return routedResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
