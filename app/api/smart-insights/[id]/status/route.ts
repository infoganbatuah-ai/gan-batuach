import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  status: z.enum(["handled", "snoozed", "dismissed"]),
  snoozeHours: z.number().int().min(1).max(168).optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireUser();
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const { data: current, error: currentError } = await supabase.from("smart_insights" as any).select("*").eq("id", id).single();
    if (currentError || !current) return fail(currentError?.message ?? "Insight not found", 404);
    const row = current as any;
    const allowed = profile.role === "admin" || row.recipient_profile_id === profile.id || (profile.garden_id && row.kindergarten_id === profile.garden_id);
    if (!allowed) return fail("Forbidden", 403);
    const update = {
      status: payload.status,
      handled_at: payload.status === "handled" || payload.status === "dismissed" ? new Date().toISOString() : null,
      snoozed_until: payload.status === "snoozed" ? new Date(Date.now() + (payload.snoozeHours ?? 24) * 60 * 60 * 1000).toISOString() : null
    };
    const { data, error } = await supabase.from("smart_insights" as any).update(update).eq("id", id).select("*").single();
    if (error) return fail(error.message, 400);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
