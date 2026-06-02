import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.literal("retry"),
  id: z.string().uuid()
});

export async function POST(request: Request) {
  try {
    await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const update = await supabase.from("communication_logs" as any).update({
      status: "sent_mock",
      provider: "mock_retry",
      failure_reason: null,
      provider_message_id: `mock_retry_${Date.now()}`,
      sent_at: new Date().toISOString()
    }).eq("id", payload.id).select("id, status").maybeSingle();
    if (update.error || !update.data) {
      console.error("[admin-communication] retry update failed", { id: payload.id, error: update.error?.message });
      return fail("ניסיון השליחה החוזר נכשל.", 500);
    }
    return ok({ log: update.data });
  } catch (error) {
    console.error("[admin-communication] unhandled failure", error);
    return handleRouteError(error);
  }
}
