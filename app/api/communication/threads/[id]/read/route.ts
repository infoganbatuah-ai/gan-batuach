import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile?.active) return fail("נדרשת התחברות מחדש.", 401);
    const id = z.string().uuid().parse((await context.params).id);
    const supabase = await createClient();
    const { error } = await supabase.rpc("mark_management_communication_thread_read" as never, { p_thread_id: id } as never);
    if (error) return fail(error.code === "42501" ? "אין הרשאה לשיחה זו." : "עדכון הקריאה נכשל.", error.code === "42501" ? 403 : 400);
    return ok({ thread_id: id, read: true });
  } catch (error) { return handleSafeRouteError(error); }
}
