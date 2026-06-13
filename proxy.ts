import { type NextFetchEvent, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function firstForwardedIp(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
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
  response.headers.set("x-request-id", requestId);
  event.waitUntil(writeAuditLog(request, response.status, requestId));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
