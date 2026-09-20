import { requireUser } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({ ids: z.array(z.string().uuid()).max(100).optional() }).strict();

export async function POST(request: Request) {
  try {
    await requireUser();
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return fail("בקשת סימון התראות אינה תקינה", 400);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("mark_management_notifications_read", {
      p_ids: parsed.data.ids ?? null
    });
    if (error) {
      console.error("[notifications-mark-read]", { code: error.code });
      return fail("לא ניתן לסמן התראות כנקראו כרגע", 400);
    }
    return ok({ updated: data ?? 0 });
  } catch (error) {
    return handleRouteError(error);
  }
}
