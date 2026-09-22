import "server-only";

import { createHash } from "node:crypto";
import { SafeHttpError } from "@/lib/api";
import { CANONICAL_APP_ORIGIN } from "@/lib/domain/auth-flow";
import { firstForwardedIp } from "@/lib/security/audit-log-service";

const DEFAULT_JSON_LIMIT = 16 * 1024;

function configuredOrigins(request: Request) {
  const requestUrl = new URL(request.url);
  const origins = new Set<string>([CANONICAL_APP_ORIGIN]);
  if (!requestUrl.hostname.endsWith(".vercel.app")) origins.add(requestUrl.origin);
  for (const value of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL
  ]) {
    if (!value) continue;
    try {
      const configured = new URL(value.includes("://") ? value : `https://${value}`);
      if (!configured.hostname.endsWith(".vercel.app")) origins.add(configured.origin);
    } catch {
      // Invalid deployment metadata is ignored; the request origin remains fail-closed.
    }
  }
  return origins;
}

export function assertTrustedMutationOrigin(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization && /^Bearer\s+[^\s]+$/i.test(authorization)) return;
  const origin = request.headers.get("origin");
  if (!origin || !configuredOrigins(request).has(origin)) {
    throw new SafeHttpError("CSRF_REJECTED", 403);
  }
}

export function assertRequestBodySize(request: Request, maxBytes = DEFAULT_JSON_LIMIT) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new SafeHttpError("PAYLOAD_TOO_LARGE", 413);
  }
}

export async function parseBoundedJson(request: Request, maxBytes = DEFAULT_JSON_LIMIT): Promise<unknown> {
  assertRequestBodySize(request, maxBytes);
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > maxBytes) {
    throw new SafeHttpError("PAYLOAD_TOO_LARGE", 413);
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new SafeHttpError("INVALID_JSON", 400);
  }
}

export function privateRateLimitIdentifier(input: {
  userId?: string | null;
  tenantId?: string | null;
  headers: Headers;
}) {
  const material = [
    "do-rate-v1",
    input.tenantId ?? "no-tenant",
    input.userId ?? "anonymous",
    firstForwardedIp(input.headers) ?? "no-ip"
  ].join("|");
  return `do:${createHash("sha256").update(material).digest("hex")}`;
}
