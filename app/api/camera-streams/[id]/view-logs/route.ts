import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const endSchema = z.object({
  session_id: z.string().uuid()
});

export async function PATCH(request: Request) {
  try {
    const permission = await requirePermission("video:stream");
    if (!permission.allowed) return fail("Forbidden", 403);
    const { session_id } = endSchema.parse(await request.json());
    const supabase = await createClient();
    const endedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from("video_stream_sessions")
      .update({ ended_at: endedAt } as any)
      .eq("id", session_id)
      .select("*")
      .single();
    if (error) return fail(error.message, 400);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
