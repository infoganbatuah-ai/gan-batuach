import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile) return fail("נדרשת התחברות", 401);
    if (session.profile.role !== "parent") return fail("אין הרשאה", 403);
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return fail("מזהה גן לא תקין", 422);
    const { data, error } = await (await createClient()).rpc("parent_corrective_action_summary" as never, { p_garden_id: id } as never);
    if (error) return fail(error.message, error.code === "42501" ? 403 : 400);
    return ok(data);
  } catch (error) { return handleRouteError(error); }
}
