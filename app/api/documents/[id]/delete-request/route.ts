import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile?.active) return fail("נדרשת התחברות מחדש.", 401);
    const { id } = await context.params;
    if (!uuid.test(id)) return fail("מזהה מסמך לא תקין.", 422);
    const db = await createClient();
    const { data, error } = await db.rpc("request_management_document_deletion" as never, { p_id: id } as never);
    if (error) return fail("לא ניתן לבקש מחיקה למסמך זה.", 403);
    return ok({ id: (data as { id: string }).id, deletion_requested: true,
      disposition: "pending_retention_review" });
  } catch (error) { return handleSafeRouteError(error); }
}
