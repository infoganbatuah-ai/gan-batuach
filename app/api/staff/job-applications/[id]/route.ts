import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("respond"), response: z.string().trim().min(2).max(3000) }),
  z.object({ action: z.literal("withdraw") }),
  z.object({ action: z.literal("accept") })
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile) return fail("נדרשת התחברות מחדש.", 401);
    if (session.profile.role !== "staff") return fail("אין הרשאה לפעולת מועמדות.", 403);
    const { id } = await params; const payload = schema.parse(await request.json()); const supabase = await createClient();
    const result = payload.action === "accept"
      ? await supabase.rpc("activate_staff_employment", { target_application_id: id, target_invitation_id: null })
      : await supabase.rpc("respond_staff_job_application", { target_application_id: id, target_action: payload.action, target_response: payload.action === "respond" ? payload.response : null });
    if (result.error) return fail("הפעולה אינה זמינה במצב הנוכחי או שאינה שייכת למשתמש.", result.error.code === "42501" ? 403 : 409);
    return ok(result.data);
  } catch (error) { return handleSafeRouteError(error); }
}
