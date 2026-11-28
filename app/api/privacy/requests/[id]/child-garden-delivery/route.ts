import { fail, handleSafeRouteError } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStore = "private, no-store, max-age=0";

function unavailable() {
  const response = fail("בקשת המידע אינה זמינה.", 404);
  response.headers.set("Cache-Control", noStore);
  return response;
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile?.active || session.profile.role !== "parent") {
      return unavailable();
    }
    const { id } = await context.params;
    if (!uuid.test(id)) return unavailable();

    // The user-scoped database function rechecks current guardian authority,
    // Garden binding, hold/scope, expiry and read limit in one audited transaction.
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("management_read_privacy_child_garden_delivery" as never, {
      p_request_id: id
    } as never);
    if (error || !data || typeof data !== "object") return unavailable();
    const payload = data as { request_type?: string; coverage?: string; child?: unknown; garden?: unknown };
    if (!["access", "export"].includes(payload.request_type ?? "")
      || payload.coverage !== "child_garden_identity_only" || !payload.child || !payload.garden) {
      return unavailable();
    }
    const headers: Record<string, string> = {
      "Cache-Control": noStore,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    };
    if (payload.request_type === "export") {
      headers["Content-Disposition"] = 'attachment; filename="gan-batuach-child-garden-identity.json"';
    }
    return new Response(JSON.stringify(data, null, 2), { status: 200, headers });
  } catch (error) {
    const response = handleSafeRouteError(error);
    response.headers.set("Cache-Control", noStore);
    return response;
  }
}
