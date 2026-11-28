import { fail, handleSafeRouteError } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile?.active) return fail("נדרשת התחברות מחדש.", 401);
    const { id } = await context.params;
    if (!uuid.test(id)) return fail("בקשת המידע אינה זמינה.", 404);

    // The user-scoped RPC verifies the requester again, locks the bounded
    // grant, reads only the canonical self profile and audits before returning.
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("management_read_privacy_self_delivery" as never, {
      p_request_id: id
    } as never);
    if (error || !data || typeof data !== "object") return fail("בקשת המידע אינה זמינה.", 404);
    const payload = data as { request_type?: string; coverage?: string; profile?: unknown };
    if (!["access", "export"].includes(payload.request_type ?? "")
      || payload.coverage !== "self_profile_only" || !payload.profile) {
      return fail("בקשת המידע אינה זמינה.", 404);
    }
    const headers: Record<string, string> = {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "application/json; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    };
    if (payload.request_type === "export") {
      headers["Content-Disposition"] = 'attachment; filename="gan-batuach-self-profile.json"';
    }
    return new Response(JSON.stringify(data, null, 2), { status: 200, headers });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
