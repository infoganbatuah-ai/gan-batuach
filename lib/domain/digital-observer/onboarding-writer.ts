// Server-side Development candidate. Only a local, dedicated PostgREST caller is accepted.
import "server-only";
import { createHash } from "node:crypto";

export async function submitOwnerSiteSave(claims: { sub: string; session_id: string; exp: number },
  submission: string, input: object, command: Record<string, unknown>) {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const token = process.env.OBSERVER_LOCAL_SITE_SAVE_CALLER_TOKEN;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const unavailable = { data: null, error: { code: "WRITER_UNAVAILABLE" } };
  if (!origin || !token || !apiKey || !/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(origin)) return unavailable;
  // Supabase validates the signature. Refuse a misconfigured general-purpose credential before transmission.
  const parts = token.split(".");
  if (parts.length !== 3) return unavailable;
  try {
    const metadata = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (metadata.role !== "observer_site_save_caller" || !Number.isSafeInteger(metadata.exp) || metadata.exp * 1000 <= Date.now()) return unavailable;
    const response = await fetch(new URL("/rest/v1/rpc/submit_observer_site_save", origin), {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000),
      headers: { apikey: apiKey, authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ ...command, verified_actor: claims.sub, verified_session: claims.session_id, token_exp: claims.exp,
        submission, request_digest: createHash("sha256").update(JSON.stringify(input)).digest("hex") })
    });
    const result = await response.json();
    return response.ok ? { data: result, error: null } : { data: null, error: { code: String(result?.code ?? "WRITER_ERROR") } };
  } catch {
    return unavailable;
  }
}
