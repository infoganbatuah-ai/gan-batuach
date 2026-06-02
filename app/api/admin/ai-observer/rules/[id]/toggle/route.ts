import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin"]);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const enabled = Boolean(body.enabled);
    const supabase = isAdminClientConfigured() ? createAdminClient() : await createClient();
    const { data, error } = await supabase
      .from("observer_rules" as any)
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) return fail("עדכון חוק התצפיתן נכשל: " + error.message, 400);
    return ok({ rule: data });
  } catch (error) {
    return handleRouteError(error);
  }
}
