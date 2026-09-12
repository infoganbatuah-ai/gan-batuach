import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, profile } = await getSessionProfile();
    if (!user || !profile) return fail("נדרשת התחברות.", 401);
    if (profile.role !== "inspector") return fail("אין הרשאת מפקח.", 403);
    const id = z.string().uuid().parse((await params).id);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("cancel_inspector_preliminary_garden" as never, { p_garden_id: id } as never);
    if (error) return fail(error.code === "42501" ? "אין הרשאה לטיוטה זו." : "לא ניתן לבטל לאחר שהנמען התחיל קליטה.", error.code === "42501" ? 403 : 409);
    return ok(data);
  } catch (error) { return handleSafeRouteError(error); }
}
